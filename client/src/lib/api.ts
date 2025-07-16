async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include', // CRITICAL: Include cookies for session authentication
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    // Handle 401 errors by logging out and redirecting to login
    if (res.status === 401) {
      // Clear any cached authentication data
      if (typeof window !== 'undefined') {
        try {
          await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include',
          });
        } catch (e) {
          // Ignore logout errors
        }
        
        // Redirect to login with current page as next parameter
        const currentPath = window.location.pathname;
        window.location.href = `/auth?next=${encodeURIComponent(currentPath)}`;
      }
      
      const error = new Error('Authentication required');
      (error as any).status = 401;
      throw error;
    }

    const error = new Error('An error occurred while fetching the data.');
    
    // Try to parse JSON response, but handle HTML gracefully
    try {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        (error as any).info = await res.json();
      } else {
        // If response is not JSON (e.g., HTML error page), use status text
        (error as any).info = { error: res.statusText || 'Unknown error' };
      }
    } catch (parseError) {
      // If JSON parsing fails, provide fallback error info
      (error as any).info = { error: res.statusText || 'Unknown error' };
    }
    
    (error as any).status = res.status;
    throw error;
  }

  return res.json();
}

export const api = {
  get: <T>(url: string, options?: RequestInit) => fetcher<T>(url, { ...options, method: 'GET' }),
  post: <T>(url: string, body: any, options?: RequestInit) => fetcher<T>(url, { ...options, method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(url: string, body: any, options?: RequestInit) => fetcher<T>(url, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(url: string, body: any, options?: RequestInit) => fetcher<T>(url, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(url: string, options?: RequestInit) => fetcher<T>(url, { ...options, method: 'DELETE' }),
}; 