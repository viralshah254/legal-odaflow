import { Injectable } from '@nestjs/common';
import type {
  ClaimAudit,
  ClaimBlock,
  LegalResearchDraft,
} from '@/ai/legal-research/legal-research-draft.types';

export interface ClaimRepairResult {
  claim: ClaimBlock;
  changed: boolean;
  removed: boolean;
}

@Injectable()
export class ClaimRepairService {
  repairClaim(claim: ClaimBlock, audit: ClaimAudit): ClaimRepairResult {
    if (audit.action === 'REMOVE') {
      return { claim, changed: true, removed: true };
    }

    if (audit.action === 'QUALIFY' || audit.action === 'REPAIR') {
      const qualifier = this.qualifierFor(audit);
      if (claim.text.startsWith(qualifier)) {
        return { claim, changed: false, removed: false };
      }
      return {
        claim: {
          ...claim,
          text: `${qualifier}${claim.text}`,
          confidence: Math.min(claim.confidence, 0.45),
        },
        changed: true,
        removed: false,
      };
    }

    return { claim, changed: false, removed: false };
  }

  repairMarkdown(
    markdown: string,
    audits: ClaimAudit[],
    draft?: LegalResearchDraft,
  ): string {
    // Verification findings carry claim status — do not prefix inline lawyer memo text.
    void audits;
    void draft;
    return markdown;
  }

  private replaceExactClaim(markdown: string, claimText: string, replacement: string): string {
    if (markdown.includes(claimText)) return markdown.replace(claimText, replacement);
    const compact = claimText.replace(/\s+/g, ' ').trim();
    const escaped = compact
      .split(' ')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+');
    return markdown.replace(new RegExp(escaped, 'i'), replacement);
  }

  private qualifierFor(audit: ClaimAudit): string {
    if (audit.passageSupport === 'PARTIAL') return 'To the extent supported by the retrieved passage, ';
    if (audit.passageSupport === 'INDETERMINATE') return 'Subject to source verification, ';
    return 'Unsupported by retrieved passages unless counsel verifies independently: ';
  }
}
