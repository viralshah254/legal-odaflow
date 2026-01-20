"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { mattersApi } from "@/lib/mock-api"
import { formatDate } from "@/lib/utils"
import type { Matter } from "@/lib/types"
import { Plus } from "lucide-react"

export default function MattersPage() {
  const router = useRouter()
  const [matters, setMatters] = useState<Matter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadMatters() {
      setLoading(true)
      const data = await mattersApi.listMatters()
      setMatters(data)
      setLoading(false)
    }
    loadMatters()
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Matters</h1>
          <p className="text-muted-foreground">Manage your legal matters</p>
        </div>
        <Button onClick={() => router.push("/app/matters/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Matter
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading matters...</div>
      ) : matters.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No matters found</p>
            <Button onClick={() => router.push("/app/matters/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Matter
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {matters.map((matter) => (
            <Card
              key={matter.id}
              className="cursor-pointer hover:bg-accent/50"
              onClick={() => router.push(`/app/matters/${matter.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{matter.title}</h3>
                      <Badge>{matter.stage}</Badge>
                      <Badge variant="outline">{matter.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {matter.ref} • {matter.client?.name}
                    </p>
                    {matter.advocate && (
                      <p className="text-sm text-muted-foreground">
                        Advocate: {matter.advocate.name}
                      </p>
                    )}
                    {matter.nextDeadline && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Next deadline: {formatDate(matter.nextDeadline)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

