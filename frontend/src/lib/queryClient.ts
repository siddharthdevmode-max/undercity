import { QueryClient } from "@tanstack/react-query";

// ============================================================
// REACT QUERY CLIENT
// Centralized server state management
// Replaces manual useState + useEffect fetch patterns
// ============================================================

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale after 30 seconds
      staleTime:            30 * 1000,
      // Cache for 5 minutes
      gcTime:               5 * 60 * 1000,
      // Retry failed requests 2 times
      retry:                2,
      retryDelay:           (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      // Refetch on window focus (good for game state)
      refetchOnWindowFocus: true,
      // Don't refetch on reconnect by default
      refetchOnReconnect:   true,
    },
    mutations: {
      retry: 1,
    },
  },
});
