import { useCallback, useEffect, useRef, useState } from 'react';

type TraceEvent =
  | { kind: 'tool-call'; toolName: string; args: unknown }
  | { kind: 'tool-result'; toolName: string; result: unknown };

type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
  trace: TraceEvent[];
};

const NOVNC_HOST = window.location.hostname;
const NOVNC_URL = `http://${NOVNC_HOST}:9990/novnc/vnc.html?path=websockify&autoconnect=true&resize=scale`;

// crypto.randomUUID() only exists in secure contexts (https/localhost).
// This app is served over plain http on a LAN IP, so we need a fallback.
function safeRandomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // fall through to fallback
    }
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extractImage(result: unknown): { data: string; mimeType: string } | null {
  const content = (result as { content?: unknown })?.content;
  if (!Array.isArray(content)) return null;
  const image = content.find((c) => c && typeof c === 'object' && (c as { type?: string }).type === 'image') as
    | { data?: string; mimeType?: string }
    | undefined;
  if (!image?.data) return null;
  return { data: image.data, mimeType: image.mimeType || 'image/png' };
}

function TraceItem({ t }: { t: TraceEvent }) {
  if (t.kind === 'tool-result') {
    const image = extractImage(t.result);
    if (image) {
      return (
        <div className="trace-item">
          <strong>&larr; {t.toolName}</strong>
          <img className="trace-image" src={`data:${image.mimeType};base64,${image.data}`} alt={t.toolName} />
        </div>
      );
    }
  }
  const payload = t.kind === 'tool-call' ? t.args : t.result;
  const json = JSON.stringify(payload, null, 2) ?? '';
  return (
    <div className="trace-item">
      <strong>{t.kind === 'tool-call' ? '\u2192' : '\u2190'} {t.toolName}</strong>
      <pre>{json.length > 800 ? `${json.slice(0, 800)}...` : json}</pre>
    </div>
  );
}

const PROVIDERS = ['nvidia', 'anthropic', 'openai', 'google'];

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [provider, setProvider] = useState('nvidia');
  const [model, setModel] = useState('');
  const sessionId = useRef(safeRandomId());

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((cfg: { provider: string; model: string }) => {
        setProvider(cfg.provider || 'nvidia');
        setModel(cfg.model || '');
      })
      .catch(() => {});
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);

    setMessages((prev) => [
      ...prev,
      { role: 'user', text, trace: [] },
      { role: 'assistant', text: '', trace: [] },
    ]);

    const updateLast = (fn: (m: ChatMessage) => ChatMessage) => {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = fn(copy[copy.length - 1]);
        return copy;
      });
    };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId.current,
          message: text,
          provider,
          model: model || undefined,
        }),
      });

      if (!res.body) {
        setSending(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        for (const chunk of chunks) {
          const lines = chunk.split('\n');
          const eventLine = lines.find((l) => l.startsWith('event: '));
          const dataLine = lines.find((l) => l.startsWith('data: '));
          if (!eventLine || !dataLine) continue;
          const event = eventLine.slice('event: '.length);
          const data = JSON.parse(dataLine.slice('data: '.length));

          if (event === 'text-delta') {
            updateLast((m) => ({ ...m, text: m.text + data.text }));
          } else if (event === 'tool-call') {
            updateLast((m) => ({
              ...m,
              trace: [...m.trace, { kind: 'tool-call', toolName: data.toolName, args: data.args }],
            }));
          } else if (event === 'tool-result') {
            updateLast((m) => ({
              ...m,
              trace: [...m.trace, { kind: 'tool-result', toolName: data.toolName, result: data.result }],
            }));
          } else if (event === 'error') {
            updateLast((m) => ({ ...m, text: `${m.text}\n[erro: ${data.message}]` }));
          }
        }
      }
    } finally {
      setSending(false);
    }
  }, [input, sending, provider, model]);

  return (
    <div className="cockpit">
      <div className="chat-panel">
        <div className="chat-header">
          <span>Cockpit</span>
        </div>
        <div className="model-bar">
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="model id (ex: z-ai/glm-5.2)"
          />
        </div>
        <div className="chat-messages">
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.role}`}>
              {m.trace.length > 0 && (
                <details className="trace">
                  <summary>Examinando... ({m.trace.length})</summary>
                  {m.trace.map((t, j) => (
                    <TraceItem key={j} t={t} />
                  ))}
                </details>
              )}
              {m.text && <div className="bubble">{m.text}</div>}
            </div>
          ))}
        </div>
        <div className="chat-input">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Do que mais voce precisa?"
            disabled={sending}
          />
          <button onClick={send} disabled={sending}>
            {sending ? '...' : 'Enviar'}
          </button>
        </div>
      </div>
      <div className="vnc-panel">
        <div className="vnc-header">Navegador remoto</div>
        <iframe title="noVNC" src={NOVNC_URL} />
      </div>
    </div>
  );
}
