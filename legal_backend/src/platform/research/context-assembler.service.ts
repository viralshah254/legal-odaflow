import { Injectable } from '@nestjs/common';
import { AuthorityReference } from './research.types';

const CHARS_PER_TOKEN = 4;

@Injectable()
export class ContextAssemblerService {
  assemble(
    authorities: AuthorityReference[],
    maxTokens: number,
    reserveForOutput: number,
  ): { context: string; selectedAuthorities: AuthorityReference[]; truncated: boolean } {
    const budget = maxTokens - reserveForOutput;
    const selected: AuthorityReference[] = [];
    const parts: string[] = [];
    let usedTokens = 0;
    let truncated = false;

    for (const auth of authorities) {
      const snippet = auth.snippet ?? auth.title;
      const label = this.buildLabel(auth);
      const block = `[${label}]\n${snippet}`;
      const tokenEstimate = Math.ceil(block.length / CHARS_PER_TOKEN);

      if (usedTokens + tokenEstimate > budget) {
        truncated = true;
        break;
      }

      parts.push(block);
      selected.push(auth);
      usedTokens += tokenEstimate;
    }

    return {
      context: parts.join('\n\n---\n\n'),
      selectedAuthorities: selected,
      truncated,
    };
  }

  private buildLabel(auth: AuthorityReference): string {
    const parts: string[] = [auth.title];
    if (auth.citation) parts.push(auth.citation);
    if (auth.court) parts.push(auth.court);
    if (auth.publicationDate) parts.push(auth.publicationDate.slice(0, 4));
    if (auth.treatmentStatus !== 'good_law') {
      parts.push(`STATUS: ${auth.treatmentStatus.toUpperCase()}`);
    }
    return parts.join(' | ');
  }
}
