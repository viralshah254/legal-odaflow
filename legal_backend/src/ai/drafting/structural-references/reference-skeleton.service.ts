import { Injectable } from '@nestjs/common';
import { getSkeletonForKind, type IndiaDraftSkeleton } from './india-reference-skeletons';

@Injectable()
export class DraftStructuralReferenceService {
  /**
   * Returns the structural reference skeleton for the given document kind.
   * Returns null when no skeleton exists (e.g. unsupported / custom kind).
   */
  getReference(kind: string): IndiaDraftSkeleton | null {
    return getSkeletonForKind(kind);
  }

  /**
   * Builds a REFERENCE STRUCTURE prompt block for injection into the pass-1 system prompt.
   * The block shows the AI exactly what structure is expected.
   */
  buildPromptBlock(kind: string): string {
    const skeleton = this.getReference(kind);
    if (!skeleton) return '';

    return `
REFERENCE STRUCTURE (mandatory — follow this structural template exactly):
─────────────────────────────────────────────────────────────────
Cause title vehicle: ${skeleton.causeTitleVehicle}
Party designators: ${skeleton.petitionerDesignator} vs ${skeleton.respondentDesignator}
${skeleton.mandatorySections.length > 0 ? `Governing sections that MUST appear: ${skeleton.mandatorySections.join(', ')}` : ''}

Minimum structural example (use this heading/section order, fill in facts and add grounds):

${skeleton.referenceText}
─────────────────────────────────────────────────────────────────
The above is a structural skeleton only. Replace all [BLANK: …] with correct facts from the case details, add all required grounds with verified authorities, and expand as needed for a complete filing-grade document.
`;
  }
}
