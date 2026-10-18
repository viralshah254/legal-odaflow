export const MATTER_STATUSES = {
  OPEN: 'OPEN',
  ON_HOLD: 'ON_HOLD',
  CLOSED: 'CLOSED',
  ARCHIVED: 'ARCHIVED',
} as const;

export const MATTER_STATUS_VALUES = Object.values(MATTER_STATUSES);

export const MATTER_STAGES = {
  INTAKE: 'Intake',
  ACTIVE: 'Active',
  DISCOVERY: 'Discovery',
  NEGOTIATION: 'Negotiation',
  CLOSING: 'Closing',
  CLOSED: 'Closed',
} as const;

export const MATTER_STAGE_VALUES = Object.values(MATTER_STAGES);

const STATUS_ALIASES: Record<string, (typeof MATTER_STATUS_VALUES)[number]> = {
  ACTIVE: MATTER_STATUSES.OPEN,
  OPEN: MATTER_STATUSES.OPEN,
  ONHOLD: MATTER_STATUSES.ON_HOLD,
  ON_HOLD: MATTER_STATUSES.ON_HOLD,
  CLOSED: MATTER_STATUSES.CLOSED,
  ARCHIVED: MATTER_STATUSES.ARCHIVED,
};

export function normalizeMatterStatus(value: string): string {
  const key = value.trim().replace(/[\s-]+/g, '_').toUpperCase();
  return STATUS_ALIASES[key] ?? value;
}

export function normalizeMatterStage(value: string): string {
  const normalized = value.trim().replace(/[\s_-]+/g, '').toLowerCase();
  return (
    MATTER_STAGE_VALUES.find(
      (stage) => stage.replace(/\s+/g, '').toLowerCase() === normalized,
    ) ?? value
  );
}

export function matterStatusFilterValues(value: string): string[] {
  const canonical = normalizeMatterStatus(value);
  if (canonical === MATTER_STATUSES.OPEN) {
    return [MATTER_STATUSES.OPEN, 'Active', 'ACTIVE', 'Open', 'open'];
  }
  if (canonical === MATTER_STATUSES.ON_HOLD) {
    return [MATTER_STATUSES.ON_HOLD, 'On Hold', 'ON HOLD', 'on_hold'];
  }
  return [canonical, canonical.toLowerCase(), capitalize(canonical)];
}

export function matterStageFilterValues(value: string): string[] {
  const canonical = normalizeMatterStage(value);
  return [canonical, canonical.toUpperCase(), canonical.toLowerCase()];
}

function capitalize(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
