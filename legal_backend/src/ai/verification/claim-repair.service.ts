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
    if (!draft) return markdown;
    let repaired = markdown;
    const claims = draft.issues.flatMap((issue) => issue.propositions);
    for (const audit of audits) {
      const claim = claims.find((item) => item.claimId === audit.claimId);
      if (!claim || !claim.text.trim() || audit.action === 'KEEP') continue;
      const replacement = audit.action === 'REMOVE'
        ? '[Unsupported proposition withheld pending source verification.]'
        : this.repairClaim(claim, {
            ...audit,
            action: audit.action === 'ESCALATE' ? 'QUALIFY' : audit.action,
          }).claim.text;
      // Replace every occurrence, including repetition in the direct answer.
      let next = this.replaceExactClaim(repaired, claim.text, replacement);
      if (audit.action === 'REMOVE') {
        while (next !== repaired) {
          repaired = next;
          next = this.replaceExactClaim(repaired, claim.text, replacement);
        }
      }
      repaired = next;
    }
    // Summaries can paraphrase a removed claim, so exact replacement alone cannot
    // establish that the answer/conclusions are clean. Do not retain those
    // unaudited paraphrases when any material proposition has been withheld.
    if (audits.some((audit) => audit.action === 'REMOVE')) {
      repaired = repaired.replace(
        /(^#{1,6}\s+(?:Short Answer|Direct Answer|Conclusion)\s*\n)[\s\S]*?(?=^#{1,6}\s|$(?![\s\S]))/gim,
        '$1\nSummary withheld because a supporting proposition failed source verification. Review the remaining source-linked analysis and verification findings.\n\n',
      );
    }
    return repaired;
  }

  private replaceExactClaim(markdown: string, claimText: string, replacement: string): string {
    if (markdown.includes(claimText)) return markdown.split(claimText).join(replacement);
    const compact = claimText.replace(/\s+/g, ' ').trim();
    const escaped = compact
      .split(' ')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+');
    return markdown.replace(new RegExp(escaped, 'gi'), replacement);
  }

  private qualifierFor(audit: ClaimAudit): string {
    if (audit.passageSupport === 'PARTIAL') return 'To the extent supported by the retrieved passage, ';
    if (audit.passageSupport === 'INDETERMINATE') return 'Subject to source verification, ';
    return 'Unsupported by retrieved passages unless counsel verifies independently: ';
  }
}
