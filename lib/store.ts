import { create } from 'zustand'
import type { User } from './types'
import { authApi } from './mock-api'

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

interface UIState {
  sidebarOpen: boolean
  commandPaletteOpen: boolean
  copilotDrawerOpen: boolean
  recordMeetingOpen: boolean
  recordingMeetingId: string | null
  setSidebarOpen: (open: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
  setCopilotDrawerOpen: (open: boolean) => void
  setRecordMeetingOpen: (open: boolean) => void
  setRecordingMeetingId: (id: string | null) => void
  toggleSidebar: () => void
  toggleCommandPalette: () => void
  toggleCopilotDrawer: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  commandPaletteOpen: false,
  copilotDrawerOpen: false,
  recordMeetingOpen: false,
  recordingMeetingId: null,
  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
  setCommandPaletteOpen: (open: boolean) => set({ commandPaletteOpen: open }),
  setCopilotDrawerOpen: (open: boolean) => set({ copilotDrawerOpen: open }),
  setRecordMeetingOpen: (open: boolean) => set({ recordMeetingOpen: open }),
  setRecordingMeetingId: (id: string | null) => set({ recordingMeetingId: id }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
  toggleCopilotDrawer: () => set((state) => ({ copilotDrawerOpen: !state.copilotDrawerOpen })),
}))

