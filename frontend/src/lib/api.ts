export type ApiError = {
  error: string
}

function _apiBase(): string {
  const envBase = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE
  const devFallbackBase = (import.meta as unknown as { env?: Record<string, unknown> }).env?.DEV
    ? 'http://127.0.0.1:5000'
    : ''
  return envBase || devFallbackBase
}

export async function apiUpload<T>(path: string, form: FormData, token?: string | null): Promise<T> {
  const apiBase = _apiBase()
  const url = apiBase && path.startsWith('/api/') ? `${apiBase}${path}` : path

  const res = await fetch(url, {
    method: 'POST',
    body: form,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null
    throw new Error(body?.error || `http_${res.status}`)
  }

  return (await res.json()) as T
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string | null },
): Promise<T> {
  const apiBase = _apiBase()
  const url = apiBase && path.startsWith('/api/') ? `${apiBase}${path}` : path

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
      ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null
    throw new Error(body?.error || `http_${res.status}`)
  }

  return (await res.json()) as T
}
