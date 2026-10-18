export interface ContraryAuthorityQueryInput {
  proposition: string;
  jurisdiction: string;
  court?: string;
  doctrine?: string;
  citedAuthorities?: Array<{ title: string; citation?: string | null }>;
  limit?: number;
}

/** Deterministically generates adversarial retrieval queries without an LLM. */
export class ContraryAuthorityQueryService {
  generate(input: ContraryAuthorityQueryInput): string[] {
    const proposition = this.clean(input.proposition);
    const jurisdiction = this.clean(input.jurisdiction);
    const scope = [jurisdiction, this.clean(input.court ?? ''), this.clean(input.doctrine ?? '')]
      .filter(Boolean)
      .join(' ');
    const queries = [
      `"${proposition}" overruled OR reversed OR doubted ${scope}`,
      `"${proposition}" distinguished OR declined OR "not followed" ${scope}`,
      `"${proposition}" contrary holding OR conflicting authority ${scope}`,
      `"${proposition}" limitation OR exception ${scope}`,
      ...(input.citedAuthorities ?? []).flatMap((authority) => {
        const identity = this.clean(
          `${authority.title}${authority.citation ? ` ${authority.citation}` : ''}`,
        );
        return [
          `"${identity}" overruled OR reversed OR doubted`,
          `"${identity}" distinguished OR "not followed" ${jurisdiction}`,
        ];
      }),
    ];
    const seen = new Set<string>();
    return queries
      .map((query) => query.replace(/\s+/g, ' ').trim())
      .filter((query) => query.length > 0 && !seen.has(query) && seen.add(query))
      .slice(0, Math.max(1, input.limit ?? 12));
  }

  private clean(value: string): string {
    return value.replace(/["\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
