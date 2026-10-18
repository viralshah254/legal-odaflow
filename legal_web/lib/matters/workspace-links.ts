export type WorkspaceLinkGroup =
  | "primary"
  | "caseTools"
  | "litigation"
  | "peopleMoney"

export interface WorkspaceLink {
  label: string
  href: string
  group: WorkspaceLinkGroup
  exact?: boolean
  activeHrefs?: string[]
}

export function isMatterWorkspaceLinkActive(pathname: string, link: WorkspaceLink): boolean {
  const path = pathname.replace(/\/$/, "")
  const hrefs = [link.href, ...(link.activeHrefs ?? [])].map((href) =>
    href.split("?")[0].replace(/\/$/, ""),
  )

  return hrefs.some((href) =>
    link.exact ? path === href : path === href || path.startsWith(`${href}/`),
  )
}

export function getMatterWorkspaceLinks(
  matterId: string,
  t: (key: string) => string,
  matterType?: string | null,
): WorkspaceLink[] {
  const label = (key: string, fallback: string) => {
    try {
      const value = t(key)
      return !value ||
        value === key ||
        value.endsWith(`.${key}`) ||
        value === `matters.${key}`
        ? fallback
        : value
    } catch {
      return fallback
    }
  }

  const matterHref = `/app/matters/${matterId}`

  const links: WorkspaceLink[] = [
    {
      label: label("workspace.overview", "Overview"),
      href: `${matterHref}?hub=1`,
      group: "primary",
      exact: true,
    },
    {
      label: label("workspace.documents", "Documents"),
      href: `${matterHref}/documents`,
      activeHrefs: [`${matterHref}/diligence`],
      group: "primary",
    },
    {
      label: label("workspace.work", "Work"),
      href: `${matterHref}/work`,
      activeHrefs: [`${matterHref}/tasks`, `${matterHref}/meetings`],
      group: "primary",
    },
    { label: label("workspace.draft", "Draft"), href: `${matterHref}/draft`, group: "primary" },
    {
      label: label("workspace.researchCanvas", "Research"),
      href: `${matterHref}/workspace`,
      group: "primary",
    },
    { label: label("workspace.strategy", "Strategy"), href: `${matterHref}/strategy`, group: "caseTools" },
    { label: label("workspace.outcome", "Outcome"), href: `${matterHref}/outcome`, group: "caseTools" },
    { label: label("workspace.opponent", "Opponent"), href: `${matterHref}/opponent-analysis`, group: "caseTools" },
    { label: label("workspace.similarCases", "Similar cases"), href: `${matterHref}/similar-cases`, group: "caseTools" },
    { label: label("workspace.evidence", "Evidence"), href: `${matterHref}/evidence`, group: "caseTools" },
    { label: label("workspace.evidenceMap", "Evidence map"), href: `${matterHref}/evidence-map`, group: "caseTools" },
    {
      label: label("workspace.quickAi", "Quick AI"),
      href: `${matterHref}/workbench`,
      activeHrefs: [`${matterHref}/ai`],
      group: "caseTools",
    },
    { label: label("workspace.court", "Court"), href: `${matterHref}/court`, group: "litigation" },
    { label: label("workspace.parties", "Parties"), href: `${matterHref}/parties`, group: "peopleMoney" },
    { label: label("workspace.billing", "Billing"), href: `${matterHref}/billing`, group: "peopleMoney" },
  ]

  if (matterType === "Litigation") {
    return links.map((link) =>
      link.href === `${matterHref}/strategy` || link.href === `${matterHref}/evidence-map`
        ? { ...link, group: "primary" }
        : link,
    )
  }

  return links
}
