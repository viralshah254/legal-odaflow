"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { shouldRenderPriorityDisclosure } from "@/lib/matters/overview-priority"

export interface MatterAction {
  title: string
  description: string
  href: string
}

interface MatterPriorityActionProps {
  primary: MatterAction
  suggestions?: MatterAction[]
}

export function MatterPriorityAction({
  primary,
  suggestions = [],
}: MatterPriorityActionProps) {
  const t = useTranslations("matters")

  return (
    <Card className="border-primary/25 bg-primary/[0.03]">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="rounded-full bg-primary/10 p-2 text-primary">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="font-semibold">{primary.title}</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {primary.description}
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="w-full shrink-0 justify-between sm:w-auto">
            <Link href={primary.href}>
              {t("open_action")}
              <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {shouldRenderPriorityDisclosure(suggestions) && (
          <Collapsible className="mt-3 border-t pt-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="group px-1 text-muted-foreground">
                {t("other")}
                <ChevronDown
                  className="ml-1.5 h-4 w-4 transition-transform motion-reduce:transition-none group-data-[state=open]:rotate-180"
                  aria-hidden="true"
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="space-y-1 pt-1">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.href}>
                    <Link
                      href={suggestion.href}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span>
                        <span className="block font-medium">{suggestion.title}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {suggestion.description}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  )
}
