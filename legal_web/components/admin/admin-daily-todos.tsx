"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  getAdminDailyTodos,
  updateAdminTodo,
  createAdminTodo,
  type AdminTodoItem,
} from "@/lib/api/admin"
import { CheckSquare, Square, Plus, RefreshCw, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const CATEGORY_LABEL: Record<string, string> = {
  engineering: "Engineering",
  marketing: "Marketing",
  finance: "Finance",
  ops: "Operations",
}

const CATEGORY_COLOR: Record<string, string> = {
  engineering: "bg-teal-100 text-teal-700",
  marketing: "bg-purple-100 text-purple-700",
  finance: "bg-amber-100 text-amber-700",
  ops: "bg-slate-100 text-slate-700",
}

function groupByCategory(todos: AdminTodoItem[]) {
  const groups: Record<string, AdminTodoItem[]> = {}
  for (const t of todos) {
    if (!groups[t.category]) groups[t.category] = []
    groups[t.category].push(t)
  }
  return groups
}

function todayDateStr() {
  return new Date().toISOString().split("T")[0]
}

export function AdminDailyTodos() {
  const [todos, setTodos] = useState<AdminTodoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [adding, setAdding] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getAdminDailyTodos(todayDateStr())
      .then(setTodos)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function toggle(id: string, current: boolean) {
    setToggling((prev) => new Set(prev).add(id))
    try {
      const updated = await updateAdminTodo(id, { completed: !current })
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)))
    } finally {
      setToggling((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  async function addTodo() {
    if (!newTitle.trim()) return
    setAdding(true)
    try {
      const item = await createAdminTodo({ title: newTitle.trim() })
      setTodos((prev) => [...prev, item])
      setNewTitle("")
      setShowAdd(false)
    } finally {
      setAdding(false)
    }
  }

  const done = todos.filter((t) => t.completed).length
  const total = todos.length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0
  const groups = groupByCategory(todos.slice().sort((a, b) => a.sortOrder - b.sortOrder))

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">
              Today&apos;s Tasks
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {done}/{total} complete — {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={load}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAdd((v) => !v)}>
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && total === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No tasks for today. Add one or check back after seeding templates.
          </p>
        )}

        {!loading &&
          Object.entries(groups).map(([cat, items]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0.5 font-medium", CATEGORY_COLOR[cat])}>
                  {CATEGORY_LABEL[cat] ?? cat}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {items.filter((i) => i.completed).length}/{items.length}
                </span>
              </div>
              <ul className="space-y-1">
                {items.map((todo) => (
                  <li key={todo.id} className="flex items-start gap-2">
                    <button
                      onClick={() => toggle(todo.id, todo.completed)}
                      disabled={toggling.has(todo.id)}
                      className="mt-0.5 shrink-0 text-primary disabled:opacity-40"
                      aria-label={todo.completed ? "Mark incomplete" : "Mark complete"}
                    >
                      {toggling.has(todo.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : todo.completed ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm leading-snug",
                          todo.completed && "line-through text-muted-foreground",
                        )}
                      >
                        {todo.title}
                      </p>
                      {todo.description && !todo.completed && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {todo.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

        {showAdd && (
          <div className="flex items-center gap-2 pt-1">
            <Input
              autoFocus
              placeholder="Add a task for today…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTodo()}
              className="h-8 text-sm"
            />
            <Button size="sm" className="h-8" onClick={addTodo} disabled={adding || !newTitle.trim()}>
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
