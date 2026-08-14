import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import type { CoreMessage } from 'ai';
import { runAgentLoop } from './agent/loop';
import { getDefaultConfig } from './agent/llm';
import { getDefaultTtsConfig } from './tts';
import { loadSession, saveSession, deleteSession, listSessions, type UiMessage } from './sessionStore';
import { synthesizeSpeech } from './tts';
import { transcribeAudio } from './stt';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── Auth ─────────────────────────────────────────────────────────────────────
const COCKPIT_PASSWORD = process.env.COCKPIT_PASSWORD || 'changeme';
const validTokens = new Set<string>();

app.post('/api/login', (req: express.Request, res: express.Response) => {
  const { password } = req.body as { password?: string };
  if (!password || password !== COCKPIT_PASSWORD) {
    res.status(401).json({ error: 'Senha incorreta' });
    return;
  }
  const token = crypto.randomBytes(32).toString('hex');
  validTokens.add(token);
  console.log(`[auth] Nova sessão autenticada`);
  res.json({ token });
});

app.post('/api/logout', (req: express.Request, res: express.Response) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    validTokens.delete(auth.slice(7));
  }
  res.json({ ok: true });
});

function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  const token = auth.slice(7);
  if (!validTokens.has(token)) {
    res.status(401).json({ error: 'Token inválido ou expirado' });
    return;
  }
  next();
}
// ──────────────────────────────────────────────────────────────────────────────

app.get('/api/config', requireAuth, (_req: express.Request, res: express.Response) => {
  res.json(getDefaultConfig());
});

app.get('/api/sessions', requireAuth, (_req: express.Request, res: express.Response) => {
  res.json({ sessions: listSessions() });
});

app.get('/api/session/:id', requireAuth, (req: express.Request, res: express.Response) => {
  const sid = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const session = loadSession(sid);
  res.json({ messages: session.uiMessages, provider: session.provider, model: session.model });
});

app.post('/api/chat', requireAuth, async (req: express.Request, res: express.Response) => {
  const { sessionId, message, provider, model, images } = req.body as {
    sessionId?: string;
    message?: string;
    provider?: string;
    model?: string;
    images?: string[];
  };

  const sid = sessionId || 'default';

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'message é obrigatório' });
    return;
  }

  const session = loadSession(sid);
  const userContent: CoreMessage['content'] =
    images && images.length
      ? [{ type: 'text', text: message }, ...images.map((image) => ({ type: 'image' as const, image }))]
      : message;
  const nextHistory: CoreMessage[] = [...session.coreMessages, { role: 'user', content: userContent }];

  const userUiMessage: UiMessage = { id: crypto.randomUUID(), role: 'user', text: message, trace: [] };
  const assistantUiMessage: UiMessage = { id: crypto.randomUUID(), role: 'assistant', text: '', trace: [] };

  // Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    for await (const evt of runAgentLoop(nextHistory, { provider, model }, sid, session.codexThreadId)) {
      if (evt.type === 'text-delta') {
        assistantUiMessage.text += evt.text;
        send('text-delta', { text: evt.text });
      } else if (evt.type === 'tool-call') {
        assistantUiMessage.trace.push({ kind: 'tool-call', toolName: evt.toolName, args: evt.args });
        send('tool-call', { toolName: evt.toolName, args: evt.args });
      } else if (evt.type === 'tool-result') {
        assistantUiMessage.trace.push({ kind: 'tool-result', toolName: evt.toolName, result: evt.result });
        send('tool-result', { toolName: evt.toolName, result: evt.result });
      } else if (evt.type === 'error') {
        send('error', { message: evt.message });
      } else if (evt.type === 'thread-id') {
        session.codexThreadId = evt.threadId;
      } else if (evt.type === 'final-messages') {
        if (evt.messages.length) session.coreMessages = evt.messages;
      }
    }
    send('done', {});
  } catch (err) {
    send('error', { message: (err as Error).message });
  } finally {
    session.uiMessages.push(userUiMessage, assistantUiMessage);
    session.provider = provider || session.provider;
    session.model = model || session.model;
    saveSession(sid, session);
    res.end();
  }
});

app.post('/api/tts', requireAuth, async (req: express.Request, res: express.Response) => {
  const { text, voice } = req.body as { text?: string; voice?: string };
  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'text é obrigatório' });
    return;
  }
  try {
    const audio = await synthesizeSpeech(text, voice);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(audio.length));
    res.send(audio);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Áudio bruto (webm/opus gravado no navegador) — Whisper local, sem serviço externo.
app.post(
  '/api/transcribe',
  requireAuth,
  express.raw({ type: () => true, limit: '15mb' }),
  async (req: express.Request, res: express.Response) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: 'áudio vazio' });
      return;
    }
    try {
      const mimeType = req.headers['content-type'] || 'audio/webm';
      const text = await transcribeAudio(req.body, mimeType);
      res.json({ text });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  },
);

app.delete('/api/session/:id', requireAuth, (req: express.Request, res: express.Response) => {
  const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  deleteSession(sessionId);
  res.json({ ok: true });
});

app.get('/api/health', (_req: express.Request, res: express.Response) => {
  res.json({ ok: true });
});

// Serve frontend estático (gerado pelo Vite)
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));
app.get('*', (_req: express.Request, res: express.Response) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

const port = Number(process.env.PORT) || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log(`🌌 Cockpit ouvindo em http://0.0.0.0:${port}`);
  console.log(`   Provider padrão: ${process.env.LLM_PROVIDER || 'codex'}`);
  console.log(`   Modelo padrão:   ${process.env.LLM_MODEL || 'z-ai/glm-5.2'}`);
  console.log(`   MCP:             ${process.env.MCP_URL || 'http://iagencia-desktop:9990/mcp'}`);
  const tts = getDefaultTtsConfig();
  console.log(`   TTS:             ${tts.provider} (${tts.voice})`);
});
