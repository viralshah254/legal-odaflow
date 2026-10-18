import { Injectable } from '@nestjs/common';
import { SectionFinderService } from '@/legal-search/india-section-finder/section-finder.service';
import type { SectionFinderEntry } from '@/legal-search/india-section-finder/section-finder.types';
import { truncateAtSentence } from '@/legal-search/text-truncate';

export interface DraftSectionFinderContext {
  queries: string[];
  matches: SectionFinderEntry[];
  promptBlock: string;
  verifiedSectionLabels: string[];
}

const LEGACY_SECTION_PATTERNS = [
  /\b(?:crpc|cr\.?\s*p\.?\s*c\.?)\s*§?\s*(\d+[a-z]?)/gi,
  /\b(?:ipc)\s*§?\s*(\d+[a-z]?)/gi,
  /\b(?:bnss|bns|bsa)\s*§?\s*(\d+[a-z]?)/gi,
  /\bsection\s+(\d+[a-z]?)\s+(?:of\s+)?(?:the\s+)?(?:crpc|ipc|bnss|bns|code of criminal procedure)/gi,
  /\b125\s+crpc\b/gi,
  /\b144\s+bnss\b/gi,
];

@Injectable()
export class DraftSectionFinderGroundingService {
  constructor(private readonly sectionFinder: SectionFinderService) {}

  extractQueries(kind: string, caseDetails: string): string[] {
    const queries = new Set<string>();
    const haystack = `${kind} ${caseDetails}`;

    if (/maintenance|125|144|wife|husband|alimony/i.test(haystack)) {
      queries.add('144 BNSS');
      queries.add('125 CrPC');
    }
    if (/maintenance_order_revision|438/i.test(kind)) {
      queries.add('438 BNSS');
    }
    if (/criminal_appeal|427/i.test(kind)) {
      queries.add('427 BNSS');
    }
    if (/cheque|ni.?138|138/i.test(haystack)) {
      queries.add('138 NI Act');
    }
    if (/bail|480|482/i.test(haystack)) {
      queries.add('480 BNSS');
    }

    for (const pattern of LEGACY_SECTION_PATTERNS) {
      pattern.lastIndex = 0;
      for (const m of haystack.matchAll(pattern)) {
        const token = m[0].trim();
        if (token.length >= 4) queries.add(token);
      }
    }

    const kindHint = kind.match(/bnss[_-]?(\d+[a-z]?)/i);
    if (kindHint) queries.add(`BNSS ${kindHint[1]}`);

    return [...queries].slice(0, 6);
  }

  async buildContext(kind: string, caseDetails: string): Promise<DraftSectionFinderContext> {
    const queries = this.extractQueries(kind, caseDetails);
    const matchMap = new Map<string, SectionFinderEntry>();

    for (const q of queries) {
      try {
        const result = await this.sectionFinder.find({ q, countryCode: 'IN' });
        for (const match of result.matches.slice(0, 2)) {
          if (this.isVerifiedCorpusMatch(match)) matchMap.set(match.id, match);
        }
      } catch {
        /* non-fatal */
      }
    }

    const matches = [...matchMap.values()];
    const verifiedSectionLabels: string[] = [];
    const lines: string[] = [
      'SECTION FINDER VERIFIED (use these crosswalks and section text — same source as Section Finder UI):',
    ];

    for (const match of matches.slice(0, 5)) {
      verifiedSectionLabels.push(
        `${match.legacyActShort} §${match.legacySection} → ${match.newActShort} §${match.newSection}`,
      );
      lines.push(
        `- ${match.legacyActShort} §${match.legacySection} → ${match.newActShort} §${match.newSection}: ${match.newTitle}`,
      );
      if (match.sectionText) {
        lines.push(
          `  Section text: ${truncateAtSentence(match.sectionText, 400)}`,
        );
      } else if (match.changeSummary) {
        lines.push(`  What changed: ${truncateAtSentence(match.changeSummary, 200)}`);
      }
      if (match.practiceNote) {
        lines.push(`  Practice note: ${truncateAtSentence(match.practiceNote, 180)}`);
      }
      if (match.bailPosture) {
        lines.push(`  Bail/forum: ${match.trialCourtLabel} · ${match.bailPosture.slice(0, 120)}`);
      }
      if (match.transitionWarning) {
        lines.push(`  Note: ${match.transitionWarning}`);
      }
    }

    if (matches.length === 0) {
      lines.push('(No Section Finder match — rely on AUTHORITATIVE SECTIONS block above.)');
    }

    lines.push(
      'When user cites CrPC §125 for maintenance, always use BNSS §144 in current law. Never map maintenance to BNS §125.',
    );

    return {
      queries,
      matches,
      promptBlock: lines.join('\n'),
      verifiedSectionLabels,
    };
  }

  /** AI-only / unverified rows must never enter draft prompt grounding. */
  private isVerifiedCorpusMatch(match: SectionFinderEntry): boolean {
    if (match.matchSource === 'ai') return false;
    if (match.verificationState === 'ai_suggested') return false;
    return true;
  }

  /** Returns corrections when draft cites wrong successor for a known crosswalk. */
  suggestCrosswalkFixes(
    draft: string,
    matches: SectionFinderEntry[],
  ): Array<{ from: string; to: string; reason: string }> {
    const fixes: Array<{ from: string; to: string; reason: string }> = [];

    for (const match of matches) {
      const wrongBnsMaintenance =
        new RegExp(
          `BNS\\s*§?\\s*${match.legacySection}[^.\\n]{0,40}(maintenance|wife|husband)`,
          'i',
        );
      if (
        match.legacySection === '125' &&
        match.newActShort === 'BNSS' &&
        wrongBnsMaintenance.test(draft)
      ) {
        fixes.push({
          from: `BNS §${match.legacySection} (maintenance)`,
          to: `${match.newActShort} §${match.newSection}`,
          reason: `Section Finder crosswalk: ${match.legacyActShort} §${match.legacySection} → ${match.newActShort} §${match.newSection}`,
        });
      }

      const wrongLegacyAsCurrent = new RegExp(
        `(?:under|pursuant to)\\s+${match.legacyActShort}\\s*§?\\s*${match.legacySection}(?!\\s*\\(now)`,
        'i',
      );
      if (match.newActShort !== 'unchanged' && wrongLegacyAsCurrent.test(draft)) {
        fixes.push({
          from: `${match.legacyActShort} §${match.legacySection} (cited as current)`,
          to: `${match.newActShort} §${match.newSection}`,
          reason: match.changeSummary?.slice(0, 120) ?? 'Schedule I successor applies',
        });
      }
    }

    return fixes;
  }
}
