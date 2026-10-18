"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { useQuery } from "@tanstack/react-query"
import { useTenant } from "@/lib/contexts/tenant-context"
import { listSavedResearch } from "@/lib/api/ai"
import { queryKeys } from "@/lib/api/query-keys"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { MatterWorkspaceNavMobile } from "@/components/matters/matter-workspace-nav-mobile"
import { ChevronDown } from "lucide-react"
import {
  getMatterWorkspaceLinks,
  isMatterWorkspaceLinkActive,
  type WorkspaceLink,
} from "@/lib/matters/workspace-links"

export { getMatterWorkspaceLinks }
export type { WorkspaceLink }

interface MatterWorkspaceNavProps {
  matterId: string
  matterType?: string | null
}

export function MatterWorkspaceNav({ matterId, matterType }: MatterWorkspaceNavProps) {
  const t = useTranslations("matters")
  const { activeTenantId } = useTenant()
  const links = getMatterWorkspaceLinks(matterId, t, matterType)
  const pathname = usePathname()

  const { data: filedResearch = [] } = useQuery({
    queryKey: queryKeys.research.saved(activeTenantId, { matterId }),
    queryFn: () => listSavedResearch(activeTenantId!, { matterId }),
    enabled: !!activeTenantId && !!matterId,
    staleTime: 60_000,
  })
  const filedResearchCount = filedResearch.length
  const isActive = (link: WorkspaceLink) =>
    isMatterWorkspaceLinkActive(pathname, link)
  const primaryLinks = links.filter((link) => link.group === "primary")
  const moreLinks = links.filter((link) => link.group !== "primary")
  const hasActiveMoreLink = moreLinks.some(isActive)
  const moreGroups = [
    { group: "caseTools" as const, label: t("workspace.caseTools") },
    { group: "litigation" as const, label: t("workspace.litigation") },
    { group: "peopleMoney" as const, label: t("workspace.peopleMoney") },
  ]

  return (
    <>
      <MatterWorkspaceNavMobile matterId={matterId} matterType={matterType} />
      <nav
        className="hidden md:flex items-center gap-2 overflow-x-auto pb-1"
        aria-label={t("workspace.navigationLabel")}
      >
        {primaryLinks.map((link) => {
          const active = isActive(link)
          const isResearchCanvas = link.href.endsWith("/workspace")
          return (
            <Button
              key={link.href}
              variant={active ? "default" : "outline"}
              size="sm"
              className={cn("shrink-0", active && "shadow-none")}
              asChild
            >
              <Link href={link.href} aria-current={active ? "page" : undefined}>
                {link.label}
                {isResearchCanvas && filedResearchCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1.5 h-4 min-w-4 px-1 text-[10px] font-normal"
                  >
                    {filedResearchCount}
                  </Badge>
                )}
              </Link>
            </Button>
          )
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={hasActiveMoreLink ? "default" : "outline"}
              size="sm"
              className={cn("shrink-0", hasActiveMoreLink && "shadow-none")}
              aria-label={t("workspace.openMore")}
            >
              {t("workspace.more")}
              <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {moreGroups.map(({ group, label: groupLabel }, groupIndex) => (
              <div key={group} role="group" aria-label={groupLabel}>
                {groupIndex > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel>{groupLabel}</DropdownMenuLabel>
                {moreLinks.filter((link) => link.group === group).map((link) => {
                  const active = isActive(link)
                  return (
                    <DropdownMenuItem key={link.href} asChild>
                      <Link
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        data-active={active ? "true" : undefined}
                        className={cn(active && "bg-accent font-medium")}
                      >
                        {link.label}
                      </Link>
                    </DropdownMenuItem>
                  )
                })}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </>
  )
}
