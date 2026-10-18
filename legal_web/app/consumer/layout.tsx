import ConsumerShellLayout from "./consumer-shell-layout"

/** Session-protected consumer app — always render per request (middleware + cookies). */
export const dynamic = "force-dynamic"

export default function ConsumerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ConsumerShellLayout>{children}</ConsumerShellLayout>
}
