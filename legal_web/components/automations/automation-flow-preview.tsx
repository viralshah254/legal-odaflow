"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  AUTOMATION_TRIGGER_LABELS,
  describeAction,
  describeConditions,
} from "@/lib/automations/catalog"
import type { AutomationAction, AutomationRule } from "@/lib/api/automations"
import { ArrowDown, Filter, Play, Zap } from "lucide-react"

interface AutomationFlowPreviewProps {
  rule: Partial<AutomationRule> & { name: string; trigger: string }
}

export function AutomationFlowPreview({ rule }: AutomationFlowPreviewProps) {
  const actions = (rule.actions ?? []) as AutomationAction[]
  const conditions = (rule.conditions ?? {}) as Record<string, unknown>
  const conditionLines = describeConditions(conditions)

  const nodes = useMemo(
    () => [
      {
        id: "trigger",
        title: "When",
        icon: Zap,
        body: AUTOMATION_TRIGGER_LABELS[rule.trigger] ?? rule.trigger,
        tone: "border-primary/40 bg-primary/5",
      },
      ...(conditionLines.length > 0
        ? [
            {
              id: "conditions",
              title: "Only if",
              icon: Filter,
              body: conditionLines.join(" · "),
              tone: "border-amber-500/30 bg-amber-500/5",
            },
          ]
        : []),
      ...actions.map((action, index) => ({
        id: `action-${index}`,
        title: `Then ${index + 1}`,
        icon: Play,
        body: describeAction(action as unknown as Record<string, unknown>),
        tone: "border-emerald-500/30 bg-emerald-500/5",
      })),
    ],
    [actions, conditionLines, rule.trigger],
  )

  if (nodes.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Flow preview
      </p>
      <div className="flex flex-col items-stretch gap-2">
        {nodes.map((node, index) => (
          <div key={node.id} className="flex flex-col items-center gap-2">
            <Card className={`w-full ${node.tone}`}>
              <CardContent className="py-3 px-4 flex items-start gap-3">
                <node.icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      {node.title}
                    </span>
                    {node.id.startsWith("action") && (
                      <Badge variant="outline" className="text-[10px] h-5">
                        action
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm">{node.body}</p>
                </div>
              </CardContent>
            </Card>
            {index < nodes.length - 1 && (
              <ArrowDown className="h-4 w-4 text-muted-foreground" aria-hidden />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
