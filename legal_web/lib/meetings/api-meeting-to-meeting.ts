import type { ApiMeeting } from "@/lib/api/meetings"
import type { Meeting } from "@/lib/types/meetings"

/** Map backend meeting payload to UI Meeting type. */
export function apiMeetingToMeeting(m: ApiMeeting, userId = ""): Meeting {
  return {
    id: m.id,
    tenantId: m.tenantId,
    clientId: m.clientId ?? "",
    matterId: m.matterId ?? undefined,
    title: m.title,
    description: m.description ?? undefined,
    startAt: m.startAt ? new Date(m.startAt) : new Date(),
    endAt: m.endAt ? new Date(m.endAt) : undefined,
    createdByUserId: m.createdByUserId ?? userId,
    participants: m.participants ?? [],
    source: (m.source ?? "manual_recording") as Meeting["source"],
    confidentiality: (m.confidentiality ?? "standard") as Meeting["confidentiality"],
    visibilityAllowListUserIds: [],
    status: (m.status ?? "draft") as Meeting["status"],
    tags: m.tags ?? [],
    durationMs: m.durationMs ?? undefined,
    createdAt: new Date(m.createdAt),
    updatedAt: new Date(m.updatedAt),
  }
}
