import { create } from 'zustand'
import type { User } from './types'
import { authApi } from './mock-api'
import {
  persistSidebarMinimizedPreference,
  readSidebarMinimizedPreference,
} from './ui/sidebar-preferences'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithOTP: (email: string, otp: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  login: async (email: string, password: string) => {
    set({ loading: true })
    try {
      const user = await authApi.login(email, password)
      set({ user, loading: false })
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },
  loginWithOTP: async (email: string, otp: string) => {
    set({ loading: true })
    try {
      const user = await authApi.loginWithOTP(email, otp)
      set({ user, loading: false })
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },
  logout: async () => {
    await authApi.logout()
    set({ user: null })
  },
  setUser: (user: User | null) => set({ user }),
}))

type DashboardWindow = "today" | "week" | "month"

interface UIState {
  sidebarOpen: boolean
  /** Desktop sidebar collapsed to icon-only rail */
  sidebarMinimized: boolean
  /** Consumer app mobile nav drawer */
  consumerSidebarOpen: boolean
  commandPaletteOpen: boolean
  copilotDrawerOpen: boolean
  recordMeetingOpen: boolean
  recordingMeetingId: string | null
  /** Pre-fill record modal when opening from matter/client page */
  initialRecordClientId: string | null
  initialRecordMatterId: string | null
  /** Dashboard time window selected in the topbar filter */
  dashboardWindow: DashboardWindow
  /** One-shot prompt to prefill the copilot composer (e.g. from dashboard actions) */
  copilotPrompt: string | null
  setSidebarOpen: (open: boolean) => void
  setConsumerSidebarOpen: (open: boolean) => void
  setSidebarMinimized: (minimized: boolean) => void
  toggleSidebarMinimized: () => void
  setCommandPaletteOpen: (open: boolean) => void
  setCopilotDrawerOpen: (open: boolean) => void
  setCopilotPrompt: (prompt: string | null) => void
  openCopilotWithPrompt: (prompt: string) => void
  setRecordMeetingOpen: (open: boolean) => void
  setRecordingMeetingId: (id: string | null) => void
  setInitialRecordContext: (clientId: string | null, matterId: string | null) => void
  setDashboardWindow: (window: DashboardWindow) => void
  toggleSidebar: () => void
  toggleCommandPalette: () => void
  toggleCopilotDrawer: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  sidebarMinimized: false,
  consumerSidebarOpen: false,
  commandPaletteOpen: false,
  copilotDrawerOpen: false,
  recordMeetingOpen: false,
  recordingMeetingId: null,
  initialRecordClientId: null,
  initialRecordMatterId: null,
  dashboardWindow: "today",
  copilotPrompt: null,
  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
  setConsumerSidebarOpen: (open: boolean) => set({ consumerSidebarOpen: open }),
  setSidebarMinimized: (minimized: boolean) => {
    persistSidebarMinimizedPreference(minimized)
    set({ sidebarMinimized: minimized })
  },
  toggleSidebarMinimized: () =>
    set((state) => {
      const next = !state.sidebarMinimized
      persistSidebarMinimizedPreference(next)
      return { sidebarMinimized: next }
    }),
  setCommandPaletteOpen: (open: boolean) => set({ commandPaletteOpen: open }),
  setCopilotDrawerOpen: (open: boolean) => set({ copilotDrawerOpen: open }),
  setCopilotPrompt: (prompt: string | null) => set({ copilotPrompt: prompt }),
  openCopilotWithPrompt: (prompt: string) =>
    set({ copilotPrompt: prompt, copilotDrawerOpen: true }),
  setRecordMeetingOpen: (open: boolean) => set({ recordMeetingOpen: open }),
  setRecordingMeetingId: (id: string | null) => set({ recordingMeetingId: id }),
  setInitialRecordContext: (clientId: string | null, matterId: string | null) =>
    set({ initialRecordClientId: clientId, initialRecordMatterId: matterId }),
  setDashboardWindow: (window: DashboardWindow) => set({ dashboardWindow: window }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
  toggleCopilotDrawer: () => set((state) => ({ copilotDrawerOpen: !state.copilotDrawerOpen })),
}))

