/**
 * Bulk-enrich JurisdictionForm.metadata from practiceArea using matter-intelligence inference rules.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/enrich-legal-forms-metadata.ts --dry-run
 *   npx ts-node --transpile-only scripts/enrich-legal-forms-metadata.ts --limit=100
 *
 * Note: run each command separately (do not paste shell `#` comment lines).
 */
import { PrismaClient } from '@prisma/client';
import type { MatterNature } from '../src/ai/matter-intelligence/matter-intelligence.types';

const prisma = new PrismaClient();

interface FormMetadata {
  matterPracticeArea: string;
  nature: MatterNature;
  subPracticeArea?: string;
  forum?: string;
  source: 'practice_area_rule' | 'form_name_rule';
}

interface PracticeAreaRule {
  matterPracticeArea: string;
  nature: MatterNature;
  subPracticeArea?: string;
  forum?: string;
}

/** Map catalog practiceArea values to matter-intelligence taxonomy slugs. */
const PRACTICE_AREA_RULES: Record<string, PracticeAreaRule> = {
  EMPLOYMENT_LABOUR: {
    matterPracticeArea: 'employment_labour',
    nature: 'dispute',
    forum: 'labour_court',
  },
  employment_labour: {
    matterPracticeArea: 'employment_labour',
    nature: 'dispute',
    forum: 'labour_court',
  },
  employment: {
    matterPracticeArea: 'employment_labour',
    nature: 'dispute',
    forum: 'labour_court',
  },
  CONSUMER: {
    matterPracticeArea: 'consumer',
    nature: 'dispute',
    forum: 'consumer_commission',
  },
  consumer: {
    matterPracticeArea: 'consumer',
    nature: 'dispute',
    forum: 'consumer_commission',
  },
  ARBITRATION: {
    matterPracticeArea: 'arbitration_adr',
    nature: 'dispute',
    forum: 'arbitral_tribunal',
    subPracticeArea: 'arbitration',
  },
  arbitration: {
    matterPracticeArea: 'arbitration_adr',
    nature: 'dispute',
    forum: 'arbitral_tribunal',
    subPracticeArea: 'arbitration',
  },
  arbitration_adr: {
    matterPracticeArea: 'arbitration_adr',
    nature: 'dispute',
    forum: 'arbitral_tribunal',
    subPracticeArea: 'arbitration',
  },
  FAMILY_MATRIMONIAL: {
    matterPracticeArea: 'family_matrimonial',
    nature: 'dispute',
    forum: 'family_court',
  },
  family_matrimonial: {
    matterPracticeArea: 'family_matrimonial',
    nature: 'dispute',
    forum: 'family_court',
  },
  CRIMINAL: {
    matterPracticeArea: 'litigation_disputes',
    nature: 'dispute',
    subPracticeArea: 'criminal_fir_bail',
  },
  criminal: {
    matterPracticeArea: 'litigation_disputes',
    nature: 'dispute',
    subPracticeArea: 'criminal_fir_bail',
  },
  CIVIL_LITIGATION: {
    matterPracticeArea: 'litigation_disputes',
    nature: 'dispute',
  },
  litigation: {
    matterPracticeArea: 'litigation_disputes',
    nature: 'dispute',
  },
  litigation_disputes: {
    matterPracticeArea: 'litigation_disputes',
    nature: 'dispute',
  },
  CORPORATE: {
    matterPracticeArea: 'corporate_commercial',
    nature: 'transaction',
  },
  corporate: {
    matterPracticeArea: 'corporate_commercial',
    nature: 'transaction',
  },
  corporate_commercial: {
    matterPracticeArea: 'corporate_commercial',
    nature: 'transaction',
  },
  PROPERTY: {
    matterPracticeArea: 'real_estate_property',
    nature: 'transaction',
  },
  property: {
    matterPracticeArea: 'real_estate_property',
    nature: 'transaction',
  },
  real_estate_property: {
    matterPracticeArea: 'real_estate_property',
    nature: 'transaction',
  },
  IMMIGRATION: {
    matterPracticeArea: 'immigration',
    nature: 'compliance',
  },
  immigration: {
    matterPracticeArea: 'immigration',
    nature: 'compliance',
  },
  tax: {
    matterPracticeArea: 'tax',
    nature: 'compliance',
  },
  insolvency: {
    matterPracticeArea: 'insolvency',
    nature: 'dispute',
    forum: 'nclt',
  },
};

