import {QueryClient} from '@tanstack/react-query';

// =============================================================================
// REACT QUERY CONFIGURATION
// =============================================================================

/**
 * Global React Query client configuration.
 *
 * Provides sensible defaults for caching, retries, and refetching behaviour
 * across the application. Imported by App.tsx (QueryClientProvider) and by
 * {@link cancelProjectQueries} in remoteProjectRemoval.ts (notebook removal).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Queries are enabled by default
      enabled: true,

      // Retry failed queries up to 3 times with exponential backoff
      retry: 3,

      // Consider data fresh for 30 seconds before background refetch
      staleTime: 30000,

      // Refetch when component mounts if data is stale
      refetchOnMount: true,

      // Don't refetch on window focus (can be noisy on mobile)
      refetchOnWindowFocus: false,

      // Refetch when network reconnects (important for offline-first)
      refetchOnReconnect: true,

      // Always default to running queries with network mode always - as most
      // queries are to Pouch - can be overridden for network only queries
      networkMode: 'always',
    },
    mutations: {
      // Don't retry mutations - let the user explicitly retry on failure
      retry: 0,
    },
  },
});
