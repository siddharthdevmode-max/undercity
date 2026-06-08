import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

// ============================================================
// useAuth
// Lightweight consumer — all logic lives in AuthContext
// ============================================================

export function useAuth() {
  return useContext(AuthContext);
}
