import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../firebase';
import { authAPI } from '../services/api';
import type { User } from '../types';

// Re-export User as Player for backward compat
export type Player = User;

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  user: Player | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  user:         null,
  loading:      true,
  error:        null,
  refreshUser:  async () => {},
  clearError:   () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user,         setUser]         = useState<Player | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  const fetchUserRef = useRef<(retryCount?: number) => Promise<void>>(async () => {});

  const fetchUser = useCallback(async (retryCount = 0): Promise<void> => {
    try {
      setError(null);
      const data = await authAPI.me();
      setUser(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';

      if (retryCount === 0) {
        await new Promise(r => setTimeout(r, 2000));
        return fetchUserRef.current(1);
      }

      setError('Failed to load player data');
      console.error('fetchUser failed:', message);
    }
  }, []);

  useEffect(() => {
    fetchUserRef.current = fetchUser;
  }, [fetchUser]);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        setLoading(true);
        await fetchUser();
        setLoading(false);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [fetchUser]);

  return (
    <AuthContext.Provider value={{ firebaseUser, user, loading, error, refreshUser, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}
