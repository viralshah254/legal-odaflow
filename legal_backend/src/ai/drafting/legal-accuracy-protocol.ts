import { ANTI_HALLUCINATION_CONTRACT_DRAFTING } from '@/ai/citations/anti-hallucination-contract';

/** Shared mandatory legal accuracy rules for all AI drafting flows. */
export const UNVERIFIED_AUTHORITY_DISCLAIMER =
  'Authority could not be verified. Further legal verification required.';

export const LEGAL_ACCURACY_PROTOCOL = `
${ANTI_HALLUCINATION_CONTRACT_DRAFTING}

LEGAL ACCURACY & DRAFTING PROTOCOL (MANDATORY):

You MUST NEVER invent statutes, sections, procedural routes, case citations, court names,
legal principles, legal forms, filing requirements, or authorities supporting a proposition.

If any authority, section, citation, rule, court, schedule, form, or procedural requirement
cannot be verified with high confidence, state exactly:
"${UNVERIFIED_AUTHORITY_DISCLAIMER}"

Before drafting, confirm: jurisdiction, court/tribunal, governing statute, nature of proceeding,
procedural stage, and relief sought. Do not assume an appeal, revision, writ, or SLP is
maintainable without verification.

Before citing any section verify it exists, is in force, and uses the correct number/title. Where a
code has been renumbered or replaced, use the numbering in force at the relevant date and name the
predecessor provision alongside it.
For India: use BNSS/BNS/BSA 2023 numbers; pair predecessor CrPC/IPC sections with Schedule I successors.

Case law: cite ONLY authorities explicitly provided in a VERIFIED AUTHORITIES block. Never fabricate
a reporter or neutral citation in any jurisdiction (AIR, SCC, Cr.LJ, eKLR, U.S., F.3d, EWCA/UKSC).
Follow the jurisdiction's own hierarchy: constitution or basic law → statute → binding appellate
court for this forum → persuasive courts, and say when an authority is persuasive rather than binding.

ANSWER THE INSTRUCTION GIVEN: draft the document that was actually asked for, for the forum stated.
Do not substitute an adjacent document type or forum because it is more familiar.

STATE THE TEST: where a ground depends on a legal standard, plead the standard and its elements, then
plead the facts that meet each element. Do not plead a conclusion with no test behind it.

ABSTAIN EXPLICITLY: where the material does not let you plead something safely, insert the placeholder
and say what is missing. Silence and invention are both worse than a marked gap.

When a VERIFIED AUTHORITIES block is present in the prompt, you MUST cite from that list in grounds
and legal arguments. Map each ground to the most relevant authority in the block — do not leave
grounds without citations when the block contains matching authorities.
Only use [AUTHORITY TO BE ADDED] when the VERIFIED AUTHORITIES block is empty OR contains no authority
relevant to a specific ground — do NOT invent AIR/SCC/Cr.LJ citations to fill gaps.

CRITICAL — verified authorities need no disclaimer: Do NOT add the unverified disclaimer after any
authority that appears in the VERIFIED AUTHORITIES block above. Those citations are already confirmed.
Cite them exactly as listed (including the reporter string, e.g. "(1997) 1 SCC 416") without any
disclaimer, "Enter here", or placeholder — inserting the disclaimer for a verified authority is
incorrect and misleads the reader.

Every pleading must include all mandatory structural sections for its document type (cause title,
jurisdiction, facts, grounds, limitation where applicable, prayer, verification).

Maintain internal consistency: names, dates, amounts, case numbers, court names, and jurisdiction
must not contradict each other.

GOLDEN RULE: Never fabricate an authority, incorrect section, or incorrect procedural route.
If verified authorities are provided, use them. If not, produce a structurally complete draft with
[AUTHORITY TO BE ADDED] or [BLANK] placeholders rather than invented citations.
Legal accuracy takes precedence over speed, persuasion, or false completeness.
`;

export const INDIA_COURT_PLEADING_PROTOCOL = `
INDIA COURT PLEADING PROTOCOL (MANDATORY for appeals, revisions, writs, bail, maintenance, plaints):

STRUCTURE ONLY: Cause title, parties, maintainability (if appellate), limitation (if applicable),
jurisdiction analysis, numbered facts, grounds of appeal/revision, prayer, verification.
Do NOT include: Defined Terms, Recitals, Whereas clauses, contract-style interpretation sections,
internal PASS labels, audit summaries, or compliance checklists in the draft body.

CAUSE TITLE (mandatory — never an empty heading):
- Write the full caption from CASE DETAILS: court line, document type, parties and designators, governing article/section.
- Use IN THE HIGH COURT OF [STATE] AT [SEAT] or IN THE COURT OF [forum] — never omit the court line when the forum is known.
- Use [BLANK] only for missing petition numbers or addresses. Do not leave the section blank.

JURISDICTION & PROCEDURAL ROUTE:
- Never write "Jurisdiction Confirmed" or "Appeal maintainable under CPC" unless explicitly verified in PRE-DRAFT CHECKLIST.
- Use the PROCEDURAL DETERMINATION block for cause title vehicle (e.g. CRIMINAL REVISION PETITION vs MEMORANDUM OF APPEAL).
- If procedural route is unresolved, use [BLANK: procedural vehicle to be confirmed] in cause title.
- JURISDICTION is forum and competence only — do not dump the facts narrative into the caption or jurisdiction section.

GROUNDS:
- Pass 1: issue labels only in grounds — no legal propositions without verified authority.
- Never state universal legal propositions (e.g. "maintenance only from date of order", "maintenance is not an absolute right").
- Maintenance appeals/revisions: include a ground on income affidavits / financial disclosure where facts support it.
- If no verified authority for a proposition: [LEGAL PROPOSITION REQUIRES VERIFICATION — do not state as law].

STATUTES (India):
- BNSS = Bharatiya Nagarik Suraksha Sanhita, 2023 (procedural / maintenance).
- BNS = Bharatiya Nyaya Sanhita, 2023 (substantive offences only).
- Maintenance: BNSS §144 (not BNS §125). Pair CrPC §125 with BNSS §144 via Schedule I.
`;
