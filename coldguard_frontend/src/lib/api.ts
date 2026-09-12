const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://coldguard-backend.onrender.com/api';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('coldguard_token');
}

export function getAuthUser(): any | null {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('coldguard_user');
  return user ? JSON.parse(user) : null;
}

export function setAuthSession(token: string, user: unknown) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('coldguard_token', token);
  localStorage.setItem('coldguard_user', JSON.stringify(user));
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('coldguard_token');
  localStorage.removeItem('coldguard_user');
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = Bearer ;
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : /;
  const response = await fetch(${API_BASE_URL}, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || API request failed with status );
  }

  return data as T;
}
