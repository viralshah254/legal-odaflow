import AdminShellLayout from "./admin-shell-layout"

/** Session-protected admin console — always render per request (middleware + cookies). */
export const dynamic = "force-dynamic"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminShellLayout>{children}</AdminShellLayout>
}
