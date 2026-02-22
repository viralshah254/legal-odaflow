"use client"

import { useEffect } from "react"
import { useUIStore } from "@/lib/store"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare, FileEdit, ClipboardList, Lightbulb, History } from "lucide-react"
import { CopilotChat } from "./copilot-chat"
import { CopilotDrafts } from "./copilot-drafts"
import { CopilotWork } from "./copilot-work"
import { CopilotInsights } from "./copilot-insights"
import { CopilotHistory } from "./copilot-history"
import { cn } from "@/lib/utils"

export function CopilotDrawer() {
  const { copilotDrawerOpen, setCopilotDrawerOpen } = useUIStore()
  const { activeTab, setActiveTab, canUseCopilot } = useCopilotContext()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        setCopilotDrawerOpen(!copilotDrawerOpen)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [copilotDrawerOpen, setCopilotDrawerOpen])

  if (!canUseCopilot) return null

  return (
    <Sheet open={copilotDrawerOpen} onOpenChange={setCopilotDrawerOpen}>
      <SheetContent
        side="right"
        className={cn(
          "w-full sm:max-w-[420px] md:max-w-[480px] lg:max-w-[520px]",
          "p-0 flex flex-col overflow-hidden"
        )}
      >
        <SheetHeader className="px-6 pt-6 pb-2 shrink-0 border-b">
          <SheetTitle className="text-lg">Copilot</SheetTitle>
        </SheetHeader>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="w-full justify-start rounded-none border-b h-11 px-6 bg-transparent gap-0">
            <TabsTrigger value="ask" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
              <MessageSquare className="h-4 w-4" />
              Ask
            </TabsTrigger>
            <TabsTrigger value="work" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
              <ClipboardList className="h-4 w-4" />
              Work
            </TabsTrigger>
            <TabsTrigger value="drafts" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
              <FileEdit className="h-4 w-4" />
              Drafts
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
              <Lightbulb className="h-4 w-4" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>
          <div className="flex-1 min-h-0 overflow-hidden">
            <TabsContent value="ask" className="h-full m-0 data-[state=inactive]:hidden">
              <CopilotChat />
            </TabsContent>
            <TabsContent value="work" className="h-full m-0 overflow-auto data-[state=inactive]:hidden">
              <CopilotWork />
            </TabsContent>
            <TabsContent value="drafts" className="h-full m-0 data-[state=inactive]:hidden">
              <CopilotDrafts />
            </TabsContent>
            <TabsContent value="insights" className="h-full m-0 overflow-auto data-[state=inactive]:hidden">
              <CopilotInsights />
            </TabsContent>
            <TabsContent value="history" className="h-full m-0 data-[state=inactive]:hidden">
              <CopilotHistory />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
