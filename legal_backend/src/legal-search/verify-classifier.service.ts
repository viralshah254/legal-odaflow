import { Injectable } from '@nestjs/common';

export interface VerifyClassifierResult {
  pass: boolean;
  driftEntities: string[];
  confidence: number;
  reasons: string[];
}

@Injectable()
export class VerifyClassifierService {
  classify(params: {
    query: string;
    outputMarkdown: string;
    authorities: Array<{
      fullText?: string | null;
      summary?: string | null;
    }>;
    isBareActQuery: boolean;
  }): VerifyClassifierResult {
    const driftEntities = this.detectDriftEntities(params.query, params.outputMarkdown, params.authorities);
    const pass = driftEntities.length === 0;
    return {
      pass,
      driftEntities,
      confidence: pass ? 0.9 : 0.4,
      reasons: driftEntities.map((e) => `Entity drift: ${e}`),
    };
  }

  private detectDriftEntities(
    query: string,
    output: string,
    authorities: Array<{ fullText?: string | null; summary?: string | null }>,
  ): string[] {
    const drift: string[] = [];
    const q = query.toLowerCase();
    const authorityText = authorities
      .map((a) => [a.fullText, a.summary].filter(Boolean).join(' '))
      .join('\n')
      .toLowerCase();

    const entityChecks: Array<{ queryPattern: RegExp; authorityPattern: RegExp; outputForbidden: RegExp; label: string }> = [
      {
        queryPattern: /article\s*21|art\.?\s*21/i,
        authorityPattern: /life|personal liberty|procedure established by law/i,
        outputForbidden: /131st|constitutional amendment bill/i,
        label: 'Art 21 — stale amendment reference',
      },
      {
        queryPattern: /article\s*330a|330\s*a/i,
        authorityPattern: /reservation|scheduled castes|scheduled tribes/i,
        outputForbidden: /131st|constitutional amendment bill/i,
        label: 'Art 330A — stale amendment reference',
      },
      {
        queryPattern: /crpc\s*125|section\s*125.*crpc/i,
        authorityPattern: /maintenance|bnss|bns/i,
        outputForbidden: /high court writ only/i,
        label: 'CrPC 125 remap — maintenance forum',
      },
      {
        queryPattern: /bns\s*\d+|section\s*\d+.*bns/i,
        authorityPattern: /bharatiya nyaya|bns|punishment/i,
        outputForbidden: /ipc\s*302|indian penal code\s*302/i,
        label: 'BNS query answered with IPC-only text',
      },
    ];

    for (const check of entityChecks) {
      if (!check.queryPattern.test(q)) continue;
      const authorityOk = check.authorityPattern.test(authorityText) || authorityText.length > 50;
      const outputBad = check.outputForbidden.test(output);
      if (authorityOk && outputBad) drift.push(check.label);
    }

    return drift;
  }
}
