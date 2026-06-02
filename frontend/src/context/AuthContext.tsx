import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { authAPI } from '../services/api';
import type { User } from '../types';

// ============================================================
// AUTH CONTEXT
// Single Firebase listener for the whole app
// authAPI.me() only fires when the Firebase UID actually changes
// ============================================================

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Track the last UID we fetched for — prevents refetch on token refresh
  const lastUidRef = useRef<string | null>(null);

  const fetchUser = async () => {
    try {
      setError(null);
      const data = await authAPI.me();
      setUser(data);
    } catch (err) {
      setError('Failed to load player data');
      setUser(null);
    }
  };

  // Called externally when stats need a hard refresh (e.g. level up)
  const refreshUser = async () => {
    await fetchUser();
  };

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // User logged out
        setUser(null);
        setLoading(false);
        lastUidRef.current = null;
        return;
      }

      // Only hit the API if the UID actually changed
      // Prevents hammering /auth/me on every Firebase token refresh
      if (firebaseUser.uid === lastUidRef.current) {
        setLoading(false);
        return;
      }

      lastUidRef.current = firebaseUser.uid;
      setLoading(true);
      await fetchUser();
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
