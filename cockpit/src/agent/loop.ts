import { streamText, type CoreMessage } from 'ai';
import { getModel, type ModelOverride } from './llm';
import { getMcpTools } from './mcpClient';

const SYSTEM_PROMPT = `Voce e um agente de IA com controle total de um desktop Ubuntu remoto, via ferramentas computer_*.

REGRA MAIS IMPORTANTE: tudo que voce fizer precisa acontecer VISIVELMENTE na tela, em tempo real, para que a pessoa observando o VNC veja cada acao acontecer. Voce NAO tem acesso a comandos de shell nem leitura/escrita de arquivo "por baixo dos panos" -- essas ferramentas foram removidas de proposito. Para rodar qualquer comando de terminal, voce DEVE:
1. Chamar computer_application com application="terminal" para abrir/focar o Terminal (ele ja abre maximizado e em foco).
2. Chamar computer_type_text (ou computer_paste_text) para digitar o comando -- isso aparece digitando na tela, letra por letra, visivel no VNC.
3. Chamar computer_type_keys com ["Return"] para executar o comando (equivalente a apertar Enter).
Nunca pule esses passos. Trate o terminal aberto como a UNICA forma de rodar comandos -- exatamente como uma pessoa faria manualmente.

Para abrir paginas ou navegar, use computer_application com application="firefox" (ou reaproveite o BrowserOS ja aberto), depois clique/digite normalmente.
Use computer_screenshot com moderacao, apenas quando precisar confirmar visualmente o estado da tela -- nem todo modelo consegue enxergar a imagem retornada, entao nao dependa disso como unica fonte de verdade; prefira narrar e agir com base no que voce mandou fazer.
Coordenadas sao em pixels, origem (0,0) no canto superior esquerdo. A resolucao da tela e 1280x960.
Narre brevemente o que esta fazendo e por que antes de cada acao. Seja eficiente: nao repita acoes desnecessarias.
Responda sempre em portugues do Brasil.`;

const MAX_ROUNDS = 20;
const ROUND_DELAY_MS = 600;

export type StreamEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; toolName: string; args: unknown }
  | { type: 'tool-result'; toolName: string; result: unknown }
  | { type: 'error'; message: string }
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
      return 'screenshot capturado (imagem enviada na proxima mensagem)';
    }
  }
  if (typeof result === 'string') return result;
  try {
    return JSON.stringify(result).slice(0, 2000);
  } catch {
    return String(result);
  }
}

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

export async function* runAgentLoop(
  initialMessages: CoreMessage[],
  modelOverride?: ModelOverride,
): AsyncGenerator<StreamEvent> {
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
      maxRetries: 5,
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

    if (!sawToolCall) break;
  }

  yield { type: 'final-messages', messages };
}
