import type { RetrievedAuthority, RetrievedSourcePassage } from '@/legal-search/legal-retrieval.types';
import { PassageClassificationService } from './passage-classification.service';

const STOP = new Set(['the', 'and', 'for', 'that', 'this', 'what', 'which', 'under', 'with', 'from', 'does', 'are', 'law', 'case', 'court', 'kenya', 'india', 'united', 'states', 'including', 'identify', 'explain', 'provided', 'employment', 'employee', 'employer', 'employees', 'employers', 'contract', 'provisions', 'applicable', 'required', 'parties', 'statute', 'statutory', 'work', 'act', 'when', 'how', 'these', 'those', 'such', 'has', 'have', 'can', 'may', 'will', 'there', 'here', 'only', 'also']);
/** Select source passages by role and issue overlap, preserving exact text and pinpoints. */
export function relevantPassages<T extends RetrievedSourcePassage>(passages: T[], query: string, limit = 4): T[] {
  const tokens = [...new Set(query.toLowerCase().match(/[a-z]{3,}/g) ?? [])].filter(token => !STOP.has(token)).map(token => token.replace(/ly$|s$/g, ''));
  if (/\bdismiss(?:al|ed|ing)?\b/i.test(query)) {
    if (!tokens.includes('terminat')) tokens.push('terminat');
    if (/\bemploy(?:ee|er|ment)\b/i.test(query)) for (const term of ['unfair','reason','hearing']) if (!tokens.includes(term)) tokens.push(term);
  }
  const classifier = new PassageClassificationService();
  return passages.map((passage, index) => {
    const role = passage.classification ?? classifier.classify(passage.text).classification;
    const text = passage.text.toLowerCase();
    const overlap = tokens.reduce((score, token) => { const count = text.match(new RegExp('\\b' + token + '[a-z]*\\b', 'g'))?.length ?? 0; return score + Math.min(3, count); }, 0) / Math.sqrt(1 + text.split(/\s+/).length / 150);
    const roleWeight = role === 'HOLDING' || role === 'RATIO' ? 10000 : role === 'PARTY_SUBMISSION' || role === 'DISSENT' || role === 'HEADNOTE' || role === 'COMMENTARY' ? -10000 : 0;
    const heading = /^Section \d/.test(passage.paragraph ?? '') ? text.split('\n')[0] : '';
    const headingOverlap = tokens.filter(token => new RegExp('\\b' + token + '[a-z]*\\b').test(heading)).length;
    return { passage, index, score: roleWeight + overlap * 5 + headingOverlap * 30 };
  }).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, limit).map(row => row.passage);
}


/** Preserve relevant provisions from a complete act even when document reranking trimmed child sections. */
export function expandRelevantStatuteProvisions(authorities: RetrievedAuthority[], query: string): RetrievedAuthority[] {
  const expanded = [...authorities];
  for (const authority of authorities) {
    if (authority.section || authority.authorityType !== 'STATUTE' || authority.sourceProvenance?.completeness !== 'COMPLETE') continue;
    const actName = authority.actName ?? authority.title;
    const selected = relevantPassages(authority.sourcePassages ?? [], query.split(/\b(?:identify|explain|including)\b/i)[0], 8);
    // Preserve referenced exceptions and definitions from the same complete Act;
    // a cross-reference alone is not the text of the referenced provision.
    const crossReferences = new Set(selected.flatMap(p => [...p.text.matchAll(/\bsections?\s+(\d+[A-Z]?)/gi)].map(m => m[1])));
    const referenced = (authority.sourcePassages ?? []).filter(p => crossReferences.has(p.paragraph?.match(/^Section (\d+[A-Z]?)$/)?.[1] ?? '')).slice(0, 8);
    for (const passage of [...selected, ...referenced]) {
      const section = passage.paragraph?.match(/^Section (\d+[A-Z]?)$/)?.[1];
      if (!section || !passage.sourcePinpoint || !passage.page) continue;
      if (expanded.some(existing => existing.sourceUrl === authority.sourceUrl && existing.section === section)) continue;
      expanded.push({ ...authority, id: `${authority.id}-s${section}`, title: `${actName} Section ${section}`, citation: `${actName} s.${section}`, actName,
        actYear: Number(actName.match(/\b(?:19|20)\d{2}\b/)?.[0]) || undefined, section, heading: passage.text.split('\n')[0],
        fullText: passage.text, summary: passage.text.slice(0, 600), sourcePassages: [passage], page: passage.page });
    }
  }
  return expanded;
}
