import { useState } from 'react';
import { api, setToken, ApiError } from '../api';
import type { User } from '../types';

export default function AuthView({ onAuthed }: { onAuthed: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const { token, user } = await api<{ token: string; user: User }>(path, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(token);
      onAuthed(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🌌</div>
          <div className="auth-logo-text">
            <span className="auth-logo-name">Open Infra Agent</span>
            <span className="auth-logo-sub">Painel — Control Plane</span>
          </div>
        </div>

        <div className="auth-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            Entrar
          </button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
            Criar conta
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <div>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              disabled={loading}
              required
            />
          </div>
          <div>
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              disabled={loading}
              required
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        {mode === 'register' && (
          <p className="auth-hint">
            Depois de criar a conta, um administrador precisa aprovar seu acesso antes que você
            possa iniciar seu workspace.
          </p>
        )}
      </div>
    </div>
  );
}
