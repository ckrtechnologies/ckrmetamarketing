const API_BASE = '/api';

function getToken() { return localStorage.getItem('ckr_token'); }
function setToken(t) { localStorage.setItem('ckr_token', t); }
function clearToken() { localStorage.removeItem('ckr_token'); }

async function apiCall(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function register({ org_name, email, password, name }) {
  const data = await apiCall('POST', '/auth/register', { org_name, email, password, name });
  if (data.token) setToken(data.token);
  return data;
}

export async function login({ email, password }) {
  const data = await apiCall('POST', '/auth/login', { email, password });
  if (data.token) setToken(data.token);
  return data;
}

export async function getMe() {
  return apiCall('GET', '/auth/me');
}

export async function invite({ email, name, role }) {
  return apiCall('POST', '/auth/invite', { email, name, role });
}

export function logout() { clearToken(); }
export function isLoggedIn() { return !!getToken(); }

export { apiCall };
