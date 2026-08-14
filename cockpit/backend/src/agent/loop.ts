import { spawn } from 'node:child_process';
import * as readline from 'node:readline';
import { streamText, type CoreMessage } from 'ai';
import { getModel, type ModelOverride } from './llm';
import { getMcpTools } from './mcpClient';

const SYSTEM_PROMPT = `Você é um agente de IA com controle total de um desktop Ubuntu remoto, via ferramentas computer_*.

REGRA PRINCIPAL: tudo que você fizer precisa acontecer VISIVELMENTE na tela, em tempo real, para que a pessoa observando o desktop ao vivo veja cada ação acontecer.

Você NÃO tem acesso a comandos de shell nem leitura/escrita de arquivo "por baixo dos panos" — essas ferramentas foram removidas de propósito. Para rodar qualquer comando de terminal, você DEVE:
1. Chamar computer_application com application="terminal" para abrir/focar o Terminal (ele já abre maximizado e em foco).
2. Chamar computer_type_text (ou computer_paste_text) para digitar o comando — isso aparece digitando na tela, letra por letra, visível no desktop.
3. Chamar computer_type_keys com ["Return"] para executar o comando (equivalente a apertar Enter).
Nunca pule esses passos. Trate o terminal aberto como a ÚNICA forma de rodar comandos — exatamente como uma pessoa faria manualmente.

Para abrir páginas web ou navegar, use computer_application com application="firefox" (ou use o BrowserOS já aberto), depois clique/digite normalmente na barra de endereços.

Use computer_screenshot com moderação, apenas quando precisar confirmar visualmente o estado da tela.

Coordenadas são em pixels, origem (0,0) no canto superior esquerdo. A resolução da tela é 1280x960.

Narre brevemente o que está fazendo e por que antes de cada ação. Seja eficiente: não repita ações desnecessárias.

Responda sempre em português do Brasil.`;

const MAX_ROUNDS = 20;
const ROUND_DELAY_MS = 600;

export type StreamEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; toolName: string; args: unknown }
  | { type: 'tool-result'; toolName: string; result: unknown }
  | { type: 'error'; message: string }
  | { type: 'thread-id'; threadId: string }
  | { type: 'final-messages'; messages: CoreMessage[] };

function extractImage(result: unknown): { data: string; mimeType: string } | null {
  const content = (result as { content?: unknown })?.content;
  if (!Array.isArray(content)) return null;
  const image = (content as any[]).find((c) => c && c.type === 'image') as
    | { data?: string; mimeType?: string }
    | undefined;
  if (!image?.data) return null;
  return { data: image.data, mimeType: image.mimeType || 'image/png' };
}

function summarizeToolResult(result: unknown): string {
  const content = (result as { content?: unknown })?.content;
  if (Array.isArray(content)) {
    const texts = (content as any[])
      .filter((c) => c?.type === 'text')
      .map((c) => c.text || '')
      .filter(Boolean);
    if (texts.length) return texts.join('\n');
    if ((content as any[]).some((c) => c?.type === 'image')) {
      return 'screenshot capturado (imagem enviada na próxima mensagem)';
    }
  }
  if (typeof result === 'string') return result;
  try {
    return JSON.stringify(result).slice(0, 2000);
  } catch {
    return String(result);
  }
}

/**
 * Sanitiza tool-result messages:
 * - Extrai imagens para um user-message separado (compatibilidade multi-provider)
 * - OpenAI-compatible providers rejetam image content dentro de tool messages
 */
