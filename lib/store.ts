import { create } from 'zustand'
import type { User } from './types'
import { authApi } from './mock-api'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
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
  logout: async () => {
    await authApi.logout()
    set({ user: null })
  },
  setUser: (user: User | null) => set({ user }),
}))

interface UIState {
  sidebarOpen: boolean
  commandPaletteOpen: boolean
  setSidebarOpen: (open: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
  toggleSidebar: () => void
  toggleCommandPalette: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  commandPaletteOpen: false,
  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
  setCommandPaletteOpen: (open: boolean) => set({ commandPaletteOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
}))

