"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useUIStore } from "@/lib/store"
import { Search, Users, FileText, CheckSquare, Receipt, Shield, Folder } from "lucide-react"

const commands = [
  { id: "clients", label: "Go to Clients", icon: Users, href: "/app/clients" },
  { id: "matters", label: "Go to Matters", icon: FileText, href: "/app/matters" },
  { id: "tasks", label: "Go to Tasks", icon: CheckSquare, href: "/app/tasks" },
  { id: "invoices", label: "Go to Invoices", icon: Receipt, href: "/app/accounting/invoices" },
  { id: "trust", label: "Go to Trust", icon: Shield, href: "/app/trust" },
  { id: "documents", label: "Go to Documents", icon: Folder, href: "/app/documents" },
]

export function CommandPalette() {
  const router = useRouter()
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore()

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

  return (
    <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <DialogContent className="p-0 overflow-hidden">
        <Command className="[&_[cmdk-input]]:h-12">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              placeholder="Type a command or search..."
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-1">
            <Command.Empty>No results found.</Command.Empty>
            <Command.Group heading="Navigation">
              {commands.map((cmd) => (
                <Command.Item
                  key={cmd.id}
                  onSelect={() => {
                    router.push(cmd.href)
                    setCommandPaletteOpen(false)
                  }}
                  className="flex items-center gap-2"
                >
                  <cmd.icon className="h-4 w-4" />
                  {cmd.label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

