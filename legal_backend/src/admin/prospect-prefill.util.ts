import type { LawyerProspect } from '@prisma/client';

export type ProspectPrefill = {
  name: string;
  firmName?: string;
  practiceType: 'SOLO' | 'FIRM';
  phone?: string;
  countryCode: string;
  jurisdiction?: string;
};

export function formatPersonName(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b([a-z])/g, (char) => char.toUpperCase());
}

export function splitFullName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: '', lastName: null };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function countryToCountryCode(country?: string | null): string {
  const normalized = country?.trim().toLowerCase();
  if (!normalized || normalized === 'india') return 'IN';
  if (normalized.length === 2) return normalized.toUpperCase();
  return 'IN';
}

export function mapProspectToPrefill(prospect: LawyerProspect): ProspectPrefill {
  const practiceType = prospect.organisation?.trim() ? 'FIRM' : 'SOLO';
  return {
    name: prospect.fullName,
    firmName: practiceType === 'FIRM' ? prospect.organisation ?? undefined : undefined,
    practiceType,
    phone: prospect.phone ?? undefined,
    countryCode: countryToCountryCode(prospect.country),
    jurisdiction: prospect.state ?? undefined,
  };
}
