import type { PrismaClient } from '@prisma/client';

/** Build initials from a client name (e.g. "Viral Shah" → "VS"). */
export function clientNameToInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean);

  if (parts.length === 0) {
    return 'CL';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 3).toUpperCase();
  }

  return parts
    .slice(0, 3)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function formatClientCode(initials: string, year: number, seq: number): string {
  return `${initials}-${year}-${String(seq).padStart(3, '0')}`;
}

type ClientCodePrisma = Pick<PrismaClient, 'client'>;

export async function generateUniqueClientCode(
  prisma: ClientCodePrisma,
  tenantId: string,
  name: string,
): Promise<string> {
  const initials = clientNameToInitials(name);
  const year = new Date().getFullYear();
  const prefix = `${initials}-${year}-`;

  const latest = await prisma.client.findFirst({
    where: {
      tenantId,
      clientCode: { startsWith: prefix },
    },
    orderBy: { clientCode: 'desc' },
    select: { clientCode: true },
  });

  let seq = 1;
  if (latest?.clientCode) {
    const suffix = latest.clientCode.slice(prefix.length);
    const parsed = parseInt(suffix, 10);
    if (!Number.isNaN(parsed)) {
      seq = parsed + 1;
    }
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = formatClientCode(initials, year, seq + attempt);
    const existing = await prisma.client.findFirst({
      where: { tenantId, clientCode: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
  }

  return `${initials}-${year}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}
