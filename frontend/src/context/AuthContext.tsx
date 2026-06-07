import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { authAPI } from '../services/api';
import { ApiError } from '../utils/apiError';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const lastUidRef = useRef<string | null>(null);

  const fetchUser = async () => {
    try {
      setError(null);
      const data = await authAPI.me();
      setUser(data);
    } catch (err: unknown) {
      // 404 means Firebase user exists but DB record doesn't yet.
      // This happens during registration — Register.tsx will call sync()
      // and populate the user directly. Don't clear user / don't set error.
      if (err instanceof ApiError && err.statusCode === 404) {
        return;
      }

      // 403 means email not verified yet — happens right after signup.
      // Register.tsx handles the verification flow.
      // Don't show error, just leave user as null.
      if (err instanceof ApiError && err.statusCode === 403) {
        return;
      }

      setError('Failed to load player data');
      setUser(null);
    }
  };

  const refreshUser = async () => {
    await fetchUser();
  };

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

      // Only fetch user data from backend if email is verified.
      // Unverified users are in the registration flow and shouldn't hit /me yet.
      if (firebaseUser.emailVerified) {
        await fetchUser();
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// Exported separately — same file is fine since it's not a component
// Fast refresh warning is a false positive for context files
export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
