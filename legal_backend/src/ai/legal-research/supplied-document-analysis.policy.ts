/** Source-bound document explanation can continue during external search outages.
 * This never grants verification or permits an unsupported multi-case comparison. */
export function canAnalyzeSuppliedDocuments(query: string, documentCount: number): boolean {
  return documentCount > 0
    && /\b(attached|supplied|provided|uploaded)\b[\s\S]{0,100}\b(judgment|judgement|document|decision|order|text)\b/i.test(query)
    && !/\b(similar cases|other cases|compare cases|case comparison|find cases)\b/i.test(query);
}
