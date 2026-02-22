"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useUIStore } from "@/lib/store"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { useRole } from "@/lib/contexts/role-context"
import { hasMeetingPermission } from "@/lib/types/roles"
import { Search, Users, FileText, CheckSquare, Receipt, Shield, Folder, Sparkles, User, Briefcase, Mic, FileSearch } from "lucide-react"
import { mockClients } from "@/lib/mock/clients"
import { mockMatters } from "@/lib/mock/matters"

const baseCommands = [
  { id: "copilot", label: "Ask Copilot…", icon: Sparkles, action: "copilot" as const },
  { id: "clients", label: "Go to Clients", icon: Users, href: "/app/clients" },
  { id: "matters", label: "Go to Matters", icon: FileText, href: "/app/matters" },
  { id: "tasks", label: "Go to Tasks", icon: CheckSquare, href: "/app/tasks" },
  { id: "invoices", label: "Go to Invoices", icon: Receipt, href: "/app/accounting/invoices" },
  { id: "trust", label: "Go to Trust", icon: Shield, href: "/app/trust" },
  { id: "documents", label: "Go to Documents", icon: Folder, href: "/app/documents" },
]

export function CommandPalette() {
  const router = useRouter()
  const { currentRole } = useRole()
  const { commandPaletteOpen, setCommandPaletteOpen, setCopilotDrawerOpen, setRecordMeetingOpen } = useUIStore()
  const { setClientId, setMatterId } = useCopilotContext()

  const canRecord = hasMeetingPermission(currentRole, "meetingsRecord")
  const canSearchTranscripts = hasMeetingPermission(currentRole, "meetingsRead")
  const commands = [
    ...baseCommands,
    ...(canRecord ? [{ id: "record-meeting", label: "Start client recording…", icon: Mic, action: "recordMeeting" as const }] : []),
    ...(canSearchTranscripts ? [{ id: "search-transcripts", label: "Search transcripts…", icon: FileSearch, href: "/app/meetings" as const }] : []),
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

  return (
    <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <DialogContent className="p-0 overflow-hidden max-h-[85vh] flex flex-col">
        <Command
          className="flex flex-col min-h-0"
          shouldFilter={true}
          loop
        >
          <div className="flex items-center border-b px-3 shrink-0">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              placeholder="Search clients, matters, or run a command..."
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[320px] overflow-y-auto p-1 min-h-0">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No clients or matters found. Try a different search.
            </Command.Empty>

            {/* Quick actions — searchable by label */}
            <Command.Group heading="Quick actions">
              {commands.map((cmd) => (
                <Command.Item
                  key={cmd.id}
                  value={cmd.label}
                  onSelect={() => {
                    if ("action" in cmd) {
                      if (cmd.action === "copilot") setCopilotDrawerOpen(true)
                      else if (cmd.action === "recordMeeting") setRecordMeetingOpen(true)
                    } else if ("href" in cmd) {
                      router.push(cmd.href)
                    }
                    handleClose()
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <cmd.icon className="h-4 w-4 shrink-0" />
                  {cmd.label}
                </Command.Item>
              ))}
            </Command.Group>

            {/* Deep search: clients by name, email, type */}
            <Command.Group heading="Clients">
              {mockClients.map((client) => (
                <Command.Item
                  key={client.id}
                  value={`client ${client.name} ${client.email ?? ""} ${client.type}`}
                  onSelect={() => openClient(client.id)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex flex-col items-start min-w-0">
                    <span className="font-medium truncate w-full">{client.name}</span>
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {client.type}
                      {client.email ? ` · ${client.email}` : ""}
                    </span>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>

            {/* Deep search: matters by title, ref, client name */}
            <Command.Group heading="Matters">
              {mockMatters.map((matter) => (
                <Command.Item
                  key={matter.id}
                  value={`matter ${matter.title} ${matter.ref} ${matter.clientName}`}
                  onSelect={() => openMatter(matter.id, matter.clientId)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex flex-col items-start min-w-0">
                    <span className="font-medium truncate w-full">{matter.title}</span>
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {matter.ref} · {matter.clientName}
                    </span>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}




