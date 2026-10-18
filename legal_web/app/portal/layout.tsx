/** Portal routes use HttpOnly session cookies — always render per request. */
export const dynamic = "force-dynamic"

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
