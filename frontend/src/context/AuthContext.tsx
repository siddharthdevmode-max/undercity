import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { authAPI }          from '../services/api';
import { ApiError }         from '../utils/apiError';
import { identifyUser, resetAnalytics } from '../services/analytics';
import type { User }        from '../types';

interface AuthContextValue {
  user:        User | null;
  loading:     boolean;
  error:       string | null;
  refreshUser: () => Promise<void>;
  setUser:     (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUserState] = useState<User | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);

  const lastUidRef = useRef<string | null>(null);

  // ── setUser — wraps state + PostHog identity ──────────
  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (u) {
      identifyUser(u.firebaseUid, {
        level:    u.level,
        userTier: u.userTier,
      });
    } else {
      resetAnalytics();
    }
  }, []);

  // ── fetchUser — stable ref, safe in useEffect deps ───
  const fetchUser = useCallback(async () => {
    try {
      setError(null);
      const data = await authAPI.me();
      setUser(data);
    } catch (err: unknown) {
      // 404 — DB record doesn't exist yet (mid-registration)
      // Register.tsx calls sync() to create it — don't clear user
      if (err instanceof ApiError && err.statusCode === 404) return;

      // 403 — email not verified yet
      // Register.tsx handles verification flow
      if (err instanceof ApiError && err.statusCode === 403) return;

      setError('Failed to load player data');
      setUserState(null);
    }
  }, [setUser]);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        lastUidRef.current = null;
        return;
      }

      if (firebaseUser.uid === lastUidRef.current) {
        setLoading(false);
        return;
      }

      lastUidRef.current = firebaseUser.uid;
      setLoading(true);

      // Only fetch backend user if email is verified
      // Unverified users are still in registration flow
      if (firebaseUser.emailVerified) {
        await fetchUser();
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchUser, setUser]);

  return (
    <AuthContext.Provider value={{ user, loading, error, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
