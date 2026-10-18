import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface ActStructureUnitRef {
  count: number;
  ids: string[];
  lastId?: string;
}

export interface ActStructureReferenceEntry {
  manifestActId: string;
  registryActId?: string;
  sourcePdf: string;
  structure: {
    sections?: ActStructureUnitRef;
    articles?: ActStructureUnitRef;
    orders?: ActStructureUnitRef;
    schedules?: ActStructureUnitRef;
    structureProfile?: string;
  };
  sectionCount: number;
  orderCount?: number;
  scheduleCount?: number;
  articleCount?: number;
}

export interface ActStructureReferenceFile {
  generatedAt: string;
  acts: Record<string, ActStructureReferenceEntry>;
}

let cached: ActStructureReferenceFile | null = null;

export function loadActStructureReference(): ActStructureReferenceFile {
  if (cached) return cached;
  const path = resolve(process.cwd(), 'corpus/in/act-structure.reference.json');
  if (!existsSync(path)) {
    return { generatedAt: '', acts: {} };
  }
  cached = JSON.parse(readFileSync(path, 'utf8')) as ActStructureReferenceFile;
  return cached;
}

export function getActStructure(manifestOrRegistryActId: string): ActStructureReferenceEntry | undefined {
  const ref = loadActStructureReference();
  return (
    ref.acts[manifestOrRegistryActId] ??
    Object.values(ref.acts).find((a) => a.registryActId === manifestOrRegistryActId)
  );
}

export function isProvisionIdValid(
  actId: string,
  provisionKey: string,
): { valid: boolean; message?: string; structure?: ActStructureReferenceEntry } {
  const structure = getActStructure(actId);
  if (!structure) return { valid: true };

  const key = provisionKey.toUpperCase().replace(/^ORDER-|^SCHEDULE-/, '');
  const normalized = provisionKey.toLowerCase();

  if (normalized.startsWith('order-')) {
    const orderId = provisionKey.replace(/^order-/i, '').toUpperCase();
    const orders = structure.structure.orders;
    if (orders && !orders.ids.includes(orderId)) {
      return {
        valid: false,
        structure,
        message: `Order ${orderId} does not exist (${orders.count} Orders, ends at Order ${orders.lastId})`,
      };
    }
    return { valid: true, structure };
  }

  if (normalized.startsWith('schedule-')) {
    const schedId = provisionKey.replace(/^schedule-/i, '').toUpperCase();
    const schedules = structure.structure.schedules;
    if (schedules && !schedules.ids.includes(schedId)) {
      return {
        valid: false,
        structure,
        message: `Schedule ${schedId} does not exist (${schedules.count} Schedules)`,
      };
    }
    return { valid: true, structure };
  }

  const sections = structure.structure.sections ?? structure.structure.articles;
  if (sections && !sections.ids.includes(key)) {
    const unit = structure.structure.articles ? 'Article' : 'Section';
    return {
      valid: false,
      structure,
      message: `${unit} ${key} does not exist (${sections.count} ${unit.toLowerCase()}s, ends at ${sections.lastId})`,
    };
  }

  return { valid: true, structure };
}
