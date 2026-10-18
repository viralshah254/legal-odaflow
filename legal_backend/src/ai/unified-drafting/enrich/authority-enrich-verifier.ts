import { Injectable } from '@nestjs/common';
import { PropositionEntailmentService } from '@/ai/verification/proposition-entailment.service';
import { AuthorityRetrievalPlannerService } from '@/ai/drafting/platform/authority-retrieval-planner.service';
import { isStatuteAuthority } from '@/ai/legal-research/similar-cases.service';
import type {
  AuthorityRetrievalPlan,
  AuthorityType,
  DraftAuthorityProposition,
  VerifiedAuthorityRecord,
  VerificationCheckStatus,
} from '@/ai/drafting/contracts/authority-verification';
import type { CuratedEnrichCase } from './curated-enrich-banks';

const LEGAL_PROP_HINT =
  /\b(specific\s+performance|readiness\s+and\s+willingness|temporary\s+injunction|interim\s+injunction|permanent\s+injunction|limitation|territorial\s+jurisdiction|pecuniary\s+jurisdiction|cause\s+of\s+action|section\s+\d+[a-z]?|§\s*\d+[a-z]?|order\s+[xivlc]+|prima\s+facie|balance\s+of\s+convenience|irreparable\s+(?:injury|harm)|compensation|damages|subsequent\s+transferee|bona\s+fide\s+purchaser|unregistered\s+agreement|registration\s+act|specific\s+relief\s+act|code\s+of\s+civil\s+procedure|bail|personal\s+liberty|flight\s+risk|custodial\s+interrogation)\b/i;

const FACT_ONLY_HINT =
  /\b(on\s+\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|paid|transferred|received|entered\s+into|signed|registered\s+on|residing\s+at|aged\s+\d+|₹|Rs\.?\s*\d|the\s+property\s+is|the\s+agreement\s+is\s+dated)\b/i;

const INTERNAL_AUTHORITY_ID = /^curated__/i;

/** SUPPORTED(+4) alone, or PARTIAL(+1)+area(+2)+issue-in-holding(+1)=4 for curated banks. */
const HIGH_CONFIDENCE_MATCH_SCORE = 4;

/** Trial-court / debt-recovery noise that must never ground civil SP/injunction enrich. */
const BANKING_RECOVERY_NOISE =
  /\b(loan|personal\s+loan|recovery\s+of|sarfaesi|\bdrt\b|guarantor|outstanding\s+principal|suit\s+for\s+recovery|ex[- ]parte\s+judgment\s+in\s+suit\s+for\s+recovery|bank\s+account|contractual\s+interest)\b/i;

const TRIAL_COURT_HINT =
  /\b(district\s+court|district\s+judge|sessions\s+court|civil\s+judge|trial\s+court|metropolitan\s+magistrate|mm\b|jmfc|additional\s+district)\b/i;

const APPELLATE_COURT_HINT =
  /\b(supreme\s+court|high\s+court|sc\b|hc\b)\b/i;

const OFFICIAL_SOURCE_HINT =
  /(?:sci\.gov\.in|api\.sci\.gov\.in|judgments\.ecourts\.gov\.in|ecourts\.gov\.in|indiacode\.nic\.in|[a-z-]+\.dcourts\.gov\.in|[a-z-]+highcourt\.nic\.in)/i;

const DISCOVERY_SOURCE_HINT = /indiankanoon\.org/i;

const GENERIC_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'upon', 'under', 'over',
  'court', 'case', 'law', 'legal', 'shall', 'may', 'must', 'party', 'parties', 'order',
  'section', 'act', 'rule', 'application', 'petition', 'plaintiff', 'defendant', 'accused',
]);

const MIN_AUTHORITY_COMPATIBILITY_SCORE = 58;
const MIN_STRONG_AUTHORITY_COMPATIBILITY_SCORE = 70;

