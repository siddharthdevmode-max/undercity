import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { crimesAPI } from "../services/crimes";
import { getLiveStats } from "../services/stats";
import { useAuth } from "./useAuth";
import { toast } from "../utils/toast";

// ============================================================
// GAME QUERY HOOKS — React Query wrappers
// These hooks are ready to use in Phase 2 Week 3.
// Currently crimes/ uses local state — migrate to useCrimes()
// when adding React Query caching to the crimes page.
// ============================================================

export const QUERY_KEYS = {
  crimes: ["crimes"]     as const,
  user:   ["user"]       as const,
  stats:  ["stats-live"] as const,
  admin:  ["admin"]      as const,
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
    queryKey:             QUERY_KEYS.crimes,
    queryFn:              () => crimesAPI.getCrimes(),
    staleTime:            30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useAttemptCrime() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (crimeKey: string) => crimesAPI.attemptCrime(crimeKey),
    onSuccess: (data) => {
      qc.setQueryData(
        QUERY_KEYS.crimes,
        (old: Awaited<ReturnType<typeof crimesAPI.getCrimes>> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            user:   { ...old.user, ...data.user },
            crimes: old.crimes.map((c) =>
              c.key === data.crime.key
                ? { ...c, progress: { ...c.progress, ...data.progress } }
                : c
            ),
          };
        }
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    },
  });
}

// ── Live Stats ─────────────────────────────────────────────
export function useLiveStats() {
  return useQuery({
    queryKey:        QUERY_KEYS.stats,
    queryFn:         getLiveStats,
    staleTime:       30 * 1000,
    refetchInterval: 30 * 1000,
  });
}
