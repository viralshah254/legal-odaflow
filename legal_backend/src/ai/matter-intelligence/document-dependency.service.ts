import { Injectable } from '@nestjs/common';
import {
  DOCUMENT_DEPENDENCIES,
  getDependencyForDocument,
} from './document-dependency.registry';
import type { MatterProfile } from './matter-intelligence.types';

export interface PreDraftCheckResult {
  canProceed: boolean;
  missingInputs: string[];
  message?: string;
}

@Injectable()
export class DocumentDependencyService {
  getRequiredDocuments(documentKind?: string, profile?: MatterProfile): string[] {
    const kinds = [
      documentKind,
      profile?.documentKind,
      ...(profile?.documentTypes ?? []),
      ...(profile?.curatedKinds ?? []),
    ].filter(Boolean) as string[];

    const required = new Set<string>();
    for (const kind of kinds) {
      const dep = getDependencyForDocument(kind);
      if (dep) {
        for (const input of dep.requiredInputs) {
          required.add(this.humanizeInput(input));
        }
      }
    }
    return [...required];
  }

  checkPreDraft(
    documentKind: string,
    providedInputs: string[] = [],
  ): PreDraftCheckResult {
    const dep = getDependencyForDocument(documentKind);
    if (!dep) {
      return { canProceed: true, missingInputs: [] };
    }

    const normalizedProvided = new Set(providedInputs.map((p) => p.toLowerCase()));
    const missing = dep.requiredInputs.filter(
      (input) => !normalizedProvided.has(input.toLowerCase()) && !this.isProvidedInText(input, providedInputs),
    );

    if (missing.length === 0) {
      return { canProceed: true, missingInputs: [] };
    }

    return {
      canProceed: false,
      missingInputs: missing.map((m) => this.humanizeInput(m)),
      message: dep.blockMessage ?? `Missing required inputs: ${missing.join(', ')}`,
    };
  }

  private isProvidedInText(input: string, provided: string[]): boolean {
    const haystack = provided.join(' ').toLowerCase();
    const normalized = input.replace(/_/g, ' ');
    if (haystack.includes(normalized)) return true;

    if (input === 'impugned_order') {
      return /impugned order|interim order|maintenance order|order was issued|order dated|challeng(e|ing|es).*order|set aside.*order/i.test(
        haystack,
      );
    }
    if (input === 'income_affidavit') {
      return /income affidavit|earning capacity|salary slip|form 16|itr|income details|financial affidavit/i.test(
        haystack,
      );
    }
    if (input === 'fir_copy') {
      return /\bfir\b|first information report|chargesheet|charge sheet|police complaint/i.test(haystack);
    }
    if (input === 'termination_letter') {
      return /termination letter|termination notice|letter of termination|employment terminated/i.test(haystack);
    }

    return false;
  }

  private humanizeInput(input: string): string {
    return input
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  listAllDependencies() {
    return DOCUMENT_DEPENDENCIES;
  }
}
