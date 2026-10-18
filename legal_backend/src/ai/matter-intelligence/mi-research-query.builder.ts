import type { MatterGraph, MatterProfile } from './matter-intelligence.types';

export interface MiResearchQueryInput {
  profile: MatterProfile;
  graph?: MatterGraph;
  userQuery?: string;
}

/** Build legal-research queries from MatterProfile + MatterGraph (P17 scaffold). */
export function buildMiResearchQuery(input: MiResearchQueryInput): string {
  const parts: string[] = [];
  const { profile, graph, userQuery } = input;

  if (userQuery?.trim()) {
    parts.push(userQuery.trim());
  }

  parts.push(`${profile.practiceArea.replace(/_/g, ' ')} matter`);
  if (profile.subPracticeArea) {
    parts.push(profile.subPracticeArea.replace(/_/g, ' '));
  }
  if (profile.forum) {
    parts.push(`forum: ${profile.forum.replace(/_/g, ' ')}`);
  }
  if (profile.issues.length) {
    parts.push(`issues: ${profile.issues.slice(0, 3).join('; ')}`);
  }
  if (graph?.statutes?.length) {
    parts.push(
      `statutes: ${graph.statutes
        .slice(0, 3)
        .map((s) => (s.section ? `${s.act} s.${s.section}` : s.act))
        .join(', ')}`,
    );
  }
  if (graph?.claims?.length) {
    parts.push(`claim: ${graph.claims[0].summary.slice(0, 120)}`);
  }

  return parts.filter(Boolean).join('. ');
}
