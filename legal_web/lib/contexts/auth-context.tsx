"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useRouter } from "next/navigation"
import * as authApi from "@/lib/api/auth"
import { loginWithFirebase, type FirebaseLoginRequest } from "@/lib/api/firebase-auth"
import {
  AUTH_EXPIRED_EVENT,
  clearLegacyStoredTokens,
  getRefreshToken,
  primeAuthSession,
} from "@/lib/api/client"
import {
  clearLegacyPortalStorage,
} from "@/lib/portal/portal-session"
import type {
  ApiUser,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
} from "@/lib/api/types"
import { formatPersonName } from "@/lib/format-person-name"

function withFormattedName(user: ApiUser | null): ApiUser | null {
  if (!user?.name?.trim()) return user
  return { ...user, name: formatPersonName(user.name) }
}

interface AuthContextValue {
  user: ApiUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (data: LoginRequest) => Promise<AuthResponse>
  loginWithFirebase: (data: FirebaseLoginRequest) => Promise<AuthResponse>
  register: (data: RegisterRequest) => Promise<AuthResponse>
  logout: () => Promise<void>
  setUser: (user: ApiUser | null) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUserState] = useState<ApiUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const setUser = useCallback((next: ApiUser | null) => {
    setUserState(withFormattedName(next))
  }, [])

  useEffect(() => {
    let cancelled = false
    const timeout = setTimeout(() => {
      if (!cancelled) setIsLoading(false)
    }, 8000)

    clearLegacyStoredTokens()
    clearLegacyPortalStorage()
    authApi
      .fetchSession()
      .then((sessionUser) => {
        if (sessionUser) setUserState(withFormattedName(sessionUser))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
        clearTimeout(timeout)
      })

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [])

  useEffect(() => {
    const onAuthExpired = () => {
      setUserState(null)
      if (typeof window !== "undefined") {
        const path = window.location.pathname
        if (path.startsWith("/auth/") || path.startsWith("/portal/sign-in")) {
          return
        }
        window.location.assign("/auth")
      }
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired)
  }, [])

  useEffect(() => {
    if (isLoading || !user) return
    if (typeof window === "undefined") return
    const path = window.location.pathname
    if (user.mustChangePassword && !path.startsWith("/auth/change-password")) {
      window.location.assign("/auth/change-password/")
    }
  }, [user, isLoading])

  const login = useCallback(
    async (data: LoginRequest) => {
      const response = await authApi.login(data)
      await primeAuthSession()
      const verified = await authApi.fetchSession()
      setUser(verified ?? response.user)
      return response
    },
    [setUser],
  )

  const register = useCallback(
    async (data: RegisterRequest) => {
      const response = await authApi.register(data)
      await primeAuthSession()
      const verified = await authApi.fetchSession()
      setUser(verified ?? response.user)
      return response
    },
    [setUser],
  )

  const loginWithFirebaseToken = useCallback(
    async (data: FirebaseLoginRequest) => {
      const response = await loginWithFirebase(data)
      await primeAuthSession()
      const verified = await authApi.fetchSession()
      setUser(verified ?? response.user)
      return response
    },
    [setUser],
  )

  const logout = useCallback(async () => {
    await authApi.logout(getRefreshToken())
    setUser(null)
    if (typeof window !== "undefined") {
      window.location.assign("/")
    } else {
      router.push("/")
    }
  }, [setUser, router])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      loginWithFirebase: loginWithFirebaseToken,
      register,
      logout,
      setUser,
    }),
    [user, isLoading, login, loginWithFirebaseToken, register, logout, setUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
