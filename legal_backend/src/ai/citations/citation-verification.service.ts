import { Injectable } from '@nestjs/common';

export interface CitationAuthority {
  id: string;
  title: string;
  citation: string | null;
  sourceName?: string;
  summary?: string | null;
}

export interface VerifiedCitation {
  authorityId?: string;
  sourceName: string;
  citation: string;
  confidence: number;
  verified: boolean;
}

export interface CitationVerificationResult {
  verified: boolean;
  citations: VerifiedCitation[];
  warnings: string[];
}

@Injectable()
export class CitationVerificationService {
  async verifyCitations(params: {
    outputMarkdown: string;
    authorities: CitationAuthority[];
  }): Promise<CitationVerificationResult> {
    const warnings: string[] = [];
    const outputLower = params.outputMarkdown.toLowerCase();

    const citations: VerifiedCitation[] = params.authorities.map((authority) => {
      const label = authority.citation ?? authority.title;
      const mentioned =
        outputLower.includes(authority.title.toLowerCase()) ||
        (authority.citation != null &&
          outputLower.includes(authority.citation.toLowerCase()));

      if (!mentioned) {
        warnings.push(`Citation not referenced in output: ${label}`);
      }

      return {
        authorityId: authority.id,
        sourceName: authority.sourceName ?? 'Legal authority',
        citation: label,
        confidence: mentioned ? 0.85 : 0.45,
        verified: mentioned,
      };
    });

    return {
      verified: citations.every((row) => row.verified),
      citations,
      warnings,
    };
  }
}
