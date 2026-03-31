const API = '/api';

async function request(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...opts.headers },
  });
  if (res.status === 401) { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = '/login'; throw new Error('Sessao expirada'); }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data as any)?.error || 'Erro na requisicao');
  return data;
}

export const api = {
  get: (p: string) => request(p),
  post: (p: string, b?: any) => request(p, { method: 'POST', body: JSON.stringify(b) }),
  put: (p: string, b?: any) => request(p, { method: 'PUT', body: JSON.stringify(b) }),
  del: (p: string, b?: any) => request(p, { method: 'DELETE', body: b ? JSON.stringify(b) : undefined }),
  delete: (p: string, b?: any) => request(p, { method: 'DELETE', body: b ? JSON.stringify(b) : undefined }),
};
