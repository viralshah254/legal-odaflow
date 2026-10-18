/**
 * Seed StatuteSectionProfile rows from curated section finder data.
 *
 * Run:
 *   npm run seed:section-profiles          # India (default)
 *   npm run seed:section-profiles -- US    # United States
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SectionFinderProfileService } from '../src/legal-search/india-section-finder/section-finder-profile.service';
import { SECTION_FINDER_DATA } from '../src/legal-search/india-section-finder/section-finder.index';
import { US_SECTION_FINDER_DATA, US_SECTION_FINDER_ACT_IDS } from '../src/legal-search/us-section-finder/us-section-finder.index';
import type { SectionFinderEntry } from '../src/legal-search/india-section-finder/section-finder.types';

function resolveActId(entry: SectionFinderEntry): string {
  if (entry.legacyActId !== 'other') {
    if (entry.legacyActId === 'ni_act') return 'nia';
    return entry.legacyActId;
  }

  if (entry.id.startsWith('INCOME-TAX-')) return 'income-tax';
  if (entry.id.startsWith('GST-ACT-')) return 'gst-act';
  if (entry.id.startsWith('CUSTOMS-ACT-')) return 'customs-act';

  return entry.legacyActShort.toLowerCase().replace(/\s+/g, '-');
}

function resolveUsActId(entry: SectionFinderEntry, index: number): string {
  return US_SECTION_FINDER_ACT_IDS[index] ?? resolveActId(entry);
}

async function seedCountry(
  profileService: SectionFinderProfileService,
  countryCode: 'IN' | 'US',
  entries: SectionFinderEntry[],
) {
  let upserted = 0;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const actId =
      countryCode === 'US' ? resolveUsActId(entry, i) : resolveActId(entry);
    await profileService.upsertFromCuratedEntry(countryCode, entry, actId);
    upserted += 1;
  }
  return upserted;
}

async function main() {
  const countryArg = process.argv.find((a) => a === 'US' || a === 'IN') ?? 'IN';
  const countryCode = countryArg.toUpperCase() as 'IN' | 'US';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const profileService = app.get(SectionFinderProfileService);
    const entries = countryCode === 'US' ? US_SECTION_FINDER_DATA : SECTION_FINDER_DATA;
    const upserted = await seedCountry(profileService, countryCode, entries);

    console.log(
      JSON.stringify({ countryCode, upserted, total: entries.length }, null, 2),
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
