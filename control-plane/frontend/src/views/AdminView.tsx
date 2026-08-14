import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { User, WorkspaceStatus } from '../types';

type AdminWorkspaceRow = {
  id: string;
  userId: string;
  userEmail: string;
  desktopContainerId: string | null;
  cockpitContainerId: string | null;
  status: WorkspaceStatus;
  port: number | null;
  lastActiveAt: string | null;
};

type HostStats = { totalMemMb: number; freeMemMb: number; loadAvg: number[]; cpus: number };

export default function AdminView({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceRow[]>([]);
  const [hostStats, setHostStats] = useState<HostStats | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [u, w, h] = await Promise.all([
      api<{ users: User[] }>('/admin/users'),
      api<{ workspaces: AdminWorkspaceRow[] }>('/admin/workspaces'),
      api<HostStats>('/admin/host-stats'),
    ]);
    setUsers(u.users);
    setWorkspaces(w.workspaces);
    setHostStats(h);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const withBusy = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await fn();
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const usedMemPct = hostStats ? Math.round(((hostStats.totalMemMb - hostStats.freeMemMb) / hostStats.totalMemMb) * 100) : 0;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <span className="dashboard-logo">🌌 Open Infra Agent</span>
        <span className="dashboard-user">{user.email} · admin</span>
        <button className="dashboard-logout-btn" onClick={onLogout}>
          Sair
        </button>
      </header>

      <main className="admin-main">
        {hostStats && (
          <section className="admin-card">
            <h2>Host</h2>
            <div className="host-stats-row">
              <div className={`host-stat ${usedMemPct > 85 ? 'critical' : usedMemPct > 65 ? 'warning' : ''}`}>
                <span className="host-stat-label">Memória</span>
                <span className="host-stat-value">
                  {usedMemPct}% ({hostStats.totalMemMb - hostStats.freeMemMb}MB / {hostStats.totalMemMb}MB)
                </span>
              </div>
              <div className="host-stat">
                <span className="host-stat-label">Load average</span>
                <span className="host-stat-value">{hostStats.loadAvg.map((n) => n.toFixed(2)).join(' / ')}</span>
              </div>
              <div className="host-stat">
                <span className="host-stat-label">CPUs</span>
                <span className="host-stat-value">{hostStats.cpus}</span>
              </div>
            </div>
          </section>
        )}

        <section className="admin-card">
          <h2>Usuários ({users.length})</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>
                    <span className={`badge ${u.status.toLowerCase()}`}>{u.status}</span>
                  </td>
                  <td className="admin-table-actions">
                    <button
                      disabled={busyId === u.id || u.status === 'APPROVED'}
                      onClick={() => withBusy(u.id, () => api(`/admin/users/${u.id}/approve`, { method: 'POST' }))}
                    >
                      Aprovar
                    </button>
                    <button
                      className="danger"
                      disabled={busyId === u.id || u.status === 'BLOCKED'}
                      onClick={() => withBusy(u.id, () => api(`/admin/users/${u.id}/block`, { method: 'POST' }))}
                    >
                      Bloquear
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="admin-card">
          <h2>Workspaces ({workspaces.length})</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Status</th>
                <th>Última atividade</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {workspaces.map((w) => (
                <tr key={w.id}>
                  <td>{w.userEmail}</td>
                  <td>
                    <span className={`badge ${w.status.toLowerCase()}`}>{w.status}</span>
                  </td>
                  <td>{w.lastActiveAt ? new Date(w.lastActiveAt).toLocaleString('pt-BR') : '—'}</td>
                  <td className="admin-table-actions">
                    <button
                      className="danger"
                      disabled={busyId === w.userId || w.status !== 'RUNNING'}
                      title="Encerramento forçado"
                      onClick={() =>
                        withBusy(w.userId, () => api(`/admin/workspaces/${w.userId}/stop`, { method: 'POST' }))
                      }
                    >
                      ⏻ Encerrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
