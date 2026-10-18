"use client"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Command } from "cmdk"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { useUIStore } from "@/lib/store"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { hasMeetingPermission } from "@/lib/types/roles"
import { listClients } from "@/lib/api/clients"
import { listMatters } from "@/lib/api/matters"
import { useApiData } from "@/lib/hooks/use-api-data"
import { cn } from "@/lib/utils"
import {
  Search,
  Users,
  User,
  FileText,
  CheckSquare,
  Receipt,
  Shield,
  Folder,
  Sparkles,
  Mic,
  FileSearch,
  PlusCircle,
  Clock,
  FilePlus,
  Zap,
  ListChecks,
  Briefcase,
  X,
  ArrowRight,
} from "lucide-react"

/** Colour category for icon chips in the palette */
type ChipVariant = "ai" | "create" | "navigate" | "finance" | "record"

const CHIP_STYLES: Record<ChipVariant, string> = {
  ai:       "bg-primary/15 text-primary",
  create:   "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  navigate: "bg-slate-500/12 text-slate-600 dark:text-slate-300",
  finance:  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  record:   "bg-rose-500/12 text-rose-600 dark:text-rose-400",
}

const groupHeadingClass =
  "px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 select-none"

export function CommandPalette() {
  const t = useTranslations("common")
  const tCopilot = useTranslations("copilot")
  const router = useRouter()
  const { currentRole } = useRole()
  const { activeTenantId } = useTenant()
  const { commandPaletteOpen, setCommandPaletteOpen, setCopilotDrawerOpen, setRecordMeetingOpen } = useUIStore()
  const { setClientId, setMatterId, canOpenCopilot } = useCopilotContext()

  const baseCommands = useMemo(
    () => [
      {
        id: "copilot",
        label: tCopilot("askCopilot"),
        sublabel: "Ask anything about your practice",
        icon: Sparkles,
        action: "copilot" as const,
        chip: "ai" as ChipVariant,
        featured: true,
      },
      {
        id: "create-matter",
        label: t("createMatter"),
        icon: PlusCircle,
        href: "/app/matters/new" as const,
        chip: "create" as ChipVariant,
        roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "INTAKE"],
      },
      {
        id: "log-time",
        label: t("logTime"),
        icon: Clock,
        href: "/app/time" as const,
        chip: "create" as ChipVariant,
        roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "PARALEGAL"],
      },
      {
        id: "new-invoice",
        label: t("newInvoice"),
        icon: FilePlus,
        href: "/app/accounting/invoices/new" as const,
        chip: "finance" as ChipVariant,
        roles: ["PARTNER_ADMIN", "FINANCE"],
      },
      { id: "clients",     label: t("goToClients"),    icon: Users,      href: "/app/clients",               chip: "navigate" as ChipVariant },
      { id: "matters",     label: t("goToMatters"),    icon: FileText,   href: "/app/matters",               chip: "navigate" as ChipVariant },
      { id: "tasks",       label: t("goToTasks"),      icon: CheckSquare,href: "/app/tasks",                 chip: "navigate" as ChipVariant },
      { id: "invoices",    label: t("goToInvoices"),   icon: Receipt,    href: "/app/accounting/invoices",   chip: "finance"  as ChipVariant },
      { id: "trust",       label: t("goToTrust"),      icon: Shield,     href: "/app/trust",                 chip: "finance"  as ChipVariant },
      { id: "documents",   label: t("goToDocuments"),  icon: Folder,     href: "/app/documents",             chip: "navigate" as ChipVariant },
      { id: "automations", label: t("goToAutomations"),icon: Zap,        href: "/app/automations",           chip: "navigate" as ChipVariant },
      {
        id: "reports",
        label: t("goToReports"),
        icon: FileSearch,
        href: "/app/reports" as const,
        chip: "navigate" as ChipVariant,
        roles: ["PARTNER_ADMIN", "FINANCE"],
      },
      { id: "queues", label: t("goToQueues"), icon: ListChecks, href: "/app/queues", chip: "navigate" as ChipVariant },
    ],
    [t, tCopilot],
  )

  const { data: clients = [] } = useApiData(["command-palette-clients", activeTenantId], {
    apiFn: () => listClients(activeTenantId!),
    enabled: !!activeTenantId && commandPaletteOpen,
  })

  const { data: matters = [] } = useApiData(["command-palette-matters", activeTenantId], {
    apiFn: () => listMatters(activeTenantId!),
    enabled: !!activeTenantId && commandPaletteOpen,
  })

  const canRecord = hasMeetingPermission(currentRole, "meetingsRecord")
  const canSearchTranscripts = hasMeetingPermission(currentRole, "meetingsRead")
  const baseWithRoleFilter = baseCommands.filter(
    (cmd) => !("roles" in cmd) || (cmd.roles && cmd.roles.includes(currentRole)),
  )
  const commands = [
    ...(canOpenCopilot ? [baseCommands[0]] : []),
    ...baseWithRoleFilter.filter((cmd) => cmd.id !== "copilot"),
    ...(canRecord
      ? [{ id: "record-meeting", label: t("startRecording"), icon: Mic, action: "recordMeeting" as const, chip: "record" as ChipVariant }]
      : []),
    ...(canSearchTranscripts
      ? [{ id: "search-transcripts", label: t("searchTranscripts"), icon: FileSearch, href: "/app/meetings" as const, chip: "navigate" as ChipVariant }]
      : []),
  ]

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [commandPaletteOpen, setCommandPaletteOpen])

  const handleClose = () => setCommandPaletteOpen(false)

  const openClient = (clientId: string) => {
    setClientId(clientId)
    setMatterId(undefined)
    router.push(`/app/clients/${clientId}`)
    handleClose()
  }

  const openMatter = (matterId: string, clientId: string) => {
    setMatterId(matterId)
    setClientId(clientId)
    router.push(`/app/matters/${matterId}`)
    handleClose()
  }

  const featuredCmd = commands.find((c) => "featured" in c && c.featured)
  const regularCmds = commands.filter((c) => !("featured" in c && c.featured))

  return (
    <DialogPrimitive.Root open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <DialogPrimitive.Portal>
        {/* Darker, heavier backdrop */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-[10%] z-50 w-full max-w-2xl -translate-x-1/2",
            "overflow-hidden rounded-2xl border border-border/50",
            "bg-[hsl(var(--popover))] shadow-[0_32px_64px_-16px_rgb(0_0_0/0.55),0_0_0_1px_hsl(var(--border)/0.3)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-top-[2%] data-[state=open]:slide-in-from-top-[2%]",
          )}
        >
          <DialogPrimitive.Title className="sr-only">{t("commandPalette")}</DialogPrimitive.Title>

          <Command className="flex flex-col" shouldFilter loop>
            {/* ── Search bar ──────────────────────────────────────── */}
            <div className="flex items-center gap-3 border-b border-border/50 px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              <Command.Input
                placeholder={t("searchPlaceholder")}
                className="flex h-13 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 py-3.5"
              />
              <div className="flex items-center gap-1.5">
                <kbd className="hidden sm:inline-flex h-5 select-none items-center rounded-md border border-border/60 bg-muted/50 px-1.5 font-mono text-[10px] text-muted-foreground/70">
                  ESC
                </kbd>
                <DialogPrimitive.Close className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </div>
            </div>

            <Command.List className="max-h-[520px] overflow-y-auto p-2">
              <Command.Empty className="py-10 text-center text-sm text-muted-foreground">
                {t("noResultsCommand")}
              </Command.Empty>

              <Command.Group heading={t("quickActions")}>
                <div cmdk-group-heading="" className={groupHeadingClass}>
                  {t("quickActions")}
                </div>

                {/* ── Featured Copilot CTA ─────────────────────────── */}
                {featuredCmd && canOpenCopilot && (
                  <Command.Item
                    key={featuredCmd.id}
                    value={featuredCmd.label}
                    onSelect={() => {
                      setCopilotDrawerOpen(true)
                      handleClose()
                    }}
                    className="group relative flex items-center gap-3 rounded-xl px-3 py-3 cursor-pointer mb-1.5 overflow-hidden transition-colors aria-selected:bg-transparent"
                  >
                    {/* Gradient background */}
                    <span className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-primary/10 via-primary/8 to-primary/5 ring-1 ring-primary/20 group-aria-selected:ring-primary/35 group-aria-selected:from-primary/15 transition-all" />
                    <div className={cn("relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", CHIP_STYLES.ai)}>
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="relative flex-1 min-w-0">
                      <span className="block text-[13px] font-semibold text-foreground">{featuredCmd.label}</span>
                      {"sublabel" in featuredCmd && (
                        <span className="block text-[11px] text-muted-foreground">{featuredCmd.sublabel}</span>
                      )}
                    </div>
                    <ArrowRight className="relative h-4 w-4 text-primary/60 shrink-0 group-aria-selected:text-primary transition-colors" />
                  </Command.Item>
                )}

                {/* ── Regular quick actions ───────────────────────── */}
                {regularCmds.map((cmd) => (
                  <Command.Item
                    key={cmd.id}
                    value={cmd.label}
                    onSelect={() => {
                      if ("action" in cmd) {
                        if (cmd.action === "recordMeeting") setRecordMeetingOpen(true)
                      } else if ("href" in cmd && typeof cmd.href === "string") {
                        router.push(cmd.href)
                      }
                      handleClose()
                    }}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors aria-selected:bg-muted/80 aria-selected:text-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                  >
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                        CHIP_STYLES[("chip" in cmd ? cmd.chip : "navigate") as ChipVariant],
                      )}
                    >
                      <cmd.icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-medium">{cmd.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>

              {clients.length > 0 && (
                <Command.Group heading={t("clientsGroup")}>
                  <div cmdk-group-heading="" className={groupHeadingClass}>
                    {t("clientsGroup")}
                  </div>
                  {clients.map((client) => (
                    <Command.Item
                      key={client.id}
                      value={`client ${client.name} ${client.email ?? ""} ${client.type}`}
                      onSelect={() => openClient(client.id)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors aria-selected:bg-muted/80 aria-selected:text-foreground"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-300">
                        <User className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{client.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {client.type}
                          {client.email ? ` · ${client.email}` : ""}
                        </span>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {matters.length > 0 && (
                <Command.Group heading={t("mattersGroup")}>
                  <div cmdk-group-heading="" className={groupHeadingClass}>
                    {t("mattersGroup")}
                  </div>
                  {matters.map((matter) => (
                    <Command.Item
                      key={matter.id}
                      value={`matter ${matter.title} ${matter.caseNumber ?? ""} ${matter.client?.name ?? ""}`}
                      onSelect={() => openMatter(matter.id, matter.clientId ?? "")}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors aria-selected:bg-muted/80 aria-selected:text-foreground"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-300">
                        <Briefcase className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{matter.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {matter.caseNumber ?? matter.id.slice(0, 8)} · {matter.client?.name ?? t("noClient")}
                        </span>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>

            {/* ── Footer hint bar ─────────────────────────────────── */}
            <div className="flex items-center gap-3 border-t border-border/40 px-4 py-2.5 text-[11px] text-muted-foreground/60">
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center rounded border border-border/60 bg-muted/60 px-1 font-mono text-[9px]">↑</kbd>
                <kbd className="inline-flex h-4 items-center rounded border border-border/60 bg-muted/60 px-1 font-mono text-[9px]">↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center rounded border border-border/60 bg-muted/60 px-1.5 font-mono text-[9px]">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center rounded border border-border/60 bg-muted/60 px-1.5 font-mono text-[9px]">⌘K</kbd>
                toggle
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
