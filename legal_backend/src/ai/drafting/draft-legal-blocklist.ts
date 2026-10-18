/** Hard blocklist for filing-grade India court drafts — unverified legal conclusions. */

export interface LegalSafetyCheckInput {
  draft: string;
  recommendedKind?: string;
  causeTitleVehicle?: string;
}

export interface LegalSafetyViolation {
  id: string;
  reason: string;
  pattern: string;
}

const AUDIT_FOOTER_SECTION_PATTERNS: RegExp[] = [
  /^#{1,3}\s*NOTES ON COMPLETION[\s\S]*$/gim,
  /^#{1,3}\s*COUNSEL'?S?\s+CERTIFICATION[\s\S]*$/gim,
  /^#{1,3}\s*DISCLAIMER[\s\S]*$/gim,
  /^\*\*CRITICAL GAPS[\s\S]*?(?=\n#{1,2}\s|\n[A-Z]{3,}\s|$)/gim,
  /^\*\*AUTHORITY GAPS[\s\S]*?(?=\n#{1,2}\s|\n[A-Z]{3,}\s|$)/gim,
  /^\*\*ACTION REQUIRED[\s\S]*?(?=\n#{1,2}\s|\n[A-Z]{3,}\s|$)/gim,
  /^\*\*VERIFIED AUTHORITY RETRIEVED[\s\S]*?(?=\n#{1,2}\s|\n[A-Z]{3,}\s|$)/gim,
];

export function stripAuditFooters(text: string): { text: string; stripped: string[] } {
  let out = text;
  const stripped: string[] = [];
  for (const pattern of AUDIT_FOOTER_SECTION_PATTERNS) {
    const before = out;
    out = out.replace(pattern, '').trim();
    if (out !== before) stripped.push('audit_footer');
  }
  return { text: out, stripped };
}

export function resolveCauseTitleVehicle(recommendedKind: string): string {
  if (/suit_recovery_cpc_37|summary_suit_recovery/i.test(recommendedKind)) {
    return 'COMMERCIAL SUMMARY SUIT UNDER ORDER XXXVII CPC';
  }
  if (/civil_suit_money_recovery|money_recovery_suit/i.test(recommendedKind)) {
    return 'COMMERCIAL SUIT FOR RECOVERY';
  }
  if (/civil_plaint|suit_specific_performance|suit_permanent_injunction/i.test(recommendedKind)) {
    return 'PLAINT';
  }
  if (/maintenance_order_revision|criminal_revision/i.test(recommendedKind)) {
    return 'CRIMINAL REVISION PETITION';
  }
  if (/maintenance_appeal|criminal_appeal/i.test(recommendedKind)) {
    return 'MEMORANDUM OF APPEAL';
  }
  if (/civil_appeal/i.test(recommendedKind)) {
    return 'CIVIL APPEAL';
  }
  if (/writ/i.test(recommendedKind)) {
    return 'WRIT PETITION';
  }
  if (/bail/i.test(recommendedKind)) {
    return 'BAIL APPLICATION';
  }
  return 'CAUSE TITLE TO BE CONFIRMED';
}

export function detectLegalSafetyViolations(input: LegalSafetyCheckInput): LegalSafetyViolation[] {
  const violations: LegalSafetyViolation[] = [];
  const draft = input.draft;
  const kind = input.recommendedKind ?? '';
  const isMaintenanceRevision =
    /maintenance_order_revision|criminal_revision/i.test(kind) ||
    input.causeTitleVehicle === 'CRIMINAL REVISION PETITION';

  if (/article\s+133\b/i.test(draft) && isMaintenanceRevision) {
    violations.push({
      id: 'article_133_hc_maintenance',
      reason: 'Article 133 governs Supreme Court civil appeals — not a typical High Court maintenance revision vehicle.',
      pattern: 'Article 133',
    });
  }

  if (isMaintenanceRevision && /\bCIVIL\s+APPEAL\b/i.test(draft)) {
    violations.push({
      id: 'civil_appeal_on_revision',
      reason: 'Interim maintenance challenges should use CRIMINAL REVISION PETITION, not CIVIL APPEAL.',
      pattern: 'CIVIL APPEAL',
    });
  }

  if (
    isMaintenanceRevision &&
    (/balance of convenience/i.test(draft) || /irreparable injur/i.test(draft))
  ) {
    violations.push({
      id: 'injunction_test_maintenance',
      reason: 'Order XXXIX injunction tests (prima facie / balance of convenience) are not the standard for BNSS §144 maintenance proceedings.',
      pattern: 'injunction test language',
    });
  }

  if (
    /appropriate forum to hear appeals|has jurisdiction to entertain this appeal/i.test(draft) &&
    !/\[PROCEDURAL VEHICLE|\[AUTHORITY TO BE ADDED|TO BE CONFIRMED/i.test(draft)
  ) {
    violations.push({
      id: 'unverified_maintainability',
      reason: 'Maintainability stated as fact without verified authority or confirmation placeholder.',
      pattern: 'unverified maintainability',
    });
  }

  if (/counsel.*certif|bona fide and are not frivolous/i.test(draft)) {
    violations.push({
      id: 'counsel_certification',
      reason: 'Counsel certification boilerplate is not a standard Indian appellate pleading requirement.',
      pattern: 'Counsel Certification',
    });
  }

  const expectedVehicle = input.causeTitleVehicle;
  if (expectedVehicle && expectedVehicle !== 'CAUSE TITLE TO BE CONFIRMED') {
    const hasWrongVehicle =
      expectedVehicle === 'CRIMINAL REVISION PETITION' &&
      /\bMEMORANDUM OF APPEAL\b/i.test(draft) &&
      !/\bCRIMINAL REVISION PETITION\b/i.test(draft);
    if (hasWrongVehicle) {
      violations.push({
        id: 'wrong_cause_title_vehicle',
        reason: `Expected cause title vehicle "${expectedVehicle}" but draft uses MEMORANDUM OF APPEAL.`,
        pattern: 'wrong cause title',
      });
    }
  }

  return violations;
}

export function authoritiesOnPointForKind(
  authorities: Array<{ title?: string | null; summary?: string | null; citation?: string | null }>,
  kind: string,
  caseDetails: string,
): boolean {
  if (authorities.length === 0) return false;
  const hay = `${kind} ${caseDetails}`.toLowerCase();
  if (!/maintenance|125|144|crpc|bnss|alimony|wife|husband/i.test(hay)) {
    return authorities.length > 0;
  }
  return authorities.some((a) => {
    const text = `${a.title ?? ''} ${a.summary ?? ''} ${a.citation ?? ''}`.toLowerCase();
    return /maintenance|125|144|crpc|bnss|rajneesh|neha|alimony|wife|husband|interim maintenance/i.test(
      text,
    );
  });
}
