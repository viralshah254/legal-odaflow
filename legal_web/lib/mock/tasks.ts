export interface Task {
  id: string
  title: string
  description?: string
  matterId?: string
  matterTitle?: string
  assignedToId: string
  assignedToName: string
  dueAt: Date
  priority: "Low" | "Normal" | "High" | "Critical"
  status: "Todo" | "In Progress" | "Done" | "Overdue"
  category: "STANDARD" | "CRITICAL"
  createdAt: Date
  updatedAt: Date
}

export const mockTasks: Task[] = [
  {
    id: "t1",
    title: "Review merger agreement",
    description: "Review Section 4.2 and 5.1",
    matterId: "m1",
    matterTitle: "Acme Corp - M&A Transaction",
    assignedToId: "1",
    assignedToName: "Sarah Johnson",
    dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    priority: "High",
    status: "In Progress",
    category: "CRITICAL",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
  {
    id: "t2",
    title: "File motion for summary judgment",
    matterId: "m2",
    matterTitle: "Smith vs. Jones - Contract Dispute",
    assignedToId: "4",
    assignedToName: "David Kim",
    dueAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    priority: "Critical",
    status: "Overdue",
    category: "CRITICAL",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: "t3",
    title: "Draft investment agreement",
    matterId: "m3",
    matterTitle: "TechStart Inc - Series B Funding",
    assignedToId: "2",
    assignedToName: "Michael Chen",
    dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    priority: "High",
    status: "Todo",
    category: "STANDARD",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: "t4",
    title: "Complete trust documents",
    matterId: "m4",
    matterTitle: "Estate Planning - Johnson Family Trust",
    assignedToId: "3",
    assignedToName: "Emily Rodriguez",
    dueAt: new Date(Date.now()),
    priority: "Critical",
    status: "Todo",
    category: "CRITICAL",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: "t5",
    title: "Gather employment records",
    matterId: "m5",
    matterTitle: "Employment Dispute - ABC Corp",
    assignedToId: "5",
    assignedToName: "Lisa Wang",
    dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    priority: "Normal",
    status: "In Progress",
    category: "STANDARD",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: "t6",
    title: "Client meeting preparation",
    matterId: "m1",
    matterTitle: "Acme Corp - M&A Transaction",
    assignedToId: "1",
    assignedToName: "Sarah Johnson",
    dueAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    priority: "High",
    status: "Todo",
    category: "STANDARD",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: "t7",
    title: "Deposition scheduling",
    matterId: "m2",
    matterTitle: "Smith vs. Jones - Contract Dispute",
    assignedToId: "4",
    assignedToName: "David Kim",
    dueAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    priority: "Critical",
    status: "Overdue",
    category: "CRITICAL",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: "t8",
    title: "Review client contract",
    matterId: "m1",
    matterTitle: "Acme Corp - M&A Transaction",
    assignedToId: "1",
    assignedToName: "Sarah Johnson",
    dueAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    priority: "High",
    status: "Done",
    category: "STANDARD",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },
  {
    id: "t9",
    title: "File incorporation documents",
    matterId: "m3",
    matterTitle: "TechStart Inc - Series B Funding",
    assignedToId: "2",
    assignedToName: "Michael Chen",
    dueAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    priority: "Normal",
    status: "Done",
    category: "STANDARD",
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    id: "t10",
    title: "Prepare settlement agreement",
    matterId: "m5",
    matterTitle: "Employment Dispute - ABC Corp",
    assignedToId: "5",
    assignedToName: "Lisa Wang",
    dueAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    priority: "High",
    status: "Done",
    category: "STANDARD",
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
]

export function getCompletedTasks(): Task[] {
  return mockTasks.filter((t) => t.status === "Done")
}

export function getTaskById(id: string): Task | undefined {
  return mockTasks.find((t) => t.id === id)
}

export function getTasksByAssignee(assigneeId: string): Task[] {
  return mockTasks.filter((t) => t.assignedToId === assigneeId)
}

export function getTasksByMatter(matterId: string): Task[] {
  return mockTasks.filter((t) => t.matterId === matterId)
}

export function getTasksDueToday(): Task[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return mockTasks.filter((t) => {
    const dueDate = new Date(t.dueAt)
    dueDate.setHours(0, 0, 0, 0)
    return dueDate >= today && dueDate < tomorrow
  })
}

export function getOverdueTasks(): Task[] {
  const now = new Date()
  return mockTasks.filter((t) => new Date(t.dueAt) < now && t.status !== "Done")
}

export function getTasksNext7Days(): Task[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)
  return mockTasks.filter((t) => {
    const dueDate = new Date(t.dueAt)
    return dueDate >= today && dueDate <= nextWeek && t.status !== "Done"
  })
}

export function createTask(taskData: Omit<Task, "id" | "createdAt" | "updatedAt">): Task {
  const newTask: Task = {
    ...taskData,
    id: `t${Date.now()}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  mockTasks.push(newTask)
  return newTask
}

