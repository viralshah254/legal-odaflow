import { relevantPassages } from '@/ai/legal-research/relevant-passages';
import { Injectable } from '@nestjs/common';
import { CitationVerificationService } from '@/ai/citations/citation-verification.service';
import { SubstanceVerificationService } from '@/ai/citations/substance-verification.service';
import { LegalSanityCheckService } from '@/ai/legal-research/legal-sanity-check.service';
import { SectionAlignmentService, type SectionAlignmentResult } from '@/legal-search/section-alignment.service';
import { SentenceAuditService, type SentenceAuditResult } from '@/legal-search/sentence-audit.service';
import { VerifyClassifierService } from '@/legal-search/verify-classifier.service';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';

export interface UnifiedVerificationInput {
  query: string;
  outputMarkdown: string;
  authorities: RetrievedAuthority[];
  countryCode: string;
  isBareActQuery?: boolean;
  requestedSection?: { actId: string; section: string; statuteShortName?: string };
  exactSectionFound?: boolean;
  /** When true, skip live IK / hybrid citation lookups. */
  fastMode?: boolean;
}

export interface UnifiedVerificationResult {
  citation: Awaited<ReturnType<CitationVerificationService['verifyCitations']>>;
  substancePassed: boolean;
  substanceWarnings: string[];
  classifierPassed: boolean;
  classifierReasons: string[];
  sentenceAudit: SentenceAuditResult;
  sectionAlignment: SectionAlignmentResult;
  indiaNiActBnssPassed: boolean;
  sanityPassed: boolean;
  verifiedCitationTexts: string[];
  verificationUnavailable?: boolean;
}

@Injectable()
export class UnifiedVerificationService {
  constructor(
    private readonly citationVerification: CitationVerificationService,
    private readonly substanceVerification: SubstanceVerificationService,
    private readonly verifyClassifier: VerifyClassifierService,
    private readonly sentenceAudit: SentenceAuditService,
    private readonly sectionAlignment: SectionAlignmentService,
    private readonly legalSanityCheck: LegalSanityCheckService,
  ) {}

