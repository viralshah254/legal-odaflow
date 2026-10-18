import AppShellLayout from "./app-shell-layout"

/** Session-protected lawyer app — always render per request (middleware + cookies). */
export const dynamic = "force-dynamic"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShellLayout>{children}</AppShellLayout>
}
