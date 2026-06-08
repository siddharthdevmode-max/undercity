import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { crimesAPI } from "../services/crimes";
import { getLiveStats } from "../services/stats";
import { useAuth } from "./useAuth";
import { toast } from "../utils/toast";

// ============================================================
// GAME QUERY HOOKS
// Centralized server state using React Query
// Auto-refetch, caching, loading states built in
// ============================================================

// ── Query Keys (centralized — no typos) ───────────────────
export const QUERY_KEYS = {
  crimes:   ["crimes"]      as const,
  user:     ["user"]        as const,
  stats:    ["stats-live"]  as const,
  admin:    ["admin"]       as const,
} as const;

// ── User / Auth ────────────────────────────────────────────
// Reads from AuthContext — single source of truth.
// Do NOT call authAPI.me() here — would create two diverging sources.
export function useCurrentUser() {
  const { user, loading, error } = useAuth();
  return { data: user, isLoading: loading, error };
}

// ── Crimes ─────────────────────────────────────────────────
export function useCrimes() {
  return useQuery({
    queryKey:           QUERY_KEYS.crimes,
    queryFn:            () => crimesAPI.getCrimes(),
    staleTime:          30 * 1000,  // 30 seconds
    refetchOnWindowFocus: true,
  });
}

export function useAttemptCrime() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (crimeKey: string) => crimesAPI.attemptCrime(crimeKey),
    onSuccess:  (data) => {
      // Optimistically update crimes cache with new progress
      qc.setQueryData(QUERY_KEYS.crimes, (old: ReturnType<typeof crimesAPI.getCrimes> extends Promise<infer T> ? T : never) => {
        if (!old) return old;
        return {
          ...old,
          user: { ...old.user, ...data.user },
          crimes: old.crimes.map((c) =>
            c.key === data.crime.key
              ? { ...c, progress: { ...c.progress, ...data.progress } }
              : c
          ),
        };
      });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    },
  });
}

// ── Live Stats ─────────────────────────────────────────────
export function useLiveStats() {
  return useQuery({
    queryKey:         QUERY_KEYS.stats,
    queryFn:          getLiveStats,
    staleTime:        30 * 1000,
    refetchInterval:  30 * 1000, // Auto-refetch every 30s
  });
}
