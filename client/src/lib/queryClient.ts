import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: { useFormData?: boolean }
): Promise<Response> {
  // Determine if we're sending FormData
  const isFormData = options?.useFormData && data instanceof FormData;
  
  // Prepare headers
  const headers: Record<string, string> = {};
  
  // Don't set content-type for FormData as the browser sets it with boundary
  if (!isFormData && data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Don't stringify FormData
  const body = isFormData 
    ? data 
    : (data ? JSON.stringify(data) : undefined);
  
  const res = await fetch(url, {
    method,
    headers,
    body: body as BodyInit | undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Make TypeScript aware of our global queryClient attached to window
declare global {
  interface Window {
    queryClient: QueryClient;
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Make queryClient globally available for components to use
// This helps when a component isn't in the React Query provider tree
// or when we need to invalidate queries from outside React components
window.queryClient = queryClient;
