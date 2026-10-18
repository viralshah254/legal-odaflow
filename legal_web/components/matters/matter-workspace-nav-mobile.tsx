"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  getMatterWorkspaceLinks,
  isMatterWorkspaceLinkActive,
  type WorkspaceLink,
} from "@/lib/matters/workspace-links"

function activeLinkLabel(
  links: WorkspaceLink[],
  pathname: string,
): string {
  const active = links.find((link) => isMatterWorkspaceLinkActive(pathname, link))
  return active?.label ?? links[0]?.label ?? "Matter"
}

interface MatterWorkspaceNavMobileProps {
  matterId: string
  matterType?: string | null
}

/**
 * Mobile matter sub-nav: current section + bottom Sheet listing all workspace links.
 * Shown below `md` where the desktop pill strip is hidden.
 */
export function MatterWorkspaceNavMobile({ matterId, matterType }: MatterWorkspaceNavMobileProps) {
  const t = useTranslations("matters")
  const links = getMatterWorkspaceLinks(matterId, t, matterType)
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const currentLabel = activeLinkLabel(links, pathname)
  const groupHeadingId = useId()
  const primaryLinks = links.filter((link) => link.group === "primary")
  const moreGroups = [
    { group: "caseTools" as const, label: t("workspace.caseTools") },
    { group: "litigation" as const, label: t("workspace.litigation") },
    { group: "peopleMoney" as const, label: t("workspace.peopleMoney") },
  ]

  const renderLink = (link: WorkspaceLink) => {
    const active = isMatterWorkspaceLinkActive(pathname, link)
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={() => setOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center rounded-lg px-3 py-3 min-h-[44px] text-sm font-medium transition-colors motion-reduce:transition-none",
          active
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted text-foreground",
        )}
      >
        {link.label}
      </Link>
    )
  }

  return (
    <div className="md:hidden" data-tour="matter-workspace-nav-mobile">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between h-11 min-h-[44px] gap-2"
            aria-label={t("workspace.openNavigation", { section: currentLabel })}
          >
            <span className="truncate font-medium">{currentLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] pb-safe-bottom">
          <SheetHeader className="mb-3 text-left">
            <SheetTitle>{t("workspace.sectionsTitle")}</SheetTitle>
          </SheetHeader>
          <nav
            className="flex flex-col gap-1 overflow-y-auto max-h-[70vh] pb-4"
            aria-label={t("workspace.navigationLabel")}
          >
            {primaryLinks.map(renderLink)}
            <div className="my-2 border-t" />
            <h2 id={`${groupHeadingId}-more`} className="px-3 pb-1 text-sm font-semibold">
              {t("workspace.more")}
            </h2>
            {moreGroups.map(({ group, label }) => (
              <section
                key={group}
                className="mt-2"
                aria-labelledby={`${groupHeadingId}-${group}`}
              >
                <h3
                  id={`${groupHeadingId}-${group}`}
                  className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {label}
                </h3>
                <div className="flex flex-col gap-1">
                  {links.filter((link) => link.group === group).map(renderLink)}
                </div>
              </section>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  )
}
