const BASE = import.meta.env.VITE_API_BASE ?? '';

export const getToken = () => localStorage.getItem('token');
export const getUser = () => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } };

export async function api(path, method = 'GET', body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && getToken()) {
    localStorage.clear();
    window.location.href = '/';
    throw new Error('Session expired, please login again');
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const streamUrl = () => `${BASE}/api/stream?token=${encodeURIComponent(getToken() || '')}`;