const ISSUE_KEYWORDS: Array<{ issue: string; pattern: RegExp }> = [
  { issue: 'specific_performance', pattern: /specific\s+performance/i },
  { issue: 'readiness_and_willingness', pattern: /readiness\s+and\s+willingness/i },
  { issue: 'temporary_injunction', pattern: /temporary\s+injunction|interim\s+injunction|order\s+xxxix/i },
  { issue: 'permanent_injunction', pattern: /permanent\s+injunction/i },
  { issue: 'limitation', pattern: /limitation|barred\s+by\s+time/i },
  { issue: 'territorial_jurisdiction', pattern: /territorial|jurisdiction|cause\s+of\s+action\s+arose/i },
  { issue: 'unregistered_agreement', pattern: /unregistered|registration|sale\s+deed|gpa/i },
  { issue: 'subsequent_transferee_notice', pattern: /subsequent\s+transferee|notice|bona\s+fide\s+purchaser/i },
  { issue: 'alternative_compensation', pattern: /compensation|damages|earnest|refund/i },
  { issue: 'costs', pattern: /\bcosts\b/i },
  { issue: 'bail', pattern: /\bbail\b|liberty|flight\s+risk/i },
];

@Injectable()
export class AuthorityEnrichVerifier {
  constructor(
    private readonly entailment: PropositionEntailmentService,
    private readonly planner: AuthorityRetrievalPlannerService,
  ) {}

