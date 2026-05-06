import { createContext, useContext, useMemo, useState } from 'react'

type AuthState = {
  token: string | null
  setToken: (token: string | null) => void
}

const AuthContext = createContext<AuthState | null>(null)

const TOKEN_KEY = 'raas_token'

export function AuthProvider(props: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY)
  })

  const setToken = (next: string | null) => {
    if (next) {
      localStorage.setItem(TOKEN_KEY, next)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
    setTokenState(next)
  }

  const value = useMemo<AuthState>(() => ({ token, setToken }), [token])

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('AuthProvider is missing')
  }
  return ctx
}
