import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import type { VerifiedSource, VerifiedSourceRegistry, SourcePromptEntry } from '../contracts/verified-source';
import {
  enforceVerifiedSourceAdmission,
  toSourcePromptEntry,
  toBackgroundPromptEntry,
} from '../contracts/verified-source';

/**
 * Verified Source Registry — closed set of sources the model may cite.
 * Status is never promoted by field presence; only server verifiers set `verified`.
 */
@Injectable()
export class VerifiedSourceRegistryService {
  async build(jobId: string, sources: VerifiedSource[]): Promise<VerifiedSourceRegistry> {
    const deduplicated = this.deduplicate(sources.map(enforceVerifiedSourceAdmission));
    return {
      jobId,
      sources: deduplicated,
      builtAt: new Date().toISOString(),
    };
  }

  /** Citable verified sources for a section. */
  getPromptSources(registry: VerifiedSourceRegistry, sectionId: string): SourcePromptEntry[] {
    return registry.sources
      .filter((s) => s.verificationStatus === 'verified')
      .filter((s) => !s.allowedSectionIds?.length || s.allowedSectionIds.includes(sectionId))
      .map(toSourcePromptEntry);
  }

  /** Non-citable discovery / partial material for model context only. */
  getBackgroundSources(registry: VerifiedSourceRegistry, sectionId: string): SourcePromptEntry[] {
    return registry.sources
      .filter((s) => s.verificationStatus === 'partially_verified')
      .filter((s) => !s.allowedSectionIds?.length || s.allowedSectionIds.includes(sectionId))
      .map(toBackgroundPromptEntry);
  }

  getVerifiedSources(registry: VerifiedSourceRegistry): VerifiedSource[] {
    return registry.sources.filter((s) => s.verificationStatus === 'verified');
  }

  private deduplicate(sources: VerifiedSource[]): VerifiedSource[] {
    const seen = new Map<string, VerifiedSource>();
    for (const source of sources) {
      const key = source.id || source.contentHash;
      if (!seen.has(key)) {
        seen.set(key, source);
      }
    }
    return [...seen.values()];
  }

  static fromAuthority(authority: Record<string, unknown>): VerifiedSource {
    const passage = String(authority['text'] ?? authority['verbatimPassage'] ?? '');
    const proposition = authority['proposition'] ? String(authority['proposition']) : undefined;
    const jurisdictionRaw = authority['jurisdiction'];
    const jurisdiction =
      jurisdictionRaw !== undefined && String(jurisdictionRaw).trim()
        ? String(jurisdictionRaw)
        : 'unknown';
    const artifactText = passage || proposition || String(authority['id'] ?? '');
    return {
      id: String(authority['id'] ?? randomUUID()),
      type: 'case',
      jurisdiction,
      title: String(authority['title'] ?? authority['citation'] ?? ''),
      citation: authority['citation'] ? String(authority['citation']) : undefined,
      court: authority['court'] ? String(authority['court']) : undefined,
      date: authority['date'] ? String(authority['date']) : undefined,
      section: authority['section'] ? String(authority['section']) : undefined,
      verbatimPassage: passage || undefined,
      text: passage || undefined,
      proposition,
      bindingLevel: 'persuasive',
      verificationStatus: 'partially_verified',
      contentHash: createHash('sha256').update(artifactText).digest('hex'),
    };
  }
}
