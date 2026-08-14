import fs from 'node:fs';
import path from 'node:path';
import type { CoreMessage } from 'ai';

const SESSIONS_DIR = process.env.SESSIONS_DIR || path.join(__dirname, '../data/sessions');
fs.mkdirSync(SESSIONS_DIR, { recursive: true });

export type UiTraceEvent =
  | { kind: 'tool-call'; toolName: string; args: unknown }
  | { kind: 'tool-result'; toolName: string; result: unknown };

export type UiMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  trace: UiTraceEvent[];
};

export type SessionData = {
  coreMessages: CoreMessage[];
  uiMessages: UiMessage[];
  codexThreadId?: string;
  provider?: string;
  model?: string;
  updatedAt: number;
};

function emptySession(): SessionData {
  return { coreMessages: [], uiMessages: [], updatedAt: Date.now() };
}

// sessionId chega do cliente (body/params) — sanitiza pra não virar path traversal
function filePath(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200);
  return path.join(SESSIONS_DIR, `${safe || 'default'}.json`);
}

export function loadSession(id: string): SessionData {
  try {
    const raw = fs.readFileSync(filePath(id), 'utf8');
    return { ...emptySession(), ...(JSON.parse(raw) as Partial<SessionData>) };
  } catch {
    return emptySession();
  }
}

export function saveSession(id: string, data: SessionData): void {
  data.updatedAt = Date.now();
  fs.writeFileSync(filePath(id), JSON.stringify(data));
}

export function deleteSession(id: string): void {
  try {
    fs.unlinkSync(filePath(id));
  } catch {
    // já não existe — ok
  }
}

export type SessionSummary = {
  id: string;
  title: string;
  updatedAt: number;
};

export function listSessions(): SessionSummary[] {
  const files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'));
  const summaries: SessionSummary[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf8');
      const data = JSON.parse(raw) as Partial<SessionData>;
      if (!data.uiMessages?.length) continue;
      const firstUserMsg = data.uiMessages.find((m) => m.role === 'user');
      const title = (firstUserMsg?.text || 'Nova conversa').slice(0, 60);
      summaries.push({ id: file.replace(/\.json$/, ''), title, updatedAt: data.updatedAt || 0 });
    } catch {
      // sessão corrompida/ilegível — pula
    }
  }

  return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
}
