import { useQuery, useMutation, useQueryClient, QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface OptimizedQueryOptions<T> extends Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'> {
  // Enhanced caching options
  enableOfflineSupport?: boolean;
  backgroundSync?: boolean;
  optimisticUpdates?: boolean;
  
  // Performance options
  debounceMs?: number;
  throttleMs?: number;
  prefetchRelated?: QueryKey[];
  
  // Cache invalidation strategies
  invalidateOnMutation?: string[];
  invalidateOnWebSocket?: string[];
  
  // Tenant isolation
  tenantSpecific?: boolean;
  
  // Real-time options
  realTimeUpdates?: boolean;
  pollingInterval?: number;
}

interface OptimizedMutationOptions {
  optimisticUpdate?: (oldData: any, variables: any) => any;
  invalidateQueries?: QueryKey[];
  updateQueries?: { queryKey: QueryKey; updater: (oldData: any, variables: any) => any }[];
  rollbackOnError?: boolean;
}

// Cache strategy configurations
const CACHE_STRATEGIES = {
  FREQUENT_READS: {
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
  STATIC_DATA: {
    staleTime: 600000, // 10 minutes
    gcTime: 3600000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  },
  REAL_TIME: {
    staleTime: 0,
    gcTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
  TENANT_ISOLATED: {
    staleTime: 0, // Always fresh to prevent cross-tenant data leaks
    gcTime: 30000, // Short cache for security
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
};

// Debounce utility
function useDebounced<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Optimized query hook
export function useOptimizedQuery<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  options: OptimizedQueryOptions<T> = {}
) {
  const queryClient = useQueryClient();
  const lastFetchTime = useRef<number>(0);
  
  const {
    enableOfflineSupport = false,
    backgroundSync = true,
    optimisticUpdates = false,
    debounceMs = 0,
    throttleMs = 0,
    prefetchRelated = [],
    invalidateOnMutation = [],
    invalidateOnWebSocket = [],
    tenantSpecific = true,
    realTimeUpdates = false,
    pollingInterval,
    ...queryOptions
  } = options;

  // Determine cache strategy
  const cacheStrategy = useMemo(() => {
    if (tenantSpecific) return CACHE_STRATEGIES.TENANT_ISOLATED;
    if (realTimeUpdates) return CACHE_STRATEGIES.REAL_TIME;
    if (queryOptions.staleTime && typeof queryOptions.staleTime === 'number' && queryOptions.staleTime > 300000) return CACHE_STRATEGIES.STATIC_DATA;
    return CACHE_STRATEGIES.FREQUENT_READS;
  }, [tenantSpecific, realTimeUpdates, queryOptions.staleTime]);

  // Enhanced query function with throttling
  const enhancedQueryFn = useCallback(async () => {
    const now = Date.now();
    
    // Throttle requests if specified
    if (throttleMs > 0 && now - lastFetchTime.current < throttleMs) {
      const cached = queryClient.getQueryData(queryKey);
      if (cached) return cached as T;
    }
    
    lastFetchTime.current = now;
    
    try {
      const result = await queryFn();
      
      // Prefetch related queries in the background
      if (prefetchRelated.length > 0) {
        prefetchRelated.forEach(relatedKey => {
          queryClient.prefetchQuery({
            queryKey: relatedKey,
            staleTime: cacheStrategy.staleTime,
          });
        });
      }
      
      return result;
    } catch (error) {
      // Handle offline support
      if (enableOfflineSupport) {
        const cachedData = queryClient.getQueryData(queryKey);
        if (cachedData) {
          console.warn('Using cached data due to network error:', error);
          return cachedData as T;
        }
      }
      throw error;
    }
  }, [queryFn, queryKey, queryClient, throttleMs, prefetchRelated, enableOfflineSupport, cacheStrategy.staleTime]);

  // Apply debouncing if specified
  const debouncedKey = debounceMs > 0 ? useDebounced(queryKey, debounceMs) : queryKey;

  // Main query
  const query = useQuery({
    queryKey: debouncedKey,
    queryFn: enhancedQueryFn,
    ...cacheStrategy,
    ...queryOptions,
    refetchInterval: pollingInterval || (realTimeUpdates ? 15000 : false),
  });

  // Background sync for when the tab becomes visible
  useEffect(() => {
    if (!backgroundSync) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const dataAge = Date.now() - (query.dataUpdatedAt || 0);
        if (dataAge > (cacheStrategy.staleTime || 0)) {
          query.refetch();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [backgroundSync, query, cacheStrategy.staleTime]);

  // Set up query invalidation listeners
  useEffect(() => {
    if (invalidateOnMutation.length === 0 && invalidateOnWebSocket.length === 0) return;

    const unsubscribers: (() => void)[] = [];

    // Listen for mutation events
    invalidateOnMutation.forEach(mutationKey => {
      const unsubscribe = queryClient.getMutationCache().subscribe((event: any) => {
        if (event.type === 'updated' && event.mutation.options.mutationKey?.includes(mutationKey)) {
          if (event.mutation.state.status === 'success') {
            queryClient.invalidateQueries({ queryKey });
          }
        }
      });
      unsubscribers.push(unsubscribe);
    });

    // Listen for WebSocket events (if available)
    if (typeof window !== 'undefined' && (window as any).notificationSocket) {
      const socket = (window as any).notificationSocket;
      
      const handleWebSocketMessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          if (invalidateOnWebSocket.includes(message.type)) {
            queryClient.invalidateQueries({ queryKey });
          }
        } catch (error) {
          console.warn('Failed to parse WebSocket message:', error);
        }
      };

      socket.addEventListener('message', handleWebSocketMessage);
      unsubscribers.push(() => socket.removeEventListener('message', handleWebSocketMessage));
    }

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [invalidateOnMutation, invalidateOnWebSocket, queryClient, queryKey]);

  return query;
}

// Optimized mutation hook
export function useOptimizedMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: OptimizedMutationOptions = {}
) {
  const queryClient = useQueryClient();
  
  const {
    optimisticUpdate,
    invalidateQueries = [],
    updateQueries = [],
    rollbackOnError = true,
  } = options;

  return useMutation({
    mutationFn,
    onMutate: async (variables: any) => {
      const rollbackData: { queryKey: QueryKey; previousData: any }[] = [];

      // Apply optimistic updates
      if (optimisticUpdate) {
        for (const { queryKey, updater } of updateQueries) {
          await queryClient.cancelQueries({ queryKey });
          const previousData = queryClient.getQueryData(queryKey);
          
          if (previousData) {
            rollbackData.push({ queryKey, previousData });
            queryClient.setQueryData(queryKey, updater(previousData, variables));
          }
        }
      }

      return { rollbackData };
    },
    onError: (error: any, variables: any, context: any) => {
      // Rollback optimistic updates on error
      if (rollbackOnError && context?.rollbackData) {
        context.rollbackData.forEach(({
          queryKey,
          previousData
        }: any) => {
          queryClient.setQueryData(queryKey, previousData);
        });
      }
    },
    onSuccess: (data: any, variables: any) => {
      // Update related queries
      updateQueries.forEach(({ queryKey, updater }) => {
        queryClient.setQueryData(queryKey, (oldData: any) => {
          if (oldData) {
            return updater(oldData, variables);
          }
          return oldData;
        });
      });
    },
    onSettled: () => {
      // Invalidate specified queries
      invalidateQueries.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });
    },
  });
}

