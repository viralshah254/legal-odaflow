import { apiFetch } from "./client"

export interface TaskParticipant {
  id: string
  tenantId: string
  taskId: string
  participantType: "USER" | "CLIENT"
  userId?: string | null
  clientId?: string | null
  role: "ASSIGNEE" | "COLLABORATOR" | "WATCHER" | "CLIENT"
}

export interface TaskComment {
  id: string
  tenantId: string
  taskId: string
  body: string
  authorUserId?: string | null
  authorClientId?: string | null
  createdAt: string
}

export interface ApiTask {
  id: string
  tenantId: string
  matterId?: string | null
  title: string
  description?: string | null
  notes?: string | null
  assigneeId?: string | null
  assignedToId?: string | null
  dueDate?: string | null
  priority: string
  status: string
  createdAt: string
  updatedAt?: string | null
  participants?: TaskParticipant[]
  comments?: TaskComment[]
}

export interface ParticipantInput {
  participantType: "USER" | "CLIENT"
  userId?: string
  clientId?: string
  role: "ASSIGNEE" | "COLLABORATOR" | "WATCHER" | "CLIENT"
}

export interface CreateTaskRequest {
  title: string
  description?: string
  notes?: string
  matterId?: string
  assigneeId?: string
  assignedToId?: string
  dueDate?: string
  priority?: string
  status?: string
  participants?: ParticipantInput[]
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  notes?: string
  assigneeId?: string
  assignedToId?: string
  matterId?: string
  dueDate?: string
  priority?: string
  status?: string
  participants?: ParticipantInput[]
}

const PRIORITY_MAP: Record<string, string> = {
  Low: "LOW",
  Normal: "MEDIUM",
  High: "HIGH",
  Critical: "URGENT",
}

const STATUS_MAP: Record<string, string> = {
  Todo: "TODO",
  "In Progress": "IN_PROGRESS",
  Done: "DONE",
  Cancelled: "CANCELLED",
}

function mapTask(row: ApiTask): ApiTask {
  return {
    ...row,
    assignedToId: row.assigneeId ?? row.assignedToId ?? null,
  }
}

function normalizeCreatePayload(data: CreateTaskRequest) {
  const priority = data.priority
    ? PRIORITY_MAP[data.priority] ?? data.priority.toUpperCase()
    : undefined
  const status = data.status
    ? STATUS_MAP[data.status] ?? data.status.toUpperCase().replace(/\s+/g, "_")
    : undefined

  return {
    title: data.title,
    description: data.description,
    notes: data.notes,
    matterId: data.matterId,
    assigneeId: data.assigneeId ?? data.assignedToId,
    dueDate: data.dueDate,
    priority,
    status,
    participants: data.participants,
  }
}

function normalizeUpdatePayload(data: UpdateTaskRequest) {
  const priority = data.priority
    ? PRIORITY_MAP[data.priority] ?? data.priority.toUpperCase()
    : undefined
  const status = data.status
    ? STATUS_MAP[data.status] ?? data.status.toUpperCase().replace(/\s+/g, "_")
    : undefined

  return {
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
    ...(data.matterId !== undefined ? { matterId: data.matterId } : {}),
    ...(data.assigneeId !== undefined || data.assignedToId !== undefined
      ? { assigneeId: data.assigneeId ?? data.assignedToId }
      : {}),
    ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(data.participants !== undefined ? { participants: data.participants } : {}),
  }
}

export async function listTasks(
  tenantId: string,
  matterId?: string,
  opts?: { page?: number; limit?: number; all?: boolean },
): Promise<ApiTask[]> {
  const params = new URLSearchParams()
  if (matterId) params.set("matterId", matterId)
  if (opts?.page) params.set("page", String(opts.page))
  if (opts?.limit) params.set("limit", String(opts.limit))
  if (opts?.all) params.set("all", "1")
  const query = params.toString() ? `?${params.toString()}` : ""
  const rows = await apiFetch<ApiTask[]>(`/tasks${query}`, { tenantId })
  return rows.map(mapTask)
}

export async function getTask(
  tenantId: string,
  taskId: string,
): Promise<ApiTask> {
  const row = await apiFetch<ApiTask>(`/tasks/${taskId}`, { tenantId })
  return mapTask(row)
}

export async function createTask(
  tenantId: string,
  data: CreateTaskRequest,
): Promise<ApiTask> {
  const row = await apiFetch<ApiTask>("/tasks", {
    method: "POST",
    tenantId,
    body: normalizeCreatePayload(data),
  })
  return mapTask(row)
}

export async function updateTask(
  tenantId: string,
  taskId: string,
  data: UpdateTaskRequest,
): Promise<ApiTask> {
  const row = await apiFetch<ApiTask>(`/tasks/${taskId}`, {
    method: "PATCH",
    tenantId,
    body: normalizeUpdatePayload(data),
  })
  return mapTask(row)
}

export async function deleteTask(
  tenantId: string,
  taskId: string,
): Promise<void> {
  await apiFetch(`/tasks/${taskId}`, {
    method: "DELETE",
    tenantId,
  })
}

export async function addTaskComment(
  tenantId: string,
  taskId: string,
  body: string,
): Promise<TaskComment> {
  return apiFetch<TaskComment>(`/tasks/${taskId}/comments`, {
    method: "POST",
    tenantId,
    body: { body },
  })
}