  extractPropositions(
    draftText: string,
    documentKind: string,
    plan: AuthorityRetrievalPlan,
  ): DraftAuthorityProposition[] {
    const paragraphs = draftText
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#>*_`]+/g, ' ')
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const candidates: string[] = [];

    for (const paragraph of paragraphs) {
      const sentences = paragraph
        .split(/(?<=[.!?])\s+(?=(?:[A-Z(\[]|\d+[.)]))/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);

      for (const sentence of sentences) {
        if (sentence.length < 40 || sentence.length > 800) continue;
        if (!LEGAL_PROP_HINT.test(sentence)) continue;
        if (FACT_ONLY_HINT.test(sentence) && !this.containsLegalConclusion(sentence)) continue;
        candidates.push(sentence);
      }
    }

    const seen = new Set<string>();
    const propositions: DraftAuthorityProposition[] = [];

    for (const sentence of candidates) {
      const normalized = sentence.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      const issue = this.detectIssue(sentence, plan);
      if (issue === 'unclassified') continue;

      propositions.push({
        proposition: sentence.slice(0, 500),
        issue,
        documentKind,
        preferredAuthorityType: this.detectPreferredAuthorityType(sentence),
      });

      if (propositions.length >= 12) break;
    }

    return propositions;
  }

  verifyCurated(
    curated: CuratedEnrichCase[],
    propositions: DraftAuthorityProposition[],
    draftText: string,
    plan: AuthorityRetrievalPlan,
  ): VerifiedAuthorityRecord[] {
    return curated.map((candidate) => {
      const bestProp = this.bestMatchingProposition(
        candidate.proposition,
        candidate.areas,
        propositions,
      );

      const internalRecordTrusted = INTERNAL_AUTHORITY_ID.test(candidate.caseId);
      const identityOk =
        internalRecordTrusted &&
        Boolean(candidate.title?.trim()) &&
        Boolean(candidate.citation?.trim()) &&
        Boolean(candidate.court?.trim());

      let excluded = false;
      let exclusionReason: string | undefined;
      let relevanceStatus: VerificationCheckStatus = 'fail';

      if (!bestProp) {
        excluded = true;
        exclusionReason = 'No sufficiently matching draft proposition';
      } else {
        const support = this.entailment.assess(bestProp.proposition, [candidate.proposition]);
        const areaHit =
          candidate.areas.includes(bestProp.issue) ||
          plan.legalIssues.some((issue) => candidate.areas.includes(issue));
        const topicHit =
          areaHit ||
          plan.requiredTopics.length === 0 ||
          plan.requiredTopics.some(
            (topic) =>
              candidate.proposition.toLowerCase().includes(topic.toLowerCase()) ||
              candidate.areas.some((area) =>
                area.replace(/_/g, ' ').toLowerCase().includes(topic.toLowerCase()),
              ) ||
              bestProp.issue.replace(/_/g, ' ').toLowerCase().includes(topic.toLowerCase()),
          ) ||
          plan.legalIssues.some((issue) =>
            candidate.proposition.toLowerCase().includes(issue.replace(/_/g, ' ')),
          );

        // Curated banks are human-reviewed: SUPPORTED, or PARTIAL with area/issue hit.
        if (topicHit && (support === 'SUPPORTED' || (support === 'PARTIAL' && areaHit))) {
          relevanceStatus = 'pass';
        } else {
          excluded = true;
          relevanceStatus = support === 'PARTIAL' ? 'indeterminate' : 'fail';
          exclusionReason =
            support === 'PARTIAL'
              ? 'Curated authority only partially supports the extracted proposition'
              : 'Curated authority does not support an extracted draft proposition';
        }
      }

      // citedInDraft is recorded honestly but does NOT exclude pre-LLM —
      // enrich inserts citations after the ALLOWED CASES bank is built.
      const citedInDraft = this.isCitedInDraft(draftText, {
        title: candidate.title,
        citation: candidate.citation,
      });

      return {
        id: candidate.caseId,
        authorityType: 'case',
        citation: candidate.citation,
        title: candidate.title,
        proposition: bestProp?.proposition ?? candidate.proposition,
        issue: bestProp?.issue ?? candidate.areas[0] ?? 'general',
        identityStatus: identityOk ? 'pass' : 'indeterminate',
        relevanceStatus,
        currentLawStatus:
          candidate.treatmentStatus === 'good_law' && identityOk && !excluded
            ? 'good_law'
            : 'unknown',
        citedInDraft,
        authorityTypeMisclassified: false,
        excluded,
        exclusionReason,
        court: candidate.court,
        decisionYear: candidate.decisionYear,
        sourceUrl: candidate.sourceUrl,
        holding: candidate.proposition,
        areas: candidate.areas,
      };
    });
  }

  verifyRetrievedCandidate(
    candidate: {
      id: string;
      title: string;
      citation: string;
      summary: string;
      court: string;
      year?: string | number | null;
      sourceUrl?: string | null;
      areas: string[];
    },
    proposition: DraftAuthorityProposition | undefined,
    draftText: string,
    plan: AuthorityRetrievalPlan,
    asStatute: boolean,
  ): VerifiedAuthorityRecord {
    const blob = `${candidate.title} ${candidate.citation} ${candidate.summary}`.trim();
    const yearNum =
      typeof candidate.year === 'number'
        ? candidate.year
        : typeof candidate.year === 'string' && /^\d{4}$/.test(candidate.year)
          ? Number(candidate.year)
          : undefined;

    let authorityType: AuthorityType = asStatute ? 'statute' : 'case';
    if (/constitution|appendix\s*iii|article\s*370/i.test(blob)) {
      authorityType = 'constitution';
    }

    const authorityTypeMisclassified =
      !asStatute &&
      isStatuteAuthority({
        id: candidate.id,
        title: candidate.title,
        citation: candidate.citation,
        sourceName: '',
        sourceTier: 'case_law',
        authorityType: 'CASE_LAW',
        summary: candidate.summary,
      });

    const identityStatus = this.assessIdentity(candidate, authorityType);
    const citedInDraft = this.isCitedInDraft(draftText, {
      title: candidate.title,
      citation: candidate.citation,
    });

    let excluded = false;
    let exclusionReason: string | undefined;
    let relevanceStatus: VerificationCheckStatus = 'indeterminate';

    const excludedDomain = this.planner.detectExcludedDomain(blob, plan);
    if (excludedDomain && this.isPrimaryDomainConflict(blob, excludedDomain, plan)) {
      excluded = true;
      exclusionReason = `Excluded primary legal domain: ${excludedDomain}`;
      relevanceStatus = 'fail';
    }

    if (
      !excluded &&
      (authorityType === 'statute' || authorityType === 'constitution') &&
      !this.planner.isPermittedStatute(blob, plan)
    ) {
      excluded = true;
      exclusionReason = 'Statute is not in the permitted set for this document kind';
      relevanceStatus = 'fail';
    }

    if (
      !excluded &&
      /civil_plaint|specific_performance|civil_suit|injunction|property/i.test(plan.documentKind) &&
      /\bCrPC\b|\bBNSS\b|anticipatory\s+bail|s\.?\s*438\b/i.test(blob) &&
      !plan.legalIssues.includes('bail')
    ) {
      excluded = true;
      exclusionReason = 'Criminal authority in civil draft without a justified legal issue';
      relevanceStatus = 'fail';
    }

    // Compatibility scoring and additional filtering
    const compatibility = this.scoreAuthorityCompatibility({
      candidateText: blob,
      candidateCourt: candidate.court,
      sourceUrl: candidate.sourceUrl ?? undefined,
      proposition,
      plan,
      authorityType,
    });

    if (!excluded && compatibility.total < MIN_AUTHORITY_COMPATIBILITY_SCORE) {
      excluded = true;
      exclusionReason = `Authority-matter mismatch: compatibility score ${compatibility.total}/100`;
      relevanceStatus = 'fail';
    }

    if (
      !excluded &&
      BANKING_RECOVERY_NOISE.test(blob) &&
      !this.planSupportsBankingRecovery(plan) &&
      compatibility.issueMatch < 18
    ) {
      excluded = true;
      exclusionReason =
        'Loan or debt-recovery authority does not support a material issue in this matter';
      relevanceStatus = 'fail';
    }

    if (
      !excluded &&
      authorityType === 'case' &&
      this.isLowValueTrialCourt(candidate.court, blob) &&
      compatibility.total < MIN_STRONG_AUTHORITY_COMPATIBILITY_SCORE
    ) {
      excluded = true;
      exclusionReason =
        'Low-hierarchy trial-court decision lacks a sufficiently strong issue and proposition match';
      relevanceStatus = 'fail';
    }

    if (!excluded && !proposition) {
      excluded = true;
      exclusionReason = 'No sufficiently matching draft proposition';
      relevanceStatus = 'fail';
    }

    if (!excluded && proposition) {
      const support = this.entailment.assess(proposition.proposition, [candidate.summary]);
      const issueHit = this.hasIssueKeywordHit(blob, proposition.issue, plan);
      if (support === 'SUPPORTED' && issueHit) {
        relevanceStatus = 'pass';
      } else {
        excluded = true;
        relevanceStatus =
          support === 'PARTIAL' || (support === 'SUPPORTED' && !issueHit)
            ? 'indeterminate'
            : 'fail';
        exclusionReason = !issueHit
          ? `Authority summary does not address the legal issue "${proposition.issue.replace(/_/g, ' ')}"`
          : support === 'PARTIAL'
            ? `Authority only partially supports the draft proposition that ${proposition.proposition.slice(0, 140)}`
            : `Authority does not support the draft proposition that ${proposition.proposition.slice(0, 140)}`;
      }
    }

    if (authorityTypeMisclassified) {
      excluded = true;
      exclusionReason =
        exclusionReason ?? 'Authority type misclassified: statute was labelled as case law';
    }

    if (identityStatus !== 'pass') {
      excluded = true;
      exclusionReason = exclusionReason ?? 'Authority identity is not fully verified';
    }

    // Do not exclude for !citedInDraft pre-LLM — enrich will insert citations.

    return {
      id: candidate.id,
      authorityType,
      citation: candidate.citation,
      title: candidate.title,
      proposition: proposition?.proposition ?? candidate.summary.slice(0, 400),
      issue: proposition?.issue ?? 'general',
      identityStatus,
      relevanceStatus,
      currentLawStatus: 'unknown',
      citedInDraft,
      authorityTypeMisclassified,
      excluded,
      exclusionReason,
      court: candidate.court,
      decisionYear: yearNum,
      sourceUrl: candidate.sourceUrl ?? undefined,
      holding: candidate.summary.slice(0, 500) || undefined,
      areas: candidate.areas.length ? candidate.areas : proposition ? [proposition.issue] : [],
    };
  }

  isCitedInDraft(
    draftText: string,
    auth: { title?: string; citation?: string },
  ): boolean {
    const normalizedDraft = draftText.toLowerCase().replace(/\s+/g, ' ');

    if (auth.citation) {
      const normalizedCitation = auth.citation.toLowerCase().replace(/\s+/g, ' ').trim();
      if (normalizedCitation.length > 5 && normalizedDraft.includes(normalizedCitation)) {
        return true;
      }
    }

    if (auth.title) {
      const normalizedTitle = auth.title.toLowerCase().replace(/\s+/g, ' ').trim();
      if (normalizedTitle.length > 8 && normalizedDraft.includes(normalizedTitle)) {
        return true;
      }

      const partyNames = auth.title
        .split(/\bv\.?\s|\bvs\.?\s/i)
        .map((part) => part.replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim())
        .filter((part) => part.length > 4);

      if (partyNames.length >= 2 && partyNames.every((party) => normalizedDraft.includes(party))) {
        return true;
      }
    }

    return false;
  }

  private detectIssue(sentence: string, plan: AuthorityRetrievalPlan): string {
    for (const { issue, pattern } of ISSUE_KEYWORDS) {
      if (pattern.test(sentence) && plan.legalIssues.includes(issue)) return issue;
    }

    for (const { issue, pattern } of ISSUE_KEYWORDS) {
      if (pattern.test(sentence)) return issue;
    }

    return 'unclassified';
  }

  private bestMatchingProposition(
    holding: string,
    areas: string[],
    propositions: DraftAuthorityProposition[],
  ): DraftAuthorityProposition | undefined {
    if (propositions.length === 0) return undefined;

    let best: DraftAuthorityProposition | undefined;
    let bestScore = -1;

    for (const proposition of propositions) {
      const support = this.entailment.assess(proposition.proposition, [holding]);
      let score =
        support === 'SUPPORTED'
          ? 4
          : support === 'PARTIAL'
            ? 1
            : support === 'UNSUPPORTED'
              ? 0
              : 0;

      if (areas.includes(proposition.issue)) score += 2;
      if (holding.toLowerCase().includes(proposition.issue.replace(/_/g, ' '))) score += 1;

      if (score > bestScore) {
        bestScore = score;
        best = proposition;
      }
    }

    return bestScore >= HIGH_CONFIDENCE_MATCH_SCORE ? best : undefined;
  }

  private containsLegalConclusion(sentence: string): boolean {
    return /\b(entitled\s+to|court\s+may|court\s+must|is\s+maintainable|is\s+barred|is\s+required|shall\s+prevail|may\s+be\s+enforced|cannot\s+be\s+granted|is\s+inadmissible|is\s+admissible|constitutes\s+a\s+breach|supports\s+the\s+grant|warrants\s+relief)\b/i.test(
      sentence,
    );
  }

  private hasIssueKeywordHit(
    blob: string,
    issue: string,
    plan: AuthorityRetrievalPlan,
  ): boolean {
    const hay = this.normalizeLegalText(blob);
    if (this.expandIssueTerms(issue).some((term) => hay.includes(term))) return true;
    for (const topic of plan.requiredTopics) {
      if (topic.length > 3 && hay.includes(topic.toLowerCase())) return true;
    }
    for (const planIssue of plan.legalIssues) {
      const phrase = planIssue.replace(/_/g, ' ').toLowerCase();
      if (phrase.length > 3 && hay.includes(phrase)) return true;
    }
    // Issue-specific synonym hits
    const synonyms: Record<string, RegExp> = {
      specific_performance: /specific\s+performance|agreement\s+to\s+sell|immovable\s+property/i,
      readiness_and_willingness: /readiness\s+and\s+willingness/i,
      temporary_injunction: /temporary\s+injunction|interim\s+injunction|order\s+xxxix|status\s+quo/i,
      permanent_injunction: /permanent\s+injunction/i,
      limitation: /limitation|barred\s+by\s+time/i,
      unregistered_agreement: /unregistered|registration\s+act|sale\s+deed|gpa/i,
      subsequent_transferee_notice: /subsequent\s+transferee|bona\s+fide\s+purchaser/i,
      alternative_compensation: /compensation|damages|earnest|refund/i,
      bail: /\bbail\b|personal\s+liberty|flight\s+risk/i,
    };
    const re = synonyms[issue];
    return re ? re.test(blob) : false;
  }

  private detectPreferredAuthorityType(
    sentence: string,
  ): DraftAuthorityProposition['preferredAuthorityType'] {
    if (/\bconstitution\b|\barticle\s+\d+/i.test(sentence)) return 'constitution';
    if (/\bsection\s+\d+[a-z]?\b|§\s*\d+[a-z]?|\border\s+[xivlc]+\b|\bact\b|\bcpc\b|\bsra\b|\btpa\b/i.test(sentence)) {
      return 'statute';
    }
    return 'case';
  }

  private assessIdentity(
    candidate: {
      id: string;
      title: string;
      citation: string;
      court: string;
      sourceUrl?: string | null;
    },
    authorityType: AuthorityType,
  ): VerificationCheckStatus {
    if (!candidate.id?.trim() || !candidate.title?.trim()) return 'fail';

    if (authorityType === 'case') {
      const hasCaseStyleTitle = /\bv\.?\s|\bvs\.?\s/i.test(candidate.title);
      const hasCourt = Boolean(candidate.court?.trim());
      const hasSource = Boolean(candidate.sourceUrl?.trim());
      const hasCitationOrReliableIdentity = Boolean(candidate.citation?.trim()) || hasSource;

      return hasCaseStyleTitle && hasCourt && hasCitationOrReliableIdentity ? 'pass' : 'indeterminate';
    }

    if (authorityType === 'statute' || authorityType === 'constitution') {
      const hasSectionOrArticle = /\b(section|s\.?|article|order|appendix)\b/i.test(
        `${candidate.title} ${candidate.citation}`,
      );
      return hasSectionOrArticle ? 'pass' : 'indeterminate';
    }

    return 'indeterminate';
  }

  private isPrimaryDomainConflict(
    blob: string,
    excludedDomain: string,
    plan: AuthorityRetrievalPlan,
  ): boolean {
    const normalized = blob.toLowerCase();
    const domain = excludedDomain.toLowerCase();

    if (
      plan.legalIssues.some((issue) =>
        this.expandIssueTerms(issue).some((term) => normalized.includes(term)),
      )
    ) {
      return false;
    }

    const domainSignals: Record<string, RegExp> = {
      criminal_procedure: /\b(crpc|bnss|bail|arrest|custody|criminal\s+procedure)\b/i,
      data_protection: /\b(dpdp|data\s+protection|personal\s+data|data\s+fiduciary)\b/i,
      copyright: /\b(copyright|appellate\s+board|author|literary\s+work)\b/i,
      corruption: /\b(prevention\s+of\s+corruption|pc\s+act|public\s+servant|bribe)\b/i,
      biodiversity: /\b(biological\s+diversity|biodiversity|national\s+biodiversity\s+authority)\b/i,
      banking_recovery:
        /\b(loan|personal\s+loan|recovery\s+of|bank|sarfaesi|drt|guarantor|outstanding\s+principal|suit\s+for\s+recovery)\b/i,
      constitutional_amendment: /\b(article\s*370|appendix\s*iii)\b/i,
      tax_indirect: /\b(gst|cgst|customs\s+act)\b/i,
      company_insolvency: /\b(ibc|insolvency\s+and\s+bankruptcy)\b/i,
    };

    return domainSignals[domain]?.test(normalized) ?? true;
  }

  private scoreAuthorityCompatibility(input: {
    candidateText: string;
    candidateCourt: string;
    sourceUrl?: string;
    proposition: DraftAuthorityProposition | undefined;
    plan: AuthorityRetrievalPlan;
    authorityType: AuthorityType;
  }): {
    total: number;
    propositionSupport: number;
    issueMatch: number;
    documentKindMatch: number;
    hierarchy: number;
    sourceTrust: number;
  } {
    const { candidateText, candidateCourt, sourceUrl, proposition, plan, authorityType } = input;
    const normalizedCandidate = this.normalizeLegalText(candidateText);

    let propositionSupport = 0;
    if (proposition) {
      const support = this.entailment.assess(proposition.proposition, [candidateText]);
      propositionSupport = support === 'SUPPORTED' ? 38 : support === 'PARTIAL' ? 16 : 0;
    }

    const targetIssues = new Set([
      ...plan.legalIssues,
      ...(proposition ? [proposition.issue] : []),
    ]);
    const issueHits = [...targetIssues].filter((issue) =>
      this.expandIssueTerms(issue).some((term) => normalizedCandidate.includes(term)),
    ).length;
    const issueMatch = Math.min(
      25,
      issueHits * 8 +
        (proposition && this.hasIssueKeywordHit(candidateText, proposition.issue, plan) ? 9 : 0),
    );

    const documentKindTerms = this.tokenizeLegalConcepts(plan.documentKind.replace(/_/g, ' '));
    const candidateTerms = new Set(this.tokenizeLegalConcepts(candidateText));
    const documentOverlap = documentKindTerms.filter((term) => candidateTerms.has(term)).length;
    const documentKindMatch = Math.min(12, documentOverlap * 3);

    const hierarchy = this.authorityHierarchyScore(candidateCourt, authorityType);
    const sourceTrust = this.sourceTrustScore(sourceUrl);

    return {
      total: Math.min(
        100,
        propositionSupport + issueMatch + documentKindMatch + hierarchy + sourceTrust,
      ),
      propositionSupport,
      issueMatch,
      documentKindMatch,
      hierarchy,
      sourceTrust,
    };
  }

  private authorityHierarchyScore(court: string, authorityType: AuthorityType): number {
    if (authorityType === 'statute' || authorityType === 'constitution') return 15;

    const normalized = court.toLowerCase();
    if (/supreme\s+court/.test(normalized)) return 15;
    if (/high\s+court/.test(normalized)) return 11;
    if (/national\s+company\s+law\s+appellate\s+tribunal|nclat/.test(normalized)) return 9;
    if (/tribunal|commission/.test(normalized)) return 6;
    if (TRIAL_COURT_HINT.test(normalized)) return 3;
    return 4;
  }

  private sourceTrustScore(sourceUrl?: string): number {
    if (!sourceUrl) return 0;
    if (OFFICIAL_SOURCE_HINT.test(sourceUrl)) return 10;
    if (DISCOVERY_SOURCE_HINT.test(sourceUrl)) return 4;
    return 1;
  }

  private isLowValueTrialCourt(court: string, blob: string): boolean {
    const combined = `${court} ${blob}`;
    return TRIAL_COURT_HINT.test(combined) && !APPELLATE_COURT_HINT.test(combined);
  }

  private planSupportsBankingRecovery(plan: AuthorityRetrievalPlan): boolean {
    const text = `${plan.documentKind} ${plan.legalIssues.join(' ')} ${plan.requiredTopics.join(' ')}`;
    return /bank|loan|debt|recovery|sarfaesi|guarantor|mortgage|outstanding|interest/i.test(text);
  }

  private normalizeLegalText(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9§]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenizeLegalConcepts(value: string): string[] {
    return this.normalizeLegalText(value)
      .split(' ')
      .filter((token) => token.length >= 4 && !GENERIC_STOP_WORDS.has(token));
  }

  private expandIssueTerms(issue: string): string[] {
    const normalizedIssue = this.normalizeLegalText(issue.replace(/_/g, ' '));
    const expansions: Record<string, string[]> = {
      specific_performance: ['specific performance', 'agreement to sell', 'enforcement of contract'],
      readiness_and_willingness: ['readiness and willingness', 'ready and willing'],
      temporary_injunction: ['temporary injunction', 'interim injunction', 'order xxxix', 'status quo'],
      permanent_injunction: ['permanent injunction', 'perpetual injunction'],
      territorial_jurisdiction: ['territorial jurisdiction', 'cause of action arose'],
      unregistered_agreement: ['unregistered agreement', 'registration act', 'section 49'],
      subsequent_transferee_notice: ['subsequent transferee', 'bona fide purchaser', 'without notice'],
      alternative_compensation: ['compensation', 'damages', 'refund', 'earnest money'],
      bail: ['bail', 'personal liberty', 'flight risk', 'custodial interrogation'],
      limitation: ['limitation', 'barred by time', 'delay and laches'],
      arbitration: ['arbitration', 'arbitral award', 'section 34', 'section 11'],
      insolvency: ['insolvency', 'ibc', 'moratorium', 'corporate debtor'],
      consumer_deficiency: ['consumer', 'deficiency in service', 'unfair trade practice'],
      electronic_evidence: ['electronic evidence', 'digital evidence', 'section 65b', 'metadata'],
      maintenance: ['maintenance', 'interim maintenance', 'financial support'],
      divorce: ['divorce', 'cruelty', 'desertion'],
      tenancy_eviction: ['tenancy', 'landlord', 'tenant', 'eviction'],
      partition: ['partition', 'coparcenary', 'undivided share'],
      judicial_review: ['judicial review', 'natural justice', 'arbitrariness', 'writ petition'],
      constitutional_rights: ['fundamental right', 'constitutional validity', 'article 14', 'article 19', 'article 21'],
      tax: ['income tax', 'gst', 'cgst', 'customs', 'assessment'],
    };

    return [normalizedIssue, ...(expansions[issue] ?? [])]
      .map((term) => this.normalizeLegalText(term))
      .filter(Boolean);
  }
}