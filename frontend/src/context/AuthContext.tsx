import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../firebase';
import { api } from '../services/api';

interface Player {
  id: number;
  firebase_uid: string;
  username: string;
  email: string;
  level: number;
  money: number;
  points: number;
  nerve: number;
  max_nerve: number;
  life: number;
  max_life: number;
  energy: number;
  max_energy: number;
  happiness: number;
  jail_until: string | null;
  hospital_until: string | null;
  federal_jail_until: string | null;
  last_crime_at: string | null;
  onboarding_completed: boolean;
  is_admin: boolean;
  is_developer: boolean;
  is_moderator: boolean;
  created_at: string;
}

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

  // ── fetchUser — declared with useRef so it can self-reference
  // without the "accessed before declaration" ESLint error.
  // useRef holds the latest version of the function so the
  // retry call always gets the current closure.
  const fetchUserRef = useRef<(retryCount?: number) => Promise<void>>(async () => {});

  const fetchUser = useCallback(async (retryCount = 0): Promise<void> => {
    try {
      setError(null);
      const data = await api.get<Player>('/auth/me');
      setUser(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';

      if (retryCount === 0) {
        await new Promise(r => setTimeout(r, 2000));
        // Use ref to avoid "accessed before declared" lint error
        return fetchUserRef.current(1);
      }

      setError('Failed to load player data');
      console.error('fetchUser failed:', message);
    }
  }, []);

  // Keep ref in sync with latest fetchUser
  useEffect(() => {
    fetchUserRef.current = fetchUser;
  }, [fetchUser]);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ── Firebase auth state listener ──────────────────────────
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
