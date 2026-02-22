"use client"

import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ClipboardList } from "lucide-react"

export function CopilotWork() {
  const { hasPermission } = useCopilotContext()

  if (!hasPermission("canUseCopilotChat")) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        You don&apos;t have permission to use Copilot work plans.
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" />
            Action plans & checklists
          </CardTitle>
          <CardDescription>
            AI-generated action plans and checklists will appear here. Use the Ask tab to run recipes like &quot;Matter Kickoff&quot; or &quot;Deadline Rescue&quot; and they will show up in Work.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No action plans yet. Try asking in the Ask tab: &quot;Create a matter kickoff plan&quot; or &quot;What are the critical path tasks?&quot;
        </CardContent>
      </Card>
    </div>
  )
}
