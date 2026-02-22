"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { automationsApi } from "@/lib/mock-api"
import type { AutomationRule } from "@/lib/types"

export default function AutomationsPage() {
  const [rules, setRules] = useState<AutomationRule[]>([])

  useEffect(() => {
    async function loadRules() {
      const data = await automationsApi.listRules()
      setRules(data)
    }
    loadRules()
  }, [])

  const toggleRule = async (id: string, enabled: boolean) => {
    await automationsApi.updateRule(id, { enabled })
    setRules(rules.map(r => r.id === id ? { ...r, enabled } : r))
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Automations</h1>
        <p className="text-muted-foreground">Manage automation rules</p>
      </div>

      <div className="space-y-4">
        {rules.map((rule) => (
          <Card key={rule.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{rule.name}</CardTitle>
                  <CardDescription>
                    Trigger: {rule.trigger} • Action: {rule.actions.type}
                  </CardDescription>
                </div>
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={(enabled) => toggleRule(rule.id, enabled)}
                />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}




