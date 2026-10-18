"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { io, type Socket } from "socket.io-client"
import { useQueryClient } from "@tanstack/react-query"
import { resolveAccessToken } from "@/lib/api/client"
import { getRealtimeSocketUrl } from "@/lib/api/api-base"
import { useAuth } from "@/lib/contexts/auth-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import {
  REALTIME_EVENTS,
  type RealtimeConnectionStatus,
  type RealtimeEventName,
  type RealtimeEventPayload,
} from "@/lib/realtime/events"
import { invalidateQueriesForRealtimeEvent } from "@/lib/realtime/event-handlers"

interface RealtimeContextValue {
  status: RealtimeConnectionStatus
  subscribe: (
    event: RealtimeEventName,
    handler: (payload: RealtimeEventPayload) => void,
  ) => () => void
}

const RealtimeContext = createContext<RealtimeContextValue | undefined>(undefined)

const ALL_EVENTS = Object.values(REALTIME_EVENTS)

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()
  const { activeTenantId } = useTenant()
  const [status, setStatus] = useState<RealtimeConnectionStatus>("disconnected")
  const socketRef = useRef<Socket | null>(null)
  const handlersRef = useRef<
    Map<string, Set<(payload: RealtimeEventPayload) => void>>
  >(new Map())

  const subscribe = useCallback(
    (event: RealtimeEventName, handler: (payload: RealtimeEventPayload) => void) => {
      if (!handlersRef.current.has(event)) {
        handlersRef.current.set(event, new Set())
      }
      handlersRef.current.get(event)!.add(handler)
      return () => {
        handlersRef.current.get(event)?.delete(handler)
      }
    },
    [],
  )

  useEffect(() => {
    if (!isAuthenticated || !activeTenantId) {
      socketRef.current?.disconnect()
      socketRef.current = null
      setStatus("disconnected")
      return
    }

    let cancelled = false

    void resolveAccessToken().then((token) => {
      if (cancelled || !token) {
        setStatus("disconnected")
        return
      }

      setStatus("connecting")

      const socket = io(`${getRealtimeSocketUrl()}/realtime`, {
        transports: ["websocket", "polling"],
        auth: { token, tenantId: activeTenantId },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      })

      socketRef.current = socket

      const markConnected = () => setStatus("connected")

      socket.on("connect", markConnected)
      socket.on("connected", markConnected)
      socket.io.on("reconnect_attempt", () => setStatus("reconnecting"))
      socket.io.on("reconnect_failed", () => setStatus("disconnected"))
      socket.on("disconnect", () => setStatus("disconnected"))
      socket.on("connect_error", () => setStatus("reconnecting"))

      const dispatch = (event: string, payload: RealtimeEventPayload) => {
        invalidateQueriesForRealtimeEvent(
          queryClient,
          event,
          payload,
          activeTenantId,
        )
        handlersRef.current.get(event)?.forEach((handler) => handler(payload))
      }

      ALL_EVENTS.forEach((event: RealtimeEventName) => {
        socket.on(event, (payload: RealtimeEventPayload) => dispatch(event, payload))
      })
    })

    return () => {
      cancelled = true
      const socket = socketRef.current
      if (socket) {
        ALL_EVENTS.forEach((event: RealtimeEventName) => socket.off(event))
        socket.disconnect()
        socketRef.current = null
      }
    }
  }, [isAuthenticated, activeTenantId, queryClient])

  const value = useMemo(
    () => ({ status, subscribe }),
    [status, subscribe],
  )

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  )
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext)
  if (!ctx) {
    throw new Error("useRealtime must be used within RealtimeProvider")
  }
  return ctx
}

export function useRealtimeEvent(
  event: RealtimeEventName,
  handler: (payload: RealtimeEventPayload) => void,
) {
  const { subscribe } = useRealtime()

  useEffect(() => subscribe(event, handler), [event, handler, subscribe])
}
