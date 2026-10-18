import { Injectable } from '@nestjs/common';
import type { EvidenceAnalysisFlags, EvidenceRef } from './matter-intelligence.types';

export interface EvidenceAnalysisResult {
  items: EvidenceRef[];
  contradictions: Array<{ itemA: string; itemB: string; reason: string }>;
}

/** P13-04 — heuristic flags on extracted evidence items. */
@Injectable()
export class EvidenceAnalysisService {
  analyze(items: EvidenceRef[]): EvidenceAnalysisResult {
    const enriched = items.map((item) => ({
      ...item,
      flags: this.detectFlags(item),
    }));

    const contradictions: EvidenceAnalysisResult['contradictions'] = [];
    for (let i = 0; i < enriched.length; i++) {
      for (let j = i + 1; j < enriched.length; j++) {
        const reason = this.detectContradiction(enriched[i], enriched[j]);
        if (reason) {
          contradictions.push({
            itemA: enriched[i].description.slice(0, 80),
            itemB: enriched[j].description.slice(0, 80),
            reason,
          });
          enriched[i] = {
            ...enriched[i],
            flags: { ...enriched[i].flags, contradiction: true },
          };
          enriched[j] = {
            ...enriched[j],
            flags: { ...enriched[j].flags, contradiction: true },
          };
        }
      }
    }

    return { items: enriched, contradictions };
  }

  private detectFlags(item: EvidenceRef): EvidenceAnalysisFlags {
    const text = item.description.toLowerCase();
    return {
      admission: /\b(admit|admitted|confess|acknowledg)\b/.test(text),
      paymentProof: /\b(paid|payment|receipt|salary|invoice|transaction|utr|neft)\b/.test(text),
      threat: /\b(threat|threaten|threatened|harass|intimidat|coerc|blackmail)\b/.test(text),
      contradiction: item.flags?.contradiction,
    };
  }

  private detectContradiction(a: EvidenceRef, b: EvidenceRef): string | null {
    const ta = a.description.toLowerCase();
    const tb = b.description.toLowerCase();
    if (a.date && b.date && a.date !== b.date) {
      if (/\bterminated\b/.test(ta) && /\bcontinued\b|\breinstated\b/.test(tb)) {
        return 'Conflicting employment status dates';
      }
    }
    if (/\bnot terminated\b|\bno termination\b/.test(ta) && /\bterminated\b/.test(tb)) {
      return 'Conflicting termination statements';
    }
    if (/\bdenied\b|\bdispute\b/.test(ta) && /\badmitted\b|\bconfirmed\b/.test(tb)) {
      return 'Conflicting admission/denial language';
    }
    return null;
  }
}
