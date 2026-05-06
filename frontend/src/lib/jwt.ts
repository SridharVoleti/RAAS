export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.')
  if (parts.length < 2) return {}

  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const json = globalThis.atob(padded)
  return JSON.parse(json) as Record<string, unknown>
}

export function jwtRole(token: string | null | undefined): string | null {
  if (!token) return null
  const payload = decodeJwtPayload(token)
  const role = payload.role
  return typeof role === 'string' ? role : null
}
