import { notFound } from "next/navigation"
import { isDevRoleSwitcherEnabled } from "@/lib/dev/dev-role-switcher"
import { RolePreviewClient } from "./role-preview-client"

export default function RolePreviewPage() {
  if (!isDevRoleSwitcherEnabled()) {
    notFound()
  }

  return <RolePreviewClient />
}
