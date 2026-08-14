const TOKEN_KEY = 'control_plane_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Fetch wrapper único: injeta o Bearer token e trata 401 de forma central —
// evita repetir esse boilerplate em cada view (mesmo espírito do requireAuth
// do backend, só que do lado do cliente).
export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new ApiError(401, 'Não autenticado');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error || `Erro ${res.status}`);
  }
  return data as T;
}
