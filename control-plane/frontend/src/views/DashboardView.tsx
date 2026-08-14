import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import type { User, Workspace } from '../types';

const POLL_MS = 5000;
const HEARTBEAT_MS = 60_000;

const STATUS_LABEL: Record<Workspace['status'], string> = {
  NOT_PROVISIONED: 'Nunca iniciado',
  STOPPED: 'Parado',
  RUNNING: 'Rodando',
  ERROR: 'Erro',
};

export default function DashboardView({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { workspace: ws } = await api<{ workspace: Workspace }>('/workspace/status');
      setWorkspace(ws);
    } catch {
      // silencioso — o polling tenta de novo no próximo ciclo
    }
  }, []);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  // Heartbeat: mantém o workspace acordado enquanto esta aba está aberta e o
  // status é RUNNING — sem isso o loop de hibernação do backend para o
  // container por ociosidade mesmo com o cliente ativamente usando.
  useEffect(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (workspace?.status === 'RUNNING') {
      heartbeatRef.current = setInterval(() => {
        api('/workspace/heartbeat', { method: 'POST' }).catch(() => {});
      }, HEARTBEAT_MS);
    }
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [workspace?.status]);

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      await api('/workspace/start', { method: 'POST' });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro de conexão');
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    setError('');
    try {
      await api('/workspace/stop', { method: 'POST' });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro de conexão');
    } finally {
      setBusy(false);
    }
  };

  const status = workspace?.status ?? 'NOT_PROVISIONED';

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <span className="dashboard-logo">🌌 Open Infra Agent</span>
        <span className="dashboard-user">{user.email}</span>
        <button className="dashboard-logout-btn" onClick={onLogout}>
          Sair
        </button>
      </header>

      <main className="dashboard-main">
        <div className="workspace-card">
          <div className="workspace-status-row">
            <span className={`workspace-status-dot ${status.toLowerCase()}`} />
            <span className="workspace-status-label">{STATUS_LABEL[status]}</span>
          </div>

          {error && <div className="workspace-error">{error}</div>}

          <div className="workspace-actions">
            {status !== 'RUNNING' ? (
              <button className="workspace-start-btn" onClick={start} disabled={busy}>
                {busy ? 'Iniciando…' : '▶ Iniciar Workspace'}
              </button>
            ) : (
              <button className="workspace-stop-btn" onClick={stop} disabled={busy}>
                {busy ? 'Parando…' : '■ Parar Workspace'}
              </button>
            )}
          </div>

          {status === 'RUNNING' && (
            <p className="workspace-note">
              Seu workspace está rodando. O acesso direto ao Cockpit isolado ainda não está
              disponível nesta etapa — a rota externa pra ele é a próxima peça a ser construída.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