// Calendar-specific optimized hooks
export function useCalendarQuery(facilityId?: number, options: OptimizedQueryOptions<any> = {}) {
  return useOptimizedQuery(
    ['/api/schedules', facilityId],
    async () => {
      const url = facilityId ? `/api/schedules?facilityId=${facilityId}` : '/api/schedules';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch schedules');
      return response.json();
    },
    {
      realTimeUpdates: true,
      invalidateOnWebSocket: ['schedule_update', 'schedule_created', 'schedule_deleted'],
      prefetchRelated: [['/api/facilities'], ['/api/appointment-types']],
      tenantSpecific: true,
      ...options,
    }
  );
}

export function useNotificationsQuery(options: OptimizedQueryOptions<any> = {}) {
  return useOptimizedQuery(
    ['/api/notifications/enhanced'],
    async () => {
      const response = await fetch('/api/notifications/enhanced');
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
    {
      realTimeUpdates: true,
      pollingInterval: 15000,
      invalidateOnWebSocket: ['notification_created', 'notification_updated'],
      tenantSpecific: true,
      enableOfflineSupport: true,
      ...options,
    }
  );
}

// Performance monitoring utilities
export function useQueryPerformance(queryKey: QueryKey) {
  const queryClient = useQueryClient();
  const [metrics, setMetrics] = useState({
    fetchCount: 0,
    averageTime: 0,
    errorRate: 0,
    cacheHitRate: 0,
  });

  useEffect(() => {
    const startTime = performance.now();
    let fetchCount = 0;
    let totalTime = 0;
    let errorCount = 0;
    let cacheHits = 0;

    const unsubscribe = queryClient.getQueryCache().subscribe((event: any) => {
      if (event.query.queryKey === queryKey) {
        if (event.type === 'updated') {
          fetchCount++;
          
          if (event.query.state.status === 'success') {
            const endTime = performance.now();
            totalTime += endTime - startTime;
            
            // Check if data came from cache
            if (event.query.state.dataUpdatedAt && event.query.state.dataUpdatedAt < startTime) {
              cacheHits++;
            }
          } else if (event.query.state.status === 'error') {
            errorCount++;
          }

          setMetrics({
            fetchCount,
            averageTime: fetchCount > 0 ? totalTime / fetchCount : 0,
            errorRate: fetchCount > 0 ? errorCount / fetchCount : 0,
            cacheHitRate: fetchCount > 0 ? cacheHits / fetchCount : 0,
          });
        }
      }
    });

    return unsubscribe;
  }, [queryClient, queryKey]);

  return metrics;
} 