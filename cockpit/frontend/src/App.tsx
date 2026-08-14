import { useCallback, useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// ── Types ─────────────────────────────────────────────────────────────────────
type TraceEvent =
  | { kind: 'tool-call'; toolName: string; args: unknown }
  | { kind: 'tool-result'; toolName: string; result: unknown };

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  trace: TraceEvent[];
  isStreaming?: boolean;
};

type SessionSummary = { id: string; title: string; updatedAt: number };

type PendingImage = { id: string; dataUrl: string };

type Provider = 'nvidia' | 'anthropic' | 'openai' | 'google' | 'codex';

const PROVIDERS: Provider[] = ['nvidia', 'anthropic', 'openai', 'google', 'codex'];
const IMAGE_CAPABLE_PROVIDERS: Provider[] = ['nvidia', 'anthropic', 'openai', 'google'];

marked.setOptions({ breaks: true });

function renderMarkdown(text: string): { __html: string } {
  const html = marked.parse(text, { async: false }) as string;
  return { __html: DOMPurify.sanitize(html) };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function safeSessionId(): string {
  try { return crypto.randomUUID(); } catch { return uid(); }
}

const SESSION_ID_KEY = 'cockpit_session_id';

function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(SESSION_ID_KEY);
  if (existing) return existing;
  const id = safeSessionId();
  localStorage.setItem(SESSION_ID_KEY, id);
  return id;
}

function extractImage(result: unknown): { data: string; mimeType: string } | null {
  const content = (result as { content?: unknown })?.content;
  if (!Array.isArray(content)) return null;
  const img = content.find(
    (c) => c && typeof c === 'object' && (c as { type?: string }).type === 'image',
  ) as { data?: string; mimeType?: string } | undefined;
  if (!img?.data) return null;
  return { data: img.data, mimeType: img.mimeType || 'image/png' };
}

function summarizeResult(result: unknown): string {
  const content = (result as { content?: unknown })?.content;
  if (Array.isArray(content)) {
    const texts = (content as { type?: string; text?: string }[])
      .filter((c) => c?.type === 'text')
      .map((c) => c.text || '')
      .filter(Boolean);
    if (texts.length) return texts.join('\n');
    if ((content as { type?: string }[]).some((c) => c?.type === 'image'))
      return '📸 Screenshot capturado';
  }
  if (typeof result === 'string') return result;
  try { return JSON.stringify(result, null, 2).slice(0, 800); } catch { return String(result); }
}

// ── TraceItem ─────────────────────────────────────────────────────────────────
function TraceItem({ t }: { t: TraceEvent }) {
  if (t.kind === 'tool-result') {
    const img = extractImage(t.result);
    if (img) {
      return (
        <div className="trace-item">
          <div className="trace-item-header">
            <span className="trace-arrow in">←</span>
            <span className="trace-tool-name">{t.toolName}</span>
          </div>
          <img className="trace-screenshot" src={`data:${img.mimeType};base64,${img.data}`} alt="screenshot" />
        </div>
      );
    }
  }
  const payload = t.kind === 'tool-call' ? t.args : t.result;
  const json = (() => {
    try { return JSON.stringify(payload, null, 2) ?? ''; } catch { return String(payload); }
  })();
  const summary = t.kind === 'tool-result' ? summarizeResult(t.result) : null;

  return (
    <div className="trace-item">
      <div className="trace-item-header">
        <span className={`trace-arrow ${t.kind === 'tool-call' ? 'out' : 'in'}`}>
          {t.kind === 'tool-call' ? '→' : '←'}
        </span>
        <span className="trace-tool-name">{t.toolName}</span>
      </div>
      {t.kind === 'tool-result' && summary ? (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px 0' }}>{summary}</div>
      ) : (
        <pre>{json.length > 600 ? `${json.slice(0, 600)}…` : json}</pre>
      )}
    </div>
  );
}

