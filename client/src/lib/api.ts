async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    // Attach extra info to the error object.
    (error as any).info = await res.json();
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