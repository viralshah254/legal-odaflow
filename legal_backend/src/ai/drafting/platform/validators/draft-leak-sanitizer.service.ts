import { Injectable } from '@nestjs/common';
import type { GateFinding } from '../../contracts/release-gate';
import { flattenDraftText, type StructuredDraft } from '../../contracts/structured-draft';

const VERIFIER = 'draft-leak-sanitizer-v1';

const EXACT_LEAK_TOKENS = [
  'curated__',
  '[SOURCE_',
  'SOURCE_',
  'FACT_REGISTRY',
  'retrieval_id',
  'verified_source_registry',
  'prompt_version',
  '<<<PASS',
  'AUDIT_FOOTER',
];

const LEAK_REGEXES = [
  /curated__[a-z0-9_]+/gi,
  /\[SOURCE_\d+\]/gi,
  /\bSOURCE_\d+\b/g,
  /\[BLANK:\s*curated__/gi,
  /\bfact_id\s*[:=]\s*FACT_[a-f0-9]+/gi,
  /<\/?(?:system|assistant|tool)[^>]*>/gi,
];

export interface LeakSanitizeResult {
  cleanedText: string;
  findings: GateFinding[];
  hadLeaks: boolean;
}

/**
 * Three-layer leak sanitizer: exact tokens + regex + light semantic heuristics.
 * Also scans concatenated "hidden" layers (comments / alt text placeholders).
 */
@Injectable()
export class DraftLeakSanitizer {
  readonly version = VERIFIER;

  sanitize(
    draft: StructuredDraft | string,
    registryTokens: string[] = [],
  ): LeakSanitizeResult {
    let text =
      typeof draft === 'string' ? draft : flattenDraftText(draft);
    const findings: GateFinding[] = [];
    const exact = [...EXACT_LEAK_TOKENS, ...registryTokens];

    for (const token of exact) {
      if (token && text.includes(token)) {
        findings.push({
          id: `leak:exact:${token.slice(0, 24)}`,
          checkId: 'leak_scan',
          severity: 'blocker',
          message: `Internal token leaked into draft: ${token}`,
          repairHint: 'Replace with human-readable citation or remove',
        });
        text = text.split(token).join('');
      }
    }

    for (const re of LEAK_REGEXES) {
      const matches = text.match(re);
      if (matches?.length) {
        for (const m of [...new Set(matches)].slice(0, 10)) {
          findings.push({
            id: `leak:regex:${m.slice(0, 32)}`,
            checkId: 'leak_scan',
            severity: 'blocker',
            message: `Internal pattern leaked: ${m}`,
          });
        }
        text = text.replace(re, '');
      }
    }

    // Semantic: retrieval metadata phrasing
    if (/\b(?:vector\s+score|embedding\s+similarity|chunk\s+id)\b/i.test(text)) {
      findings.push({
        id: 'leak:semantic:retrieval_meta',
        checkId: 'leak_scan',
        severity: 'blocker',
        message: 'Draft contains retrieval-system metadata language',
      });
    }

    // Hidden-layer scan (DOCX comments / footnotes placeholders)
    const hidden = this.extractHiddenLayers(typeof draft === 'string' ? draft : draft.fullMarkdown);
    for (const layer of hidden) {
      const layerResult = this.sanitize(layer, registryTokens);
      findings.push(
        ...layerResult.findings.map((f) => ({
          ...f,
          id: `leak:hidden:${f.id}`,
          message: `Hidden layer: ${f.message}`,
        })),
      );
    }

    return {
      cleanedText: text.replace(/\n{3,}/g, '\n\n').trim(),
      findings,
      hadLeaks: findings.length > 0,
    };
  }

  private extractHiddenLayers(text: string): string[] {
    const layers: string[] = [];
    const commentBlocks = text.match(/<!--[\s\S]*?-->/g) ?? [];
    layers.push(...commentBlocks);
    const footnote = text.match(/\[\^[^\]]+\]:[^\n]+/g) ?? [];
    layers.push(...footnote);
    return layers;
  }
}