// ── AgentTrace ────────────────────────────────────────────────────────────────
function AgentTrace({ trace, isStreaming }: { trace: TraceEvent[]; isStreaming?: boolean }) {
  if (trace.length === 0 && !isStreaming) return null;
  return (
    <details className="trace-block" open={isStreaming}>
      <summary className="trace-summary">
        {isStreaming && <span className="trace-spin" />}
        {isStreaming ? 'Agente agindo…' : 'Ações executadas'}
        <span className="trace-count-badge">{trace.length}</span>
      </summary>
      {trace.length > 0 && (
        <div className="trace-items">
          {trace.map((t, i) => <TraceItem key={i} t={t} />)}
        </div>
      )}
    </details>
  );
}

// ── ModelBar ──────────────────────────────────────────────────────────────────
function ModelBar({
  provider, model, disabled,
  onProviderChange, onModelChange,
}: {
  provider: Provider; model: string; disabled: boolean;
  onProviderChange: (p: Provider) => void;
  onModelChange: (m: string) => void;
}) {
  return (
    <div className="model-bar">
      <span className="model-bar-label">Modelo</span>
      <select
        value={provider}
        onChange={(e) => onProviderChange(e.target.value as Provider)}
        disabled={disabled}
      >
        {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <input
        value={model}
        onChange={(e) => onModelChange(e.target.value)}
        placeholder="model id (ex: z-ai/glm-5.2)"
        disabled={disabled}
      />
      <span className={`provider-badge ${provider}`}>{provider}</span>
    </div>
  );
}

// ── SessionSidebar ───────────────────────────────────────────────────────────
function SessionSidebar({
  sessions, activeId, disabled, collapsed, onSelect, onNew, onToggleCollapse,
}: {
  sessions: SessionSummary[]; activeId: string; disabled: boolean; collapsed: boolean;
  onSelect: (id: string) => void; onNew: () => void; onToggleCollapse: () => void;
}) {
  if (collapsed) {
    return (
      <nav className="session-sidebar collapsed">
        <button className="session-collapse-btn" onClick={onToggleCollapse} title="Expandir conversas">
          »
        </button>
        <button className="session-new-btn-icon" onClick={onNew} disabled={disabled} title="Nova conversa">
          +
        </button>
      </nav>
    );
  }

  return (
    <nav className="session-sidebar">
      <div className="session-sidebar-top">
        <button className="session-new-btn" onClick={onNew} disabled={disabled} title="Nova conversa">
          + Nova conversa
        </button>
        <button className="session-collapse-btn" onClick={onToggleCollapse} title="Minimizar conversas">
          «
        </button>
      </div>
      <div className="session-list">
        {sessions.length === 0 && <div className="session-list-empty">Sem conversas ainda</div>}
        {sessions.map((s) => (
          <button
            key={s.id}
            className={`session-item ${s.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(s.id)}
            disabled={disabled}
            title={s.title}
          >
            {s.title || 'Nova conversa'}
          </button>
        ))}
      </div>
    </nav>
  );
}

// ── ResizeHandle ──────────────────────────────────────────────────────────────
function ResizeHandle({ onDrag }: { onDrag: (dx: number) => void }) {
  const startX = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;

    const onMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX.current;
      startX.current = ev.clientX;
      onDrag(dx);
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.classList.remove('resizing');
    };
    document.body.classList.add('resizing');
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return <div className="resize-handle" onMouseDown={onMouseDown} />;
}

// ── DesktopPanel ──────────────────────────────────────────────────────────────
function DesktopPanel({ isAgentThinking }: { isAgentThinking: boolean }) {
  // Same-origin: o Caddy roteia /novnc/* e /websockify* pro iagencia-desktop,
  // então isso funciona tanto atrás de HTTPS (cockpit.iagencia.app) quanto local.
  const novncUrl = '/novnc/vnc.html?path=websockify&autoconnect=true&resize=scale';
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const toggleFullscreen = () => {
    const el = iframeRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.();
    }
  };

  return (
    <div className="desktop-panel">
      <div className="desktop-header">
        <div className="desktop-header-title">
          <span className="desktop-live-dot" />
          Desktop Ubuntu — Ao Vivo
        </div>
        <div className="desktop-header-spacer" />
        {isAgentThinking && (
          <div className="header-status" style={{ marginRight: 8 }}>
            <div className="status-dot thinking" />
            <span style={{ color: 'var(--warning)', fontSize: 11 }}>Agente agindo</span>
          </div>
        )}
        <span className="desktop-resolution">1280 × 960</span>
        <button className="fullscreen-btn" onClick={toggleFullscreen} title="Tela cheia">⛶</button>
      </div>
      <iframe
        ref={iframeRef}
        className="desktop-iframe"
        src={novncUrl}
        title="Desktop Ubuntu — noVNC"
        allow="fullscreen"
      />
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError('Senha incorreta. Tente novamente.');
        return;
      }
      const { token } = await res.json() as { token: string };
      localStorage.setItem('cockpit_token', token);
      onLogin(token);
    } catch {
      setError('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">🌌</div>
          <div className="login-logo-text">
            <span className="login-logo-name">Open Infra Agent</span>
            <span className="login-logo-sub">Cockpit — Ambiente de Execução Autônomo</span>
          </div>
        </div>
        <h1 className="login-title">Bem-vindo de volta</h1>
        <p className="login-subtitle">Digite a senha para acessar o cockpit.</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <div>
            <label className="login-label" htmlFor="password">Senha de acesso</label>
            <input
              id="password"
              type="password"
              className="login-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              disabled={loading}
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-btn" disabled={loading || !password.trim()}>
            {loading ? 'Autenticando…' : 'Entrar no Cockpit'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('cockpit_token'));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [provider, setProvider] = useState<Provider>('codex');
  const [model, setModel] = useState('z-ai/glm-5.2');
  const sessionId = useRef(getOrCreateSessionId());
  const [activeSessionId, setActiveSessionId] = useState(sessionId.current);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // TTS: um único <audio> tocando por vez, com cache de blob URL por mensagem
  const [ttsPlayingId, setTtsPlayingId] = useState<string | null>(null);
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsCacheRef = useRef<Map<string, string>>(new Map());

  // Configurações (modelo/provedor) — escondidas atrás de um popover
  const [showSettings, setShowSettings] = useState(false);

  // Sidebar de conversas
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('cockpit_sidebar_collapsed') === '1',
  );

  // Larguras dos painéis — divisórias arrastáveis, persistidas
  const [sidebarWidth, setSidebarWidth] = useState(
    () => Number(localStorage.getItem('cockpit_sidebar_width')) || 200,
  );
  const [chatWidth, setChatWidth] = useState(
    () => Number(localStorage.getItem('cockpit_chat_width')) || 400,
  );

  useEffect(() => {
    localStorage.setItem('cockpit_sidebar_collapsed', sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);
  useEffect(() => {
    localStorage.setItem('cockpit_sidebar_width', String(sidebarWidth));
  }, [sidebarWidth]);
  useEffect(() => {
    localStorage.setItem('cockpit_chat_width', String(chatWidth));
  }, [chatWidth]);

  const resizeSidebar = useCallback((dx: number) => {
    setSidebarWidth((w) => Math.min(320, Math.max(160, w + dx)));
  }, []);
  const resizeChat = useCallback((dx: number) => {
    setChatWidth((w) => Math.min(640, Math.max(320, w + dx)));
  }, []);

  // Colar imagem
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [imageWarning, setImageWarning] = useState('');

  // Entrada de voz — grava no navegador (MediaRecorder) e transcreve no
  // servidor via Whisper local (/api/transcribe). Não depende dos servidores
  // de voz do Google como o webkitSpeechRecognition, que falha com "network"
  // em redes/VPNs que bloqueiam serviços do Google.
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [micError, setMicError] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  // Load config from server
  useEffect(() => {
    if (!token) return;
    fetch('/api/config', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((cfg: { provider: string; model: string }) => {
        if (cfg.provider) setProvider(cfg.provider as Provider);
        if (cfg.model) setModel(cfg.model);
      })
      .catch(() => {});
  }, [token]);

  // Restaura o histórico da conversa salva (sobrevive a F5 e reinício do servidor)
  useEffect(() => {
    if (!token) return;
    fetch(`/api/session/${sessionId.current}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: { messages?: ChatMessage[]; provider?: string; model?: string }) => {
        if (data.messages?.length) setMessages(data.messages);
        if (data.provider) setProvider(data.provider as Provider);
        if (data.model) setModel(data.model);
      })
      .catch(() => {});
  }, [token]);

  const refreshSessions = useCallback(() => {
    if (!token) return;
    fetch('/api/sessions', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: { sessions?: SessionSummary[] }) => setSessions(data.sessions || []))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  const switchSession = useCallback((id: string) => {
    if (sending || id === sessionId.current) return;
    sessionId.current = id;
    setActiveSessionId(id);
    localStorage.setItem(SESSION_ID_KEY, id);
    setMessages([]);
    if (!token) return;
    fetch(`/api/session/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: { messages?: ChatMessage[]; provider?: string; model?: string }) => {
        if (data.messages?.length) setMessages(data.messages);
        if (data.provider) setProvider(data.provider as Provider);
        if (data.model) setModel(data.model);
      })
      .catch(() => {});
  }, [sending, token]);

  const playTts = useCallback(async (msg: ChatMessage) => {
    if (!token || !msg.text) return;

    // Clicar de novo na mensagem que já está tocando = pausar
    if (ttsPlayingId === msg.id) {
      audioRef.current?.pause();
      setTtsPlayingId(null);
      return;
    }

    audioRef.current?.pause();
    setTtsPlayingId(null);

    let url = ttsCacheRef.current.get(msg.id);
    if (!url) {
      setTtsLoadingId(msg.id);
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text: msg.text }),
        });
        if (!res.ok) throw new Error('Falha ao gerar áudio');
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        ttsCacheRef.current.set(msg.id, url);
      } catch {
        setTtsLoadingId(null);
        return;
      }
      setTtsLoadingId(null);
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setTtsPlayingId(null);
    audio.onerror = () => setTtsPlayingId(null);
    setTtsPlayingId(msg.id);
    audio.play().catch(() => setTtsPlayingId(null));
  }, [token, ttsPlayingId]);

  // Troca para uma sessão nova em branco — a conversa anterior continua
  // salva no servidor e visível na sidebar.
  const startNewSession = useCallback(() => {
    if (sending) return;
    const id = safeSessionId();
    localStorage.setItem(SESSION_ID_KEY, id);
    sessionId.current = id;
    setActiveSessionId(id);
    setMessages([]);
  }, [sending]);

  // ── Colar imagem ──────────────────────────────────────────────────────────
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items).filter((i) => i.type.startsWith('image/'));
    if (items.length === 0) return;
    e.preventDefault();
    setImageWarning('');
    for (const item of items) {
      const file = item.getAsFile();
      if (!file) continue;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPendingImages((prev) => [...prev, { id: uid(), dataUrl: reader.result as string }]);
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const removePendingImage = useCallback((id: string) => {
    setPendingImages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ── Entrada de voz (grava e transcreve no servidor via Whisper local) ────
  const MAX_RECORDING_MS = 60_000;

  const startRecording = useCallback(async () => {
    setMicError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMicError('Seu navegador não suporta gravação de áudio.');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = (err as DOMException).name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setMicError('Permissão de microfone negada. Libere o acesso ao microfone nas configurações do site e tente de novo.');
      } else if (name === 'NotFoundError') {
        setMicError('Nenhum microfone encontrado. Verifique se há um microfone conectado.');
      } else {
        setMicError(`Não foi possível acessar o microfone: ${(err as Error).message}`);
      }
      return;
    }

    recordingStreamRef.current = stream;
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    audioChunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
      recordingStreamRef.current = null;
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      audioChunksRef.current = [];
      if (blob.size === 0 || !token) return;

      setTranscribing(true);
      try {
        const res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': mimeType, Authorization: `Bearer ${token}` },
          body: blob,
        });
        const data = (await res.json()) as { text?: string; error?: string };
        if (!res.ok) throw new Error(data.error || 'Falha ao transcrever áudio');
        if (data.text) {
          setInput((prev) => (prev.trim() ? `${prev.trim()} ${data.text}` : data.text!));
        } else {
          setMicError('Não entendi nada — tente falar mais alto ou mais perto do microfone.');
        }
      } catch (err) {
        setMicError(`Erro ao transcrever: ${(err as Error).message}`);
      } finally {
        setTranscribing(false);
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);

    // Corta sozinho depois de 1min pra não deixar o microfone preso ligado.
    window.setTimeout(() => {
      if (mediaRecorderRef.current === recorder && recorder.state === 'recording') recorder.stop();
    }, MAX_RECORDING_MS);
  }, [token]);

  const toggleRecording = useCallback(() => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    startRecording();
  }, [recording, startRecording]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  };

  const handleLogout = async () => {
    if (token) {
      await fetch('/api/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('cockpit_token');
    setToken(null);
    setMessages([]);
  };

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !token) return;

    if (pendingImages.length > 0 && !IMAGE_CAPABLE_PROVIDERS.includes(provider)) {
      setImageWarning(
        `O provedor "${provider}" não recebe imagem (roda via CLI, só texto). Troque pra nvidia/anthropic/openai/google nas configurações ou remova a imagem.`,
      );
      return;
    }

    const images = pendingImages.map((p) => p.dataUrl);
    setPendingImages([]);
    setImageWarning('');
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = '44px';
    setSending(true);

    const userMsgId = uid();
    const assistantMsgId = uid();

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', text, trace: [] },
      { id: assistantMsgId, role: 'assistant', text: '', trace: [], isStreaming: true },
    ]);

    const updateAssistant = (fn: (m: ChatMessage) => ChatMessage) => {
      setMessages((prev) => {
        const copy = [...prev];
        const idx = copy.findIndex((m) => m.id === assistantMsgId);
        if (idx === -1) return prev;
        copy[idx] = fn(copy[idx]);
        return copy;
      });
    };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: sessionId.current,
          message: text,
          provider,
          model: model || undefined,
          images: images.length ? images : undefined,
        }),
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      if (!res.body) {
        updateAssistant((m) => ({ ...m, isStreaming: false, text: '[Sem resposta do servidor]' }));
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

          const event = eventLine.slice('event: '.length).trim();
          let data: unknown;
          try { data = JSON.parse(dataLine.slice('data: '.length)); } catch { continue; }

          if (event === 'text-delta') {
            updateAssistant((m) => ({ ...m, text: m.text + (data as { text: string }).text }));
          } else if (event === 'tool-call') {
            const d = data as { toolName: string; args: unknown };
            updateAssistant((m) => ({
              ...m,
              trace: [...m.trace, { kind: 'tool-call', toolName: d.toolName, args: d.args }],
            }));
          } else if (event === 'tool-result') {
            const d = data as { toolName: string; result: unknown };
            updateAssistant((m) => ({
              ...m,
              trace: [...m.trace, { kind: 'tool-result', toolName: d.toolName, result: d.result }],
            }));
          } else if (event === 'error') {
            const d = data as { message: string };
            updateAssistant((m) => ({ ...m, text: `${m.text}\n[erro: ${d.message}]` }));
          }
        }
      }
    } catch (err) {
      updateAssistant((m) => ({
        ...m,
        text: `${m.text}\n[Erro de conexão: ${(err as Error).message}]`,
      }));
    } finally {
      updateAssistant((m) => ({ ...m, isStreaming: false }));
      setSending(false);
      textareaRef.current?.focus();
      refreshSessions();
    }
  }, [input, sending, token, provider, model, pendingImages, refreshSessions]);

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  return (
    <div className="cockpit">
      {/* ── Header ── */}
      <header className="cockpit-header">
        <div className="header-logo">
          <div className="header-logo-icon">🌌</div>
          <span className="header-logo-name">Open Infra Agent</span>
        </div>
        <div className="header-sep" />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cockpit</span>
        <div className="header-spacer" />
        <div className="header-status">
          <div className={`status-dot ${sending ? 'thinking' : ''}`} />
          <span>{sending ? 'Agente agindo…' : 'Pronto'}</span>
        </div>
        <div className="settings-wrap">
          <button
            className="header-icon-btn"
            onClick={() => setShowSettings((v) => !v)}
            title="Modelo e provedor"
          >
            ⚙
          </button>
          {showSettings && (
            <div className="settings-popover">
              <ModelBar
                provider={provider}
                model={model}
                disabled={sending}
                onProviderChange={setProvider}
                onModelChange={setModel}
              />
            </div>
          )}
        </div>
        <button className="header-logout-btn" onClick={handleLogout} title="Sair">
          ⎋ Sair
        </button>
      </header>

      {/* ── Body ── */}
      <div className="cockpit-body">
        <div
          className="session-sidebar-wrap"
          style={{ width: sidebarCollapsed ? undefined : sidebarWidth }}
        >
          <SessionSidebar
            sessions={sessions}
            activeId={activeSessionId}
            disabled={sending}
            collapsed={sidebarCollapsed}
            onSelect={switchSession}
            onNew={startNewSession}
            onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          />
        </div>
        {!sidebarCollapsed && <ResizeHandle onDrag={resizeSidebar} />}

        {/* ── Chat Panel ── */}
        <aside className="chat-panel" style={{ width: chatWidth }}>
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">🤖</div>
                <div className="empty-state-title">Agente pronto</div>
                <div className="empty-state-sub">
                  Descreva uma tarefa. O agente vai executá-la visivelmente no desktop ao vivo.
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`message-group ${msg.role}`}>
                <span className="message-role">
                  {msg.role === 'user' ? 'Você' : 'Agente'}
                </span>

                {/* Trace de ações */}
                {(msg.role === 'assistant') && (
                  <AgentTrace trace={msg.trace} isStreaming={msg.isStreaming} />
                )}

                {/* Typing indicator enquanto não tem texto ainda */}
                {msg.role === 'assistant' && msg.isStreaming && !msg.text && msg.trace.length === 0 && (
                  <div className="typing-indicator">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                )}

                {/* Texto da mensagem */}
                {msg.text && (
                  <div className="message-bubble-row">
                    {msg.role === 'assistant' ? (
                      <div className="message-bubble markdown-body" dangerouslySetInnerHTML={renderMarkdown(msg.text)} />
                    ) : (
                      <div className="message-bubble">{msg.text}</div>
                    )}
                    {msg.role === 'assistant' && !msg.isStreaming && (
                      <button
                        className="tts-play-btn"
                        onClick={() => playTts(msg)}
                        disabled={ttsLoadingId === msg.id}
                        title={ttsPlayingId === msg.id ? 'Pausar áudio' : 'Ouvir resposta (TTS)'}
                      >
                        {ttsLoadingId === msg.id ? '⏳' : ttsPlayingId === msg.id ? '⏸' : '▶'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="chat-input-area">
            {imageWarning && <div className="image-warning">{imageWarning}</div>}
            {micError && <div className="image-warning">{micError}</div>}
            {pendingImages.length > 0 && (
              <div className="pending-images">
                {pendingImages.map((img) => (
                  <div key={img.id} className="pending-image">
                    <img src={img.dataUrl} alt="anexo" />
                    <button
                      className="pending-image-remove"
                      onClick={() => removePendingImage(img.id)}
                      title="Remover imagem"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="chat-input-row">
              <textarea
                ref={textareaRef}
                className="chat-textarea"
                value={input}
                onChange={handleTextareaChange}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Descreva uma tarefa para o agente… (cole uma imagem com Ctrl+V)"
                disabled={sending}
                rows={1}
              />
              <button
                className={`mic-btn ${recording ? 'recording' : ''}`}
                onClick={toggleRecording}
                disabled={sending || transcribing}
                title={recording ? 'Parar gravação' : transcribing ? 'Transcrevendo…' : 'Falar (voz para texto)'}
              >
                {transcribing ? '⏳' : recording ? '⏹' : '🎤'}
              </button>
              <button
                id="send-btn"
                className="send-btn"
                onClick={send}
                disabled={sending || !input.trim()}
                title="Enviar (Enter)"
              >
                {sending ? '⏳' : '↑'}
              </button>
            </div>
            <p className="chat-hint">Enter para enviar · Shift+Enter para nova linha</p>
          </div>
        </aside>

        <ResizeHandle onDrag={resizeChat} />

        {/* ── Desktop Panel ── */}
        <DesktopPanel isAgentThinking={sending} />
      </div>
    </div>
  );
}