function sanitizeStepMessages(stepMessages: CoreMessage[]): CoreMessage[] {
  const images: { mimeType: string; data: string }[] = [];

  const cleaned = stepMessages.map((m) => {
    const msg = m as any;
    if (msg.role !== 'tool' || !Array.isArray(msg.content)) return m;
    return {
      ...msg,
      content: msg.content.map((part: any) => {
        if (part.type !== 'tool-result') return part;
        const image = extractImage(part.result);
        if (image) images.push(image);
        return { ...part, result: summarizeToolResult(part.result) };
      }),
    };
  });

  if (images.length === 0) return cleaned as CoreMessage[];

  const imageMessage: CoreMessage = {
    role: 'user',
    content: images.map((img) => ({
      type: 'image',
      image: `data:${img.mimeType};base64,${img.data}`,
    })) as any,
  };

  return [...cleaned, imageMessage] as CoreMessage[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Codex CLI provider ─────────────────────────────────────────────────────
// Login via conta ChatGPT (device-auth) não gera uma API key genérica, então
// esse provider não passa pela Vercel AI SDK: roda `codex exec` como
// subprocesso e traduz o JSONL de eventos para o mesmo StreamEvent daqui.
// O Codex chama as tools computer_* via seu próprio cliente MCP (configurado
// em ~/.codex/config.toml), não via getMcpTools().

const CODEX_BIN = process.env.CODEX_BIN || 'codex';
const codexThreads = new Map<string, string>();

function summarizeMcpItem(item: any): string {
  const content = item?.result?.content;
  if (Array.isArray(content)) {
    const texts = content
      .filter((c: any) => c?.type === 'text')
      .map((c: any) => c.text || '')
      .filter(Boolean);
    if (texts.length) return texts.join('\n');
    if (content.some((c: any) => c?.type === 'image')) return 'screenshot capturado';
  }
  if (item?.error) return String(item.error);
  try {
    return JSON.stringify(item?.result ?? {}).slice(0, 2000);
  } catch {
    return '';
  }
}

function mapCodexEvent(evt: any): StreamEvent[] {
  const out: StreamEvent[] = [];
  if (evt.type === 'item.started') {
    const item = evt.item;
    if (item?.type === 'mcp_tool_call') {
      out.push({ type: 'tool-call', toolName: item.tool || 'mcp_tool', args: item.arguments ?? {} });
    } else if (item?.type === 'command_execution') {
      out.push({ type: 'tool-call', toolName: 'shell', args: { command: item.command } });
    }
  } else if (evt.type === 'item.completed') {
    const item = evt.item;
    if (item?.type === 'agent_message' && item.text) {
      out.push({ type: 'text-delta', text: item.text });
    } else if (item?.type === 'mcp_tool_call') {
      out.push({ type: 'tool-result', toolName: item.tool || 'mcp_tool', result: summarizeMcpItem(item) });
    } else if (item?.type === 'command_execution') {
      out.push({
        type: 'tool-result',
        toolName: 'shell',
        result: item.aggregated_output ?? String(item.exit_code ?? ''),
      });
    } else if (item?.type === 'error') {
      out.push({ type: 'error', message: item.message || 'erro no Codex' });
    }
  } else if (evt.type === 'error' || evt.type === 'turn.failed') {
    out.push({ type: 'error', message: evt.message || evt.error?.message || 'erro no Codex' });
  }
  return out;
}

async function* runCodexLoop(
  sessionId: string,
  userMessage: string,
  resumeThreadId?: string,
): AsyncGenerator<StreamEvent> {
  const threadId = resumeThreadId || codexThreads.get(sessionId);
  // --dangerously-bypass-approvals-and-sandbox: ok aqui porque o próprio
  // container do Cockpit já é o sandbox externo (não é a máquina do usuário).
  const baseArgs = ['exec', '--json', '--skip-git-repo-check', '--dangerously-bypass-approvals-and-sandbox'];
  const args = threadId ? [...baseArgs, 'resume', threadId, userMessage] : [...baseArgs, userMessage];

  const child = spawn(CODEX_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const rl = readline.createInterface({ input: child.stdout });

  const queue: StreamEvent[] = [];
  let resolveNext: (() => void) | null = null;
  let done = false;
  let newThreadId: string | null = null;
  let stderrBuf = '';
  let spawnError: Error | null = null;

  child.on('error', (err) => {
    spawnError = err;
  });
  child.stderr.on('data', (d) => {
    stderrBuf += d.toString('utf8');
  });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) return;
    let evt: any;
    try {
      evt = JSON.parse(trimmed);
    } catch {
      return;
    }
    if (evt.type === 'thread.started' && evt.thread_id) {
      newThreadId = evt.thread_id;
    }
    for (const e of mapCodexEvent(evt)) queue.push(e);
    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
  });

  const closed = new Promise<number>((resolve) => {
    child.on('close', (code) => {
      done = true;
      resolve(code ?? 0);
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
    });
  });

  while (!done || queue.length > 0) {
    if (queue.length === 0) {
      await new Promise<void>((resolve) => {
        resolveNext = resolve;
      });
      continue;
    }
    yield queue.shift()!;
  }

  const exitCode = await closed;
  if (newThreadId) {
    codexThreads.set(sessionId, newThreadId);
    yield { type: 'thread-id', threadId: newThreadId };
  }
  if (spawnError) {
    yield { type: 'error', message: `Falha ao executar codex: ${(spawnError as Error).message}` };
  } else if (exitCode !== 0 && stderrBuf.trim()) {
    yield { type: 'error', message: stderrBuf.trim().slice(0, 2000) };
  }
  yield { type: 'final-messages', messages: [] };
}
// ─────────────────────────────────────────────────────────────────────────────

export async function* runAgentLoop(
  initialMessages: CoreMessage[],
  modelOverride?: ModelOverride,
  sessionId = 'default',
  resumeThreadId?: string,
): AsyncGenerator<StreamEvent> {
  if ((modelOverride?.provider || '').toLowerCase() === 'codex') {
    const lastUser = [...initialMessages].reverse().find((m) => m.role === 'user');
    const text =
      typeof lastUser?.content === 'string' ? lastUser.content : JSON.stringify(lastUser?.content ?? '');
    yield* runCodexLoop(sessionId, text, resumeThreadId);
    return;
  }

  const tools = await getMcpTools();
  const model = getModel(modelOverride);
  let messages = [...initialMessages];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (round > 0) {
      await sleep(ROUND_DELAY_MS);
    }

    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      messages,
      tools,
      maxSteps: 1,
      maxRetries: 3,
    });

    let sawToolCall = false;

    try {
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          yield { type: 'text-delta', text: part.textDelta };
        } else if (part.type === 'tool-call') {
          sawToolCall = true;
          yield { type: 'tool-call', toolName: part.toolName, args: part.args };
        } else if (part.type === 'tool-result') {
          yield { type: 'tool-result', toolName: part.toolName, result: part.result };
        } else if (part.type === 'error') {
          yield { type: 'error', message: String(part.error) };
        }
      }
    } catch (err) {
      yield { type: 'error', message: (err as Error).message };
      break;
    }

    const response = await result.response;
    const stepMessages = sanitizeStepMessages(response.messages as CoreMessage[]);
    messages = [...messages, ...stepMessages];

    // Sem tool call = agente terminou de agir
    if (!sawToolCall) break;
  }

  yield { type: 'final-messages', messages };
}