  async runChecks(input: UnifiedVerificationInput): Promise<UnifiedVerificationResult> {
    const countryCode = input.countryCode.toUpperCase();
    const citationAuthorities = input.authorities.map((a) => ({
      id: a.id,
      title: a.title ?? a.id,
      citation: a.citation ?? null,
      sourceName: a.sourceName,
      summary: a.summary ?? null,
      fullText: a.fullText ?? null,
      sourceUrl: a.sourceUrl,
      authorityType:
        a.authorityType ??
        (a.sourceTier === 'primary' || a.sourceTier === 'seed' ? 'STATUTE' : 'CASE'),
      neutralCitation: a.neutralCitation,
      court: a.court,
      decisionDate: a.decisionDate,
      jurisdiction: input.countryCode,
      currentLawStatus:
        a.treatmentStatus === 'good_law'
          ? 'GOOD_LAW'
          : a.treatmentStatus?.toUpperCase(),
      treatmentStatus: a.treatmentStatus,
      isRepealed: a.isRepealed,
      bindingStatus:
        typeof a.courtTierRank === 'number'
          ? a.courtTierRank === 0
            ? 'BINDING'
            : 'PERSUASIVE'
          : /supreme court/i.test(a.court ?? a.sourceName)
            ? 'BINDING'
            : undefined,
      official: a.sourceTier === 'primary' || a.sourceTier === 'seed',
      practiceAreas: a.practiceAreas,
      topics: a.topics,
      sourceProvenance: a.sourceProvenance,
      paragraph: a.paragraph ?? relevantPassages(a.sourcePassages ?? [], input.query, 1)[0]?.paragraph,
      page: a.page ?? relevantPassages(a.sourcePassages ?? [], input.query, 1)[0]?.page,
      actName: a.actName,
      actYear: a.actYear,
      section: a.section,
      heading: a.heading,
      regulator: a.regulator,
      instrumentType: a.instrumentType,
      instrumentNumber: a.instrumentNumber,
      instrumentDate: a.instrumentDate,
    }));

    const [citationSettled, substanceSettled, classifierSettled, indiaSettled, sanitySettled, sentenceSettled] =
      await Promise.allSettled([
        this.citationVerification.verifyCitations({
          outputMarkdown: input.outputMarkdown,
          authorities: citationAuthorities,
          countryCode,
          fastMode: input.fastMode,
          query: input.query,
        }),
        (async () => this.substanceVerification.checkBareActSubstance({
          query: input.query,
          outputMarkdown: input.outputMarkdown,
          authorities: input.authorities,
          isBareActQuery: input.isBareActQuery ?? false,
        }))(),
        (async () => this.verifyClassifier.classify({
          query: input.query,
          outputMarkdown: input.outputMarkdown,
          authorities: input.authorities,
          isBareActQuery: input.isBareActQuery ?? false,
        }))(),
        (async () =>
          countryCode === 'IN'
            ? this.substanceVerification.checkIndiaNiActAndBnss(input.outputMarkdown)
            : { passed: true, warnings: [] as string[] })(),
        (async () => this.legalSanityCheck.check({
          outputMarkdown: input.outputMarkdown,
          countryCode,
        }))(),
        (async () => this.sentenceAudit.audit({
          outputMarkdown: input.outputMarkdown,
          authorities: input.authorities.map((a) => ({
            id: a.id,
            title: a.title ?? a.id,
            citation: a.citation ?? null,
            fullText: a.fullText ?? null,
            summary: a.summary ?? null,
          })),
        }))(),
      ]);

    const verificationUnavailable = [
      citationSettled,
      substanceSettled,
      classifierSettled,
      indiaSettled,
      sanitySettled,
      sentenceSettled,
    ].some((result) => result.status === 'rejected');

    const citation =
      citationSettled.status === 'fulfilled'
        ? citationSettled.value
        : { verified: false, citations: [], warnings: ['Citation verification unavailable.'], unverifiableCitations: ['citation-verifier-unavailable'] };

    const substance =
      substanceSettled.status === 'fulfilled'
        ? substanceSettled.value
        : { passed: false, warnings: ['Substance verification unavailable.'], requiresSeedVerification: true };

    const classifier =
      classifierSettled.status === 'fulfilled'
        ? classifierSettled.value
        : { pass: false, reasons: ['Verification classifier unavailable.'] };

    const indiaCheck =
      indiaSettled.status === 'fulfilled'
        ? indiaSettled.value
        : { passed: false, warnings: ['India statutory verification unavailable.'] };

    const sanity =
      sanitySettled.status === 'fulfilled'
        ? sanitySettled.value
        : { passed: false, violations: ['Legal sanity check unavailable.'] };

    const sentenceAudit =
      sentenceSettled.status === 'fulfilled'
        ? sentenceSettled.value
        : { coverageRate: 0, entries: [], ungroundedCount: 1 };

    const sectionAlignment: SectionAlignmentResult = input.requestedSection
      ? this.sectionAlignment.check({
          requestedActId: input.requestedSection.actId,
          requestedSection: input.requestedSection.section,
          statuteShortName:
            input.requestedSection.statuteShortName ?? input.requestedSection.actId.toUpperCase(),
          outputMarkdown: input.outputMarkdown,
          authorities: input.authorities,
          exactSectionInCorpus: input.exactSectionFound === true,
        })
      : { passed: true, warnings: [] };

    const substancePassed =
      substance.passed && classifier.pass && indiaCheck.passed && sanity.passed && sectionAlignment.passed;

    const verifiedCitationTexts = [
      ...citation.citations.filter((c) => c.verified !== false).map((c) => c.citation ?? ''),
    ].filter(Boolean);

    return {
      citation,
      substancePassed,
      substanceWarnings: [
        ...substance.warnings,
        ...classifier.reasons,
        ...indiaCheck.warnings,
        ...sanity.violations,
        ...sectionAlignment.warnings,
      ],
      classifierPassed: classifier.pass,
      classifierReasons: classifier.reasons,
      sentenceAudit,
      sectionAlignment,
      indiaNiActBnssPassed: indiaCheck.passed,
      sanityPassed: sanity.passed,
      verifiedCitationTexts,
      verificationUnavailable,
    };
  }

  buildCorrectionPrompt(
    input: UnifiedVerificationInput,
    result: UnifiedVerificationResult,
  ): string {
    // Prefer authorities with full text for per-claim repair bundles.
    const ranked = [...input.authorities].sort((a, b) => {
      const score = (x: RetrievedAuthority) =>
        (x.fullText ? 3 : 0) +
        (x.summary ? 1 : 0) +
        (x.sourceTier === 'primary' || x.sourceTier === 'seed' ? 2 : 0);
      return score(b) - score(a);
    });
    const authorityBlock = ranked
      .slice(0, 12)
      .map(
        (a) =>
          `${a.title}${a.citation ? ` (${a.citation})` : ''}: ${(a.fullText ?? a.summary ?? '').slice(0, 400)}`,
      )
      .join('\n');

    return [
      'Your prior output failed verification. Regenerate fixing all issues.',
      `Query: ${input.query}`,
      `Substance/classifier warnings: ${result.substanceWarnings.join('; ') || 'none'}`,
      `Unverified citations: ${result.citation.unverifiableCitations.join('; ') || 'none'}`,
      `Ungrounded sentences: ${result.sentenceAudit.ungroundedCount}`,
      '',
      'EVIDENCE BUNDLE (cite ONLY from this list):',
      authorityBlock,
      '',
      'Rules: state only legal rules supported by the listed authorities; if controlling authority is missing, state the limitation and retrieval needed; do not invent AIR/SCC or use unstated sources as legal authority; for India use BNSS not BNS for procedural/maintenance provisions.',
    ].join('\n');
  }

  shouldRegenerate(result: UnifiedVerificationResult, filingGrade: boolean): boolean {
    if (!result.substancePassed) return true;
    if (!result.classifierPassed) return true;
    if (!result.sectionAlignment.passed) return true;
    if (result.citation.unverifiableCitations.length > 0) return true;
    if (filingGrade && result.citation.unverifiableCitations.length > 0) return true;
    if (result.sentenceAudit.ungroundedCount > 3) return true;
    return false;
  }
}