const FORM_NAME_OVERRIDES: Array<{
  pattern: RegExp;
  patch: Partial<PracticeAreaRule>;
}> = [
  {
    pattern: /\b(wrongful termination|labour court|industrial dispute|workman)\b/i,
    patch: {
      matterPracticeArea: 'employment_labour',
      subPracticeArea: 'wrongful_termination',
      nature: 'dispute',
      forum: 'labour_court',
    },
  },
  {
    pattern: /\b(employment contract|offer letter|appointment letter)\b/i,
    patch: {
      matterPracticeArea: 'employment_labour',
      subPracticeArea: 'employment_contract',
      nature: 'transaction',
    },
  },
  {
    pattern: /\b(maintenance|alimony|bnss|crpc\s*125)\b/i,
    patch: {
      matterPracticeArea: 'family_matrimonial',
      subPracticeArea: 'maintenance',
      nature: 'dispute',
      forum: 'family_court',
    },
  },
  {
    pattern: /\b(bail|anticipatory bail|fir)\b/i,
    patch: {
      matterPracticeArea: 'litigation_disputes',
      subPracticeArea: 'criminal_fir_bail',
      nature: 'dispute',
    },
  },
  {
    pattern: /\b(consumer complaint|deficiency|defective)\b/i,
    patch: {
      matterPracticeArea: 'consumer',
      subPracticeArea: 'defective_product',
      nature: 'dispute',
      forum: 'consumer_commission',
    },
  },
  {
    pattern: /\b(arbitration|arbitral|section\s*34|section\s*11)\b/i,
    patch: {
      matterPracticeArea: 'arbitration_adr',
      subPracticeArea: 'arbitration',
      nature: 'dispute',
      forum: 'arbitral_tribunal',
    },
  },
  {
    pattern: /\b(nda|non.?disclosure|confidentiality agreement)\b/i,
    patch: {
      matterPracticeArea: 'corporate_commercial',
      subPracticeArea: 'nda',
      nature: 'transaction',
    },
  },
];

function parseArg(name: string): number | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  if (!arg) return undefined;
  const n = parseInt(arg.slice(prefix.length), 10);
  return Number.isFinite(n) ? n : undefined;
}

function inferMetadata(form: {
  practiceArea: string;
  formName: string;
  description?: string | null;
}): FormMetadata | null {
  const baseRule = PRACTICE_AREA_RULES[form.practiceArea];
  if (!baseRule) return null;

  let metadata: FormMetadata = {
    ...baseRule,
    source: 'practice_area_rule',
  };

  const haystack = `${form.formName} ${form.description ?? ''}`;
  for (const override of FORM_NAME_OVERRIDES) {
    if (override.pattern.test(haystack)) {
      metadata = {
        ...metadata,
        ...override.patch,
        source: 'form_name_rule',
      };
      break;
    }
  }

  return metadata;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limit = parseArg('limit');
  const offset = parseArg('offset') ?? 0;

  const allForms = await prisma.jurisdictionForm.findMany({
    where: { isSystem: true },
    orderBy: { id: 'asc' },
  });

  const forms = limit != null ? allForms.slice(offset, offset + limit) : allForms.slice(offset);
  console.log(
    `Enriching metadata for ${forms.length} forms (total=${allForms.length}, offset=${offset}${limit != null ? `, limit=${limit}` : ''}).`,
  );

  let updated = 0;
  let skipped = 0;
  let unchanged = 0;

  for (const form of forms) {
    const inferred = inferMetadata(form);
    if (!inferred) {
      skipped += 1;
      continue;
    }

    const existing = (form.metadata ?? {}) as Record<string, unknown>;
    const nextMetadata = {
      ...existing,
      ...inferred,
      enrichedAt: new Date().toISOString(),
    };

    const same =
      existing.matterPracticeArea === nextMetadata.matterPracticeArea &&
      existing.nature === nextMetadata.nature &&
      existing.subPracticeArea === nextMetadata.subPracticeArea &&
      existing.forum === nextMetadata.forum;

    if (same) {
      unchanged += 1;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] ${form.formName} (${form.practiceArea}) -> ${JSON.stringify(inferred)}`);
    } else {
      await prisma.jurisdictionForm.update({
        where: { id: form.id },
        data: { metadata: nextMetadata },
      });
    }
    updated += 1;
  }

  console.log(
    `${dryRun ? 'Would update' : 'Updated'} ${updated} forms; unchanged ${unchanged}; skipped ${skipped} (no rule).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
