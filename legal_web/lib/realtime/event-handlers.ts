import type { QueryClient } from "@tanstack/react-query"
import { REALTIME_EVENTS, type RealtimeEventPayload } from "./events"

export function invalidateQueriesForRealtimeEvent(
  queryClient: QueryClient,
  event: string,
  payload: RealtimeEventPayload,
  activeTenantId: string | null,
) {
  if (!activeTenantId || payload.tenantId !== activeTenantId) return

  switch (event) {
    case REALTIME_EVENTS.TASK_CREATED:
    case REALTIME_EVENTS.TASK_UPDATED:
    case REALTIME_EVENTS.TASK_DELETED:
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      break
    case REALTIME_EVENTS.MATTER_CREATED:
    case REALTIME_EVENTS.MATTER_UPDATED:
      queryClient.invalidateQueries({ queryKey: ["matters"] })
      queryClient.invalidateQueries({ queryKey: ["matter"] })
      break
    case REALTIME_EVENTS.CLIENT_CREATED:
    case REALTIME_EVENTS.CLIENT_UPDATED:
      queryClient.invalidateQueries({ queryKey: ["clients"] })
      queryClient.invalidateQueries({ queryKey: ["client"] })
      break
    case REALTIME_EVENTS.NOTIFICATION_CREATED:
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
      break
    case REALTIME_EVENTS.CREDIT_BALANCE_UPDATED:
      queryClient.invalidateQueries({ queryKey: ["credit-wallet"] })
      queryClient.invalidateQueries({ queryKey: ["credits"] })
      break
    case REALTIME_EVENTS.AGENT_JOB_UPDATED:
      queryClient.invalidateQueries({ queryKey: ["agent-jobs"] })
      queryClient.invalidateQueries({ queryKey: ["agents"] })
      break
    case REALTIME_EVENTS.DOCUMENT_OCR_UPDATED:
      queryClient.invalidateQueries({ queryKey: ["documents"] })
      queryClient.invalidateQueries({ queryKey: ["document-jobs"] })
      break
    case REALTIME_EVENTS.CALENDAR_EVENT_UPDATED:
      queryClient.invalidateQueries({ queryKey: ["calendar"] })
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] })
      break
    case REALTIME_EVENTS.ALERT_CREATED:
    case REALTIME_EVENTS.ALERT_UPDATED:
      queryClient.invalidateQueries({ queryKey: ["alerts"] })
      break
    case REALTIME_EVENTS.LEAD_CREATED:
    case REALTIME_EVENTS.LEAD_UPDATED:
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      break
    case REALTIME_EVENTS.DASHBOARD_METRICS_UPDATED:
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["command-center"] })
      break
    case REALTIME_EVENTS.COPILOT_MESSAGE_CREATED:
    case REALTIME_EVENTS.COPILOT_JOB_COMPLETED:
      queryClient.invalidateQueries({ queryKey: ["copilot-sessions"] })
      queryClient.invalidateQueries({ queryKey: ["copilot-messages"] })
      break
    case REALTIME_EVENTS.TIME_ENTRY_UPDATED:
      queryClient.invalidateQueries({ queryKey: ["time-entries"] })
      break
    case REALTIME_EVENTS.INVOICE_UPDATED:
    case REALTIME_EVENTS.TRUST_UPDATED:
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["trust"] })
      queryClient.invalidateQueries({ queryKey: ["finance"] })
      break
    case REALTIME_EVENTS.MEETING_STATUS_UPDATED:
      void queryClient.refetchQueries({ queryKey: ["meetings"] })
      void queryClient.refetchQueries({ queryKey: ["meeting"] })
      void queryClient.refetchQueries({ queryKey: ["meeting-transcript"] })
      void queryClient.refetchQueries({ queryKey: ["meeting-notes"] })
      break
    default:
      break
  }
}
