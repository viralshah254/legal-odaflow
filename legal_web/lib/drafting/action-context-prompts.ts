export interface ActionContextField {
  id: string
  label: string
  placeholder: string
  multiline?: boolean
}

export interface ActionContextPrompt {
  actionKey: string
  label: string
  description?: string
  placeholder: string
  fields?: ActionContextField[]
}

const IMPUGNED_ORDER_PROMPT: ActionContextPrompt = {
  actionKey: "obtain_impugned_order",
  label: "Do you have the impugned order?",
  description: "Add court, date, section cited, and amount ordered — this improves form matching.",
  placeholder:
    "e.g. Family Court Ahmedabad, interim maintenance ₹1,00,000/month under DV Act §23, order dated 15 Feb 2025",
  fields: [
    {
      id: "order_details",
      label: "Order details",
      placeholder: "Court, date, section, amount, parties",
      multiline: true,
    },
  ],
}

const OBTAIN_PREFIX = /^Obtain:\s*(.+)$/i

export function getActionContextPrompt(action: string): ActionContextPrompt | null {
  const trimmed = action.trim()
  if (!trimmed) return null

  const obtainMatch = trimmed.match(OBTAIN_PREFIX)
  if (obtainMatch) {
    const item = obtainMatch[1].trim()
    if (/impugned\s+order/i.test(item)) {
      return IMPUGNED_ORDER_PROMPT
    }
    return {
      actionKey: `obtain_${item.toLowerCase().replace(/\s+/g, "_")}`,
      label: `Add details for: ${item}`,
      description: "Provide what you know — court, date, parties, or key excerpts.",
      placeholder: `Details about ${item}…`,
      fields: [
        {
          id: "details",
          label: item,
          placeholder: `Paste or describe ${item}`,
          multiline: true,
        },
      ],
    }
  }

  if (/draft|prepare|file|review|identify|gather|send/i.test(trimmed)) {
    return {
      actionKey: `step_${trimmed.toLowerCase().replace(/\s+/g, "_").slice(0, 40)}`,
      label: "Tell us more about this step",
      description: trimmed,
      placeholder: `Additional context for: ${trimmed}`,
      fields: [
        {
          id: "details",
          label: "Your context",
          placeholder: "What have you already done or what details apply?",
          multiline: true,
        },
      ],
    }
  }

  return {
    actionKey: `action_${trimmed.toLowerCase().replace(/\s+/g, "_").slice(0, 40)}`,
    label: "Add context for this action",
    description: trimmed,
    placeholder: `Details relevant to: ${trimmed}`,
    fields: [
      {
        id: "details",
        label: "Details",
        placeholder: "Add any facts that help narrow the right form or draft",
        multiline: true,
      },
    ],
  }
}

export function buildSupplementalFromActionNotes(actionNotes: Record<string, string>): string {
  const lines = Object.entries(actionNotes)
    .filter(([, value]) => value.trim())
    .map(([action, value]) => `Regarding "${action}": ${value.trim()}`)
  return lines.join("\n").slice(0, 2000)
}
