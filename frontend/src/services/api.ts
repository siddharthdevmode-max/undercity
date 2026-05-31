import { getAuth } from 'firebase/auth';

const API_URL = 'http://localhost:5000/api';

const getFirebaseToken = async (): Promise<string | null> => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken();
};

export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = await getFirebaseToken();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error || 'API Error');
  }

  return response.json();
};

// Public endpoint — no auth needed
export const checkUsernameAvailable = async (username: string) => {
  const res = await fetch(`${API_URL}/auth/check-username/${encodeURIComponent(username)}`);
  return res.json();
};

export const authAPI = {
  sync: (username?: string) =>
    apiCall('/auth/sync', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  getMe: () => apiCall('/auth/me'),
};
