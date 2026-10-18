import { Injectable } from '@nestjs/common';
import { getSkeletonForKind } from './structural-references/india-reference-skeletons';

/**
 * Post-generation structural audit.
 * Checks whether the generated draft's cause title vehicle and required sections
 * match what the skeleton mandates for the given document kind.
 * Returns a list of violation strings (empty = structure is correct).
 */
@Injectable()
export class DraftStructureAuditService {
  audit(draftText: string, kind: string): string[] {
    const skeleton = getSkeletonForKind(kind);
    if (!skeleton) return [];

    const violations: string[] = [];
    const upper = draftText.toUpperCase();

    // Check cause title vehicle appears in the document.
    const vehicle = skeleton.causeTitleVehicle.toUpperCase();
    if (!upper.includes(vehicle)) {
      violations.push(
        `Expected cause title vehicle "${skeleton.causeTitleVehicle}" not found in draft. ` +
          `Check that the document is the correct type.`,
      );
    }

    // Check that each mandatory section label appears in the document.
    for (const section of skeleton.mandatorySections) {
      // Flexible match: "BNSS §438" → look for "438" + "BNSS" in proximity, or "§438"
      const sectionNum = section.replace(/[^0-9]/g, '');
      const actLabel = section.replace(/\s*§.*/, '').toUpperCase();
      const inDoc =
        upper.includes(`§${sectionNum}`) ||
        upper.includes(`SECTION ${sectionNum}`) ||
        upper.includes(`S.${sectionNum}`) ||
        (actLabel && upper.includes(actLabel) && upper.includes(sectionNum));
      if (!inDoc) {
        violations.push(`Mandatory section "${section}" not found in draft.`);
      }
    }

    // Check party designators are present.
    const petDesignator = skeleton.petitionerDesignator.toUpperCase();
    const respDesignator = skeleton.respondentDesignator.toUpperCase();
    if (!upper.includes(petDesignator) && !['SERVICE PROVIDER', 'DISCLOSING PARTY', 'COMPLAINANT', 'APPLICANT'].some((d) => upper.includes(d))) {
      violations.push(`Expected party designator "${skeleton.petitionerDesignator}" not found.`);
    }
    if (!upper.includes(respDesignator) && !['DEFENDANT', 'OPPOSITE PARTY', 'RECEIVING PARTY', 'ACCUSED'].some((d) => upper.includes(d))) {
      violations.push(`Expected party designator "${skeleton.respondentDesignator}" not found.`);
    }

    return violations;
  }
}
