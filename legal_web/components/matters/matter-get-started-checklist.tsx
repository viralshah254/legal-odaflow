"use client"

import Link from "next/link"
import { Brain, CheckCircle2, ClipboardList, FileText, Library } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const items = [
  {
    id: "documents",
    title: "Add matter documents",
    description: "Upload correspondence, pleadings, contracts, or evidence.",
    icon: FileText,
    href: "documents",
  },
  {
    id: "analysis",
    title: "Run smart matter analysis",
    description: "Build the current summary, risks, gaps, and next actions.",
    icon: Brain,
    href: "#matter-brief",
  },
  {
    id: "forms",
    title: "Review recommended forms",
    description: "Find jurisdiction and matter-type specific templates.",
    icon: Library,
    href: "documents?view=generate",
  },
  {
    id: "questionnaire",
    title: "Complete intake details",
    description: "Capture structured details needed for workflows and drafting.",
    icon: ClipboardList,
    href: "#intake-questionnaire",
  },
] as const

export function MatterGetStartedChecklist({
  matterId,
  factsComplete,
  analysisComplete,
}: {
  matterId: string
  factsComplete: boolean
  analysisComplete: boolean
}) {
  const completion: Record<string, boolean> = {
    questionnaire: factsComplete,
    analysis: analysisComplete,
  }
  const completed = items.filter((item) => completion[item.id]).length

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Get this matter ready</CardTitle>
          <span className="text-xs text-muted-foreground">{completed} of {items.length} complete</span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const done = Boolean(completion[item.id])
          const href = item.href.startsWith("#")
            ? item.href
            : `/app/matters/${matterId}/${item.href}`
          return (
            <Link
              key={item.id}
              href={href}
              className={cn(
                "flex gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50",
                done && "bg-muted/30",
              )}
            >
              <span className="mt-0.5">
                {done
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  : <item.icon className="h-5 w-5 text-primary" />}
              </span>
              <span>
                <span className="block text-sm font-medium">{item.title}</span>
                <span className="block text-xs text-muted-foreground">{item.description}</span>
              </span>
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
