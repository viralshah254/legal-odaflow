import { Injectable } from '@nestjs/common';
import type { PleadingAmendment } from './draft-pleading-review.service';

export interface ApplyAmendmentsResult {
  draft: string;
  applied: PleadingAmendment[];
  skipped: PleadingAmendment[];
}

/**
 * Applies only safe, autoApplicable pleading amendments.
 * Never auto-applies prayer changes or unverified new citations without originalText match.
 */
@Injectable()
export class DraftAmendmentApplierService {
  apply(draft: string, amendments: PleadingAmendment[]): ApplyAmendmentsResult {
    let next = draft;
    const applied: PleadingAmendment[] = [];
    const skipped: PleadingAmendment[] = [];

    for (const a of amendments) {
      if (!a.autoApplicable) {
        skipped.push(a);
        continue;
      }
      // Never auto-change prayer block content via free-form insert without anchor
      if (/prayer/i.test(a.reason) && /relief|grant\s+bail/i.test(a.suggestedText)) {
        skipped.push(a);
        continue;
      }

      if (a.originalText && next.includes(a.originalText)) {
        next = next.replace(a.originalText, a.suggestedText);
        applied.push(a);
        continue;
      }

      // Insert missing ground before PRAYER
      if (!a.originalText && a.category === 'fact' && a.suggestedText) {
        const prayerIdx = next.search(/\n\s*PRAYER\b/i);
        if (prayerIdx >= 0) {
          next = `${next.slice(0, prayerIdx)}\n\n${a.suggestedText}\n${next.slice(prayerIdx)}`;
          applied.push(a);
        } else {
          next = `${next.trimEnd()}\n\n${a.suggestedText}\n`;
          applied.push(a);
        }
        continue;
      }

      skipped.push(a);
    }

    return { draft: next, applied, skipped };
  }
}
