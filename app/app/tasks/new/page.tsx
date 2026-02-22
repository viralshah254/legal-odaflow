"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Save } from "lucide-react"
import { createTask } from "@/lib/mock/tasks"
import { mockMatters } from "@/lib/mock/matters"
import { mockUsers } from "@/lib/mock/users"
import { useRole } from "@/lib/contexts/role-context"

export default function NewTaskPage() {
  const router = useRouter()
  const { currentUser } = useRole()
  const user = currentUser || mockUsers[0]

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [matterId, setMatterId] = useState<string>("")
  const [assignedToId, setAssignedToId] = useState<string>(user.id)
  const [priority, setPriority] = useState<"Low" | "Normal" | "High" | "Critical">("Normal")
  const [dueDate, setDueDate] = useState("")
  const [category, setCategory] = useState<"STANDARD" | "CRITICAL">("STANDARD")

  const selectedMatter = matterId ? mockMatters.find((m) => m.id === matterId) : undefined

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !dueDate) return

    const assignedUser = mockUsers.find((u) => u.id === assignedToId) || user

    createTask({
      title,
      description: description || undefined,
      matterId: matterId || undefined,
      matterTitle: selectedMatter?.title,
      assignedToId: assignedUser.id,
      assignedToName: assignedUser.name,
      dueAt: new Date(dueDate),
      priority,
      status: "Todo",
      category,
    })

    router.push("/app/tasks")
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/tasks">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">New Task</h1>
          <p className="text-muted-foreground">Create a new task</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Task Details</CardTitle>
          <CardDescription>Fill in the task information below</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                placeholder="Enter task title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter task description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="matter">Matter (Optional)</Label>
                <Select value={matterId} onValueChange={setMatterId}>
                  <SelectTrigger id="matter">
                    <SelectValue placeholder="Select a matter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {mockMatters.map((matter) => (
                      <SelectItem key={matter.id} value={matter.id}>
                        {matter.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignedTo">Assign To *</Label>
                <Select value={assignedToId} onValueChange={setAssignedToId}>
                  <SelectTrigger id="assignedTo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mockUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority *</Label>
                <Select value={priority} onValueChange={(value) => setPriority(value as typeof priority)}>
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as typeof category)}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDARD">Standard</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date *</Label>
                <Input
                  id="dueDate"
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Link href="/app/tasks">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={!title || !dueDate}>
                <Save className="mr-2 h-4 w-4" />
                Create Task
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}




