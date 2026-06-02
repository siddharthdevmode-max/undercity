import { useAuthContext } from '../context/AuthContext';

// ============================================================
// useAuth
// Lightweight consumer — all logic lives in AuthContext
// ============================================================

export function useAuth() {
  return useAuthContext();
}
