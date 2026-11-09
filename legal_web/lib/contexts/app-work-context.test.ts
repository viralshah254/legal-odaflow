import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, expect, it, vi } from "vitest"
import AppShellLayout from "@/app/app/app-shell-layout"
import { WorkContextStartDialog } from "@/components/work-context/work-context-start-dialog"
import { useResolvedWorkContext } from "@/lib/contexts/work-context"

const identity = vi.hoisted(() => ({ user: { id: "user-a" }, tenant: "firm-a" }))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("next/navigation", () => ({ usePathname: () => "/app/research" }))
vi.mock("next/dynamic", () => ({ default: () => () => null }))
vi.mock("@/lib/contexts/auth-context", () => ({ useAuth: () => ({ user: identity.user }) }))
vi.mock("@/lib/contexts/tenant-context", () => ({ useTenant: () => ({ activeTenantId: identity.tenant }) }))
vi.mock("@/hooks/use-push-notifications", () => ({ usePushNotifications: () => undefined }))
vi.mock("@/lib/store/meeting-recording-store", () => ({ useMeetingRecordingStore: () => false }))
vi.mock("@/lib/api/work-context", () => ({ startWorkContext: vi.fn() }))
vi.mock("@/components/app-sidebar", () => ({ AppSidebar: () => null }))
vi.mock("@/components/app-topbar", () => ({ AppTopbar: () => null }))
vi.mock("@/components/command-palette", () => ({ CommandPalette: () => null }))
vi.mock("@/components/copilot/copilot-context-syncer", () => ({ CopilotContextSyncer: () => null }))
vi.mock("@/components/meetings/global-record-meeting", () => ({ GlobalRecordMeeting: () => null }))
vi.mock("@/components/ui/toaster", () => ({ Toaster: () => null }))
vi.mock("@/components/copilot/copilot-floating-button", () => ({ CopilotFloatingButton: () => null }))
vi.mock("@/components/tutorials/page-help-panel", () => ({ PageHelpPanel: () => null }))
vi.mock("@/components/marketing/intro-offer-provider", () => ({ IntroOfferProvider: () => null }))
vi.mock("@/lib/contexts/role-context", () => ({ RoleProvider: ({ children }: { children: React.ReactNode }) => children }))
vi.mock("@/lib/contexts/copilot-context", () => ({ CopilotProvider: ({ children }: { children: React.ReactNode }) => children }))
vi.mock("@/lib/contexts/realtime-context", () => ({ RealtimeProvider: ({ children }: { children: React.ReactNode }) => children }))
vi.mock("@/lib/auth/app-user-bridge", () => ({ AppUserBridge: ({ children }: { children: React.ReactNode }) => children }))
vi.mock("@/lib/contexts/tour-context", () => ({ TourProvider: ({ children }: { children: React.ReactNode }) => children }))
vi.mock("@/lib/contexts/ai-model-context", () => ({ AiModelProvider: ({ children }: { children: React.ReactNode }) => children }))

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
let root: Root | undefined
let container: HTMLDivElement
let work: ReturnType<typeof useResolvedWorkContext>
function Consumer() {
  work = useResolvedWorkContext()
  return React.createElement(WorkContextStartDialog, { open: false, onClose() {}, onConfirm() {} })
}
async function render() {
  await act(async () => root!.render(React.createElement(AppShellLayout, null, React.createElement(Consumer))))
}
afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  container?.remove()
  root = undefined
  identity.user = { id: "user-a" }; identity.tenant = "firm-a"
})
it("mounts the real research work dialog and retains matter context across page renders", async () => {
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
  await render()
  expect(work!.resolved).toBeNull()
  await act(async () => work!.setResolved({ scopeKey: "matter-a", matterId: "matter-a", clientId: "client-a", countryCode: "KE", standalone: false }))
  await render()
  expect(work!.resolved?.matterId).toBe("matter-a")
})
it("clears confidential work context on firm or signed-in user changes", async () => {
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
  await render()
  const setMatter = () => work!.setResolved({ scopeKey: "matter-a", matterId: "matter-a", clientId: "client-a", countryCode: "IN", standalone: false })
  await act(async () => setMatter())
  identity.tenant = "firm-b"; await render()
  expect(work!.resolved).toBeNull()
  await act(async () => setMatter())
  identity.user = { id: "user-b" }; await render()
  expect(work!.resolved).toBeNull()
})
