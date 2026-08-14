import { useEffect, useState } from 'react';
import { api, getToken, clearToken } from './api';
import type { User } from './types';
import AuthView from './views/AuthView';
import PendingView from './views/PendingView';
import BlockedView from './views/BlockedView';
import DashboardView from './views/DashboardView';
import AdminView from './views/AdminView';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Admin também pode ver o próprio workspace, não só o painel de gestão.
  const [adminView, setAdminView] = useState<'admin' | 'workspace'>('admin');

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api<{ user: User }>('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    clearToken();
    setUser(null);
  };

  if (loading) {
    return <div className="app-loading">Carregando…</div>;
  }

  if (!user) {
    return <AuthView onAuthed={setUser} />;
  }

  if (user.status === 'BLOCKED') {
    return <BlockedView onLogout={handleLogout} />;
  }

  if (user.status === 'PENDING') {
    return <PendingView email={user.email} onLogout={handleLogout} />;
  }

  if (user.role === 'ADMIN') {
    return (
      <div>
        <div className="admin-view-toggle">
          <button className={adminView === 'admin' ? 'active' : ''} onClick={() => setAdminView('admin')}>
            Painel Admin
          </button>
          <button className={adminView === 'workspace' ? 'active' : ''} onClick={() => setAdminView('workspace')}>
            Meu Workspace
          </button>
        </div>
        {adminView === 'admin' ? (
          <AdminView user={user} onLogout={handleLogout} />
        ) : (
          <DashboardView user={user} onLogout={handleLogout} />
        )}
      </div>
    );
  }

  return <DashboardView user={user} onLogout={handleLogout} />;
}
