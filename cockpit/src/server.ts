import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import type { CoreMessage } from 'ai';
import { runAgentLoop } from './agent/loop';
import { getDefaultConfig } from './agent/llm';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const sessions = new Map<string, CoreMessage[]>();

app.get('/api/config', (_req, res) => {
  res.json(getDefaultConfig());
});

app.post('/api/chat', async (req, res) => {
  const { sessionId, message, provider, model } = req.body as {
    sessionId?: string;
    message?: string;
    provider?: string;
    model?: string;
  };
  const sid = sessionId || 'default';

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const history = sessions.get(sid) ?? [];
  const nextHistory: CoreMessage[] = [...history, { role: 'user', content: message }];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    for await (const evt of runAgentLoop(nextHistory, { provider, model })) {
      if (evt.type === 'text-delta') {
        send('text-delta', { text: evt.text });
      } else if (evt.type === 'tool-call') {
        send('tool-call', { toolName: evt.toolName, args: evt.args });
      } else if (evt.type === 'tool-result') {
        send('tool-result', { toolName: evt.toolName, result: evt.result });
      } else if (evt.type === 'error') {
        send('error', { message: evt.message });
      } else if (evt.type === 'final-messages') {
        sessions.set(sid, evt.messages);
      }
    }
    send('done', {});
  } catch (err) {
    send('error', { message: (err as Error).message });
  } finally {
    res.end();
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`Cockpit listening on :${port}`);
});
