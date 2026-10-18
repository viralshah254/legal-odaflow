import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { DEFAULT_AUTO_MODEL } from '@/ai/model-costs.config';
import type { MatterProfile } from '@/ai/matter-intelligence/matter-intelligence.types';
import type { ClarifyingQuestion as MiClarifyingQuestion } from '@/ai/matter-intelligence/matter-intelligence.types';
import type { ClarifyingQuestion, DraftContext } from './draft-intent.types';
import {
  extractMatterFacts,
  hasBns78Citation,
  isFamilyDisputeContext,
  isSelfDefenseHomicideContext,
  isStalkingComplaintContext,
  type ExtractedMatterFacts,
} from './matter-fact-extractor';
import { isDivorceMatrimonialContext } from './draft-intent-bundles';

const GENERIC_MI_QUESTION_IDS = new Set(['practice_area', 'sub_practice', 'nature']);
const STALKING_QUESTION_IDS = new Set([
  'stalking_conduct',
  'stalking_frequency',
  'stalking_evidence',
  'stalking_aggravation',
]);
const SELF_DEFENSE_QUESTION_IDS = new Set([
  'self_defense_goal',
  'self_defense_fir_status',
  'self_defense_custody_stage',
]);
const MATRIMONIAL_QUESTION_IDS = new Set(['matrimonial_party_role']);

export function isMatrimonialQuestionPack(questions: ClarifyingQuestion[]): boolean {
  return questions.some((q) => MATRIMONIAL_QUESTION_IDS.has(q.id));
}

export function isStalkingQuestionPack(questions: ClarifyingQuestion[]): boolean {
  return questions.some((q) => STALKING_QUESTION_IDS.has(q.id));
}

export function isSelfDefenseQuestionPack(questions: ClarifyingQuestion[]): boolean {
  return questions.some((q) => SELF_DEFENSE_QUESTION_IDS.has(q.id));
}

function selfDefenseHomicideQuestions(extracted: ExtractedMatterFacts): ClarifyingQuestion[] {
  const deathNote = extracted.hasDeathOutcome
    ? ' A death is reported — filing route and party posture must be confirmed before drafting.'
    : '';
  const accusedLabel = extracted.accusedName?.trim() || 'the accused';
  const firAgainstLabel = extracted.accusedName?.trim()
    ? `FIR already registered against ${extracted.accusedName.trim()}`
    : 'FIR already registered against our client';

  return [
    {
      id: 'self_defense_goal',
      prompt: `What do you need the AI to draft?${deathNote} Self-defence facts can support either a victim complaint or an accused’s defence — do not assume FIR filing.`,
      options: [
        {
          value: 'file_fir_as_survivor',
          label: 'File / lodge FIR or police complaint as the survivor (complainant)',
          hint: 'You want the police record of the attack and self-defence.',
          routes_to: 'police_complaint',
        },
        {
          value: 'defense_against_homicide',
          label: `Defence / reply — ${accusedLabel} may be accused or investigated after the death`,
          hint: 'Self-defence narrative for criminal defence (not a complainant FIR).',
          routes_to: 'defense_memo',
        },
        {
          value: 'discharge_application',
          label: extracted.accusedName?.trim()
            ? `Application for discharge (BNSS §250 / §262) — on behalf of ${extracted.accusedName.trim()}`
            : 'Application for discharge (BNSS §250 / §262)',
          hint: 'Post-chargesheet / pre-charge-framing — argue the material does not make out a case for trial.',
          routes_to: 'discharge_application',
        },
        {
          value: 'bail_or_anticipatory',
          label: 'Bail / anticipatory bail application',
          hint: 'Arrest feared or custody — seek bail on self-defence facts.',
          routes_to: 'bail_application',
        },
        {
          value: 'police_statement_only',
          label: 'Police statement / self-defence narrative only (not a formal FIR draft yet)',
          hint: 'Preserve CCTV and facts; formal filing route still undecided.',
          routes_to: 'defense_memo',
        },
        {
          value: 'not_sure',
          label: 'Not sure — show the safest drafting options after clarifying',
        },
      ],
    },
    {
      id: 'self_defense_fir_status',
      prompt: 'Has an FIR already been registered — and against whom?',
      options: [
        {
          value: 'no_fir_yet',
          label: 'No FIR yet',
        },
        {
          value: 'fir_against_attacker',
          label: 'FIR / complaint already against the person who attacked',
          routes_to: 'police_complaint',
        },
        {
          value: 'fir_against_client',
          label: firAgainstLabel,
          hint: 'Defence or bail is usually the priority — not a fresh complainant FIR.',
          routes_to: 'defense_memo',
        },
        {
          value: 'unknown',
          label: 'Unknown / still checking',
        },
      ],
    },
    {
      id: 'self_defense_custody_stage',
      prompt: 'What is the current stage?',
      options: [
        {
          value: 'pre_complaint',
          label: 'Pre-complaint — deciding whether / how to approach police',
          hint: extracted.hasChargesheetFiled
            ? 'Your facts mention a chargesheet — confirm if this stage still applies.'
            : undefined,
        },
        { value: 'investigation', label: 'Investigation ongoing' },
        {
          value: 'arrest_feared',
          label: 'Arrest feared / notice of appearance',
          routes_to: 'bail_application',
        },
        {
          value: 'in_custody_or_chargesheet',
          label: 'In custody / chargesheet / trial stage',
          hint: extracted.hasChargesheetFiled
            ? 'Matches your facts (chargesheet filed) — confirm if this is the current stage.'
            : undefined,
          routes_to: 'bail_application',
        },
        { value: 'unclear', label: 'Unclear' },
      ],
    },
  ];
}

function stalkingFactQuestions(extracted: ExtractedMatterFacts): ClarifyingQuestion[] {
  const statuteHint = hasBns78Citation(extracted.citedStatutes)
    ? ' You cited BNS §78 (stalking) — that section needs underlying facts, not only the label “stalks”.'
    : ' “Stalks” is your legal allegation; BNS §78 generally needs repeated conduct or electronic monitoring plus clear disinterest.';

  return [
    {
      id: 'stalking_conduct',
      prompt: `What exactly did the accused do?${statuteHint}`,
      multiSelect: true,
      options: [
        { value: 'follow_physically', label: 'Followed her physically' },
        { value: 'wait_outside', label: 'Waited outside home, college, or workplace' },
        { value: 'call_message', label: 'Called or messaged her' },
        { value: 'monitor_online', label: 'Monitored social media / online activity', routes_to: 'india_cyber_crime_complaint' },
        { value: 'send_others', label: 'Sent other people to contact her' },
        { value: 'not_sure_yet', label: 'Not sure yet — still gathering facts' },
      ],
    },
    {
      id: 'stalking_frequency',
      prompt: 'How often did it happen, and did she clearly show disinterest or tell him to stop?',
      options: [
        { value: 'once', label: 'Once / isolated incident' },
        { value: 'repeated', label: 'Repeated conduct' },
        { value: 'told_to_stop', label: 'She told him to stop / showed clear disinterest' },
        { value: 'unclear', label: 'Unclear / not discussed yet' },
      ],
    },
    {
      id: 'stalking_evidence',
      prompt: 'What evidence is available?',
      multiSelect: true,
      options: [
        { value: 'messages', label: 'Messages' },
        { value: 'call_logs', label: 'Call logs' },
        { value: 'cctv', label: 'CCTV' },
        { value: 'screenshots', label: 'Screenshots' },
        { value: 'witnesses', label: 'Witnesses' },
        { value: 'photographs', label: 'Photographs' },
        { value: 'prior_complaint', label: 'Previous complaint' },
        { value: 'none_yet', label: 'None yet' },
      ],
    },
    {
      id: 'stalking_aggravation',
      prompt: 'Were there threats, sexual remarks, touching, trespass, violence — or is she presently unsafe?',
      multiSelect: true,
      options: [
        { value: 'threats', label: 'Threats / intimidation' },
        { value: 'sexual_remarks', label: 'Sexual remarks / obscene messages' },
        { value: 'touching', label: 'Touching / physical contact' },
        { value: 'trespass', label: 'Trespass' },
        { value: 'violence', label: 'Violence / assault' },
        { value: 'presently_unsafe', label: 'Presently unsafe / immediate danger' },
        { value: 'police_refused', label: 'Police already refused / did not act', routes_to: 'india_complaint_magistrate_bnss_223' },
        { value: 'none', label: 'None of these' },
      ],
    },
  ];
}

function formatDocumentKindLabel(kind: string): string {
  return kind
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function documentKindQuestion(context: DraftContext): ClarifyingQuestion | null {
  const primary = context.documentKind;
  if (!primary) return null;

  const alternatives = context.documentKindAlternatives ?? [];
  const shouldAsk =
    context.documentKindConfidence === 'low' ||
    alternatives.filter((kind) => kind !== primary).length >= 2;
  if (!shouldAsk) return null;

  const kindValues = Array.from(new Set([primary, ...alternatives])).slice(0, 3);
  if (kindValues.length === 0) return null;

  return {
    id: 'document_kind',
    prompt: 'Which document should the AI draft from these facts?',
    options: [
      ...kindValues.map((kind) => ({
        value: kind,
        label: formatDocumentKindLabel(kind),
        hint: kind === primary ? context.documentKindReason : undefined,
        routes_to: kind,
      })),
      {
        value: 'not_sure',
        label: 'Not sure — show the best drafting options',
      },
    ],
  };
}

/** Skip generic MI gate questions when domain-specific context is already clear. */
export function filterGenericMiQuestions(
  questions: MiClarifyingQuestion[],
  profile: MatterProfile,
  extracted: ExtractedMatterFacts,
  context?: DraftContext,
): MiClarifyingQuestion[] {
  const domainKnown =
    isFamilyDisputeContext(profile.practiceArea, extracted) &&
    profile.confidence >= 0.65 &&
    Boolean(profile.subPracticeArea || extracted.hasDvCase || extracted.hasMaintenanceContext);

  const challengeKnown =
    profile.posture === 'revision' ||
    profile.posture === 'appeal' ||
    extracted.posture === 'challenge' ||
    context?.documentIntent === 'challenge';

  const stalkingKnown = isStalkingComplaintContext(profile, extracted);
  const selfDefenseKnown = isSelfDefenseHomicideContext(extracted);

  return questions.filter((q) => {
    if (!GENERIC_MI_QUESTION_IDS.has(q.id)) return true;
    // Prefer stalking fact questions over generic practice-area when stalking is already clear.
    if (stalkingKnown && GENERIC_MI_QUESTION_IDS.has(q.id)) return false;
    if (selfDefenseKnown && GENERIC_MI_QUESTION_IDS.has(q.id)) return false;
    if (q.id === 'practice_area' && (profile.fieldConfidence?.practiceArea ?? profile.confidence) >= 0.8) {
      return false;
    }
    if (q.id === 'nature' && (challengeKnown || domainKnown || profile.nature === 'dispute')) {
      return false;
    }
    if (q.id === 'sub_practice' && profile.subPracticeArea && (profile.fieldConfidence?.subPracticeArea ?? 0.7) >= 0.7) {
      return false;
    }
    return true;
  });
}

function matrimonialPartyRoleQuestion(extracted: ExtractedMatterFacts): ClarifyingQuestion {
  const petitionerHint = extracted.parties.petitioner
    ? `Facts name ${extracted.parties.petitioner} as petitioner.`
    : '';
  return {
    id: 'matrimonial_party_role',
    prompt: `Which party do you represent in this matrimonial matter?${petitionerHint ? ` ${petitionerHint}` : ''}`,
    options: [
      {
        value: 'petitioner',
        label: 'Petitioner — spouse filing for divorce or ancillary relief',
        hint: 'You are drafting the initial petition, maintenance, custody, or DV applications.',
        routes_to: 'divorce_petition',
      },
      {
        value: 'wife_seeking_divorce',
        label: 'Wife / female spouse seeking divorce',
        routes_to: 'divorce_petition',
      },
      {
        value: 'husband_seeking_divorce',
        label: 'Husband / male spouse seeking divorce',
        routes_to: 'divorce_petition',
      },
      {
        value: 'respondent',
        label: 'Respondent — defending against an existing or anticipated petition',
        hint: 'Written statement, reply, or counter-restitution — not the initial divorce petition.',
        routes_to: 'written_statement_matrimonial',
      },
      {
        value: 'defending_spouse',
        label: 'Defending spouse (written statement / reply)',
        routes_to: 'written_statement_matrimonial',
      },
      {
        value: 'not_sure',
        label: 'Not sure — recommend based on my facts',
      },
    ],
  };
}

function maintenanceStatuteQuestion(
  extracted: ExtractedMatterFacts,
  statute?: string,
): ClarifyingQuestion | null {
  if (statute === 'hma_24' || statute === 'bnss_144' || statute === 'dv_act') return null;

  const amountHint = extracted.orderAmount
    ? `Interim order of ₹${extracted.orderAmount}/month mentioned in your facts. `
    : extracted.hasInterimOrder
      ? 'Interim order mentioned in your facts. '
      : '';

  return {
    id: 'maintenance_statute',
    prompt: `${amountHint}Under which law was the maintenance or monetary order passed?`,
    options: [
      {
        value: 'hma_24',
        label: 'Section 24 HMA — Hindu Marriage Act (Family Court)',
        hint: 'Matrimonial proceedings. Challenge typically via Article 227 or civil revision.',
        routes_to: 'hma_section_24_challenge',
      },
      {
        value: 'bnss_144',
        label: 'Section 144 BNSS / Section 125 CrPC (Magistrate Court)',
        hint: 'Criminal maintenance. Challenged by Criminal Revision Petition under BNSS §438.',
        routes_to: 'maintenance_order_revision',
      },
      {
        value: 'dv_act',
        label: 'Section 23 Domestic Violence Act (monetary relief under DV proceedings)',
        hint: 'PWDVA monetary relief or residence order in a DV case.',
        routes_to: 'maintenance_order_revision',
      },
      {
        value: 'not_sure',
        label: 'Not sure — recommend the correct procedural route',
        routes_to: 'maintenance_order_revision',
      },
    ],
  };
}

@Injectable()
export class MatterClarificationService {
  private readonly logger = new Logger(MatterClarificationService.name);

  constructor(
    @Optional() private readonly llm?: LlmCompletionService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  buildContextualQuestions(
    facts: string,
    profile: MatterProfile,
    context: DraftContext,
    extracted: ExtractedMatterFacts = extractMatterFacts(facts),
  ): ClarifyingQuestion[] {
    // Death + self-defence: never skip — posture (complainant vs accused) is ambiguous.
    if (isSelfDefenseHomicideContext(extracted)) {
      return selfDefenseHomicideQuestions(extracted).slice(0, 3);
    }

    // Sparse stalking / BNS §78: ask fact questions before recommending a filing route.
    if (
      isStalkingComplaintContext(profile, extracted) &&
      (extracted.isSparseAllegation ||
        extracted.hasStalkingAllegation ||
        hasBns78Citation(extracted.citedStatutes))
    ) {
      return stalkingFactQuestions(extracted).slice(0, 4);
    }

    const documentKindQ = documentKindQuestion(context);
    if (!isFamilyDisputeContext(profile.practiceArea, extracted)) {
      return documentKindQ ? [documentKindQ] : [];
    }

    const isChallenge =
      extracted.posture === 'challenge' ||
      context.documentIntent === 'challenge' ||
      profile.posture === 'revision' ||
      profile.posture === 'appeal';

    const questions: ClarifyingQuestion[] = documentKindQ ? [documentKindQ] : [];

    if (
      isDivorceMatrimonialContext(facts) &&
      !isChallenge &&
      extracted.inferredRepresentedParty === 'unknown' &&
      !questions.some((q) => q.id === 'matrimonial_party_role')
    ) {
      questions.unshift(matrimonialPartyRoleQuestion(extracted));
    }

    if (isChallenge && (extracted.hasDvCase || extracted.hasMaintenanceContext || extracted.hasInterimOrder)) {
      const opponent = extracted.parties.respondent ?? extracted.parties.petitioner ?? 'the other party';
      const proceedingLabel = extracted.hasDvCase
        ? `${opponent}'s domestic violence proceedings`
        : extracted.hasInterimOrder
          ? `the interim order in ${opponent}'s case`
          : 'this family matter';

      const options: ClarifyingQuestion['options'] = [];

      if (extracted.hasInterimOrder || extracted.hasMaintenanceContext) {
        options.push({
          value: 'challenge_interim_maintenance',
          label: extracted.orderAmount
            ? `Challenge the interim ₹${extracted.orderAmount}/month order`
            : 'Challenge the interim maintenance / monetary order',
          hint: 'Criminal revision or appropriate challenge against the interim amount.',
          routes_to: 'maintenance_order_revision',
        });
      }

      if (extracted.hasMarriageValidityChallenge) {
        options.push({
          value: 'deny_marriage_validity',
          label: 'Deny that a valid Hindu marriage took place',
          hint: 'Nullity / marriage validity challenge alongside or instead of maintenance challenge.',
          routes_to: 'hma_nullity_petition',
        });
      }

      if (extracted.hasDvCase) {
        options.push({
          value: 'defend_dv_merits',
          label: 'Defend on merits — deny dowry, harassment, or cruelty allegations',
          hint: 'Written statement / reply in the DV proceedings.',
          routes_to: 'written_statement_dv',
        });
      }

      if (options.length >= 2) {
        options.push({
          value: 'composite_revision',
          label: 'Composite challenge — interim order plus marriage validity / denial of allegations',
          hint: 'Revision petition addressing multiple grounds together.',
          routes_to: 'maintenance_order_revision',
        });
      }

      if (options.length > 0) {
        questions.push({
          id: 'relief_sought',
          prompt: `What do you need to challenge or respond to in ${proceedingLabel}?`,
          options,
          multiSelect: true,
        });
      }
    }

    const statuteQ = maintenanceStatuteQuestion(extracted, context.statute);
    if (
      statuteQ &&
      (extracted.hasMaintenanceContext || extracted.hasInterimOrder) &&
      context.statuteConfidence !== 'high' &&
      !questions.some((q) => q.id === 'maintenance_statute')
    ) {
      questions.push(statuteQ);
    }

    return questions.slice(0, 2);
  }

  async polishQuestions(
    questions: ClarifyingQuestion[],
    extracted: ExtractedMatterFacts,
  ): Promise<ClarifyingQuestion[]> {
    const enabled = this.configService?.get<string>('ENABLE_MI_CLARIFY_LLM') === 'true';
    if (!enabled || !this.llm || questions.length === 0) return questions;

    try {
      const schema = questions.map((q) => ({
        id: q.id,
        optionValues: q.options.map((o) => o.value),
      }));

      const result = await this.llm.complete({
        modelName: DEFAULT_AUTO_MODEL,
        messages: [
          {
            role: 'system',
            content: `Rewrite clarifying question prompts and option labels to reference the user's specific facts. Return ONLY JSON array: [{ "id": string, "prompt": string, "options": [{ "value": string, "label": string }] }]. Keep each option "value" unchanged. Do not add or remove options.`,
          },
          {
            role: 'user',
            content: `Facts summary: ${extracted.summaryLines.join('; ')}\n\nQuestions: ${JSON.stringify(questions.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options.map((o) => ({ value: o.value, label: o.label })) })))}\n\nAllowed option values per question: ${JSON.stringify(schema)}`,
          },
        ],
        maxTokens: 400,
        temperature: 0.1,
      });

      const raw = result.content.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
      const polished = JSON.parse(raw) as Array<{
        id: string;
        prompt: string;
        options: Array<{ value: string; label: string }>;
      }>;

      return questions.map((q) => {
        const match = polished.find((p) => p.id === q.id);
        if (!match) return q;
        return {
          ...q,
          prompt: match.prompt || q.prompt,
          options: q.options.map((opt) => {
            const po = match.options.find((o) => o.value === opt.value);
            return po ? { ...opt, label: po.label || opt.label } : opt;
          }),
        };
      });
    } catch (err) {
      this.logger.warn(`LLM clarify polish failed: ${err instanceof Error ? err.message : String(err)}`);
      return questions;
    }
  }
}

export function mergeClarifyingQuestions(
  contextual: ClarifyingQuestion[],
  legacy: ClarifyingQuestion[],
  genericMi: MiClarifyingQuestion[],
): ClarifyingQuestion[] {
  const miMapped: ClarifyingQuestion[] = genericMi.map((q) => ({
    id: q.id,
    prompt: q.text,
    options: (q.options ?? []).map((opt) => ({ value: opt, label: opt })),
  }));

  const seen = new Set<string>();
  const merged: ClarifyingQuestion[] = [];

  const add = (q: ClarifyingQuestion) => {
    if (seen.has(q.id)) return;
    seen.add(q.id);
    merged.push(q);
  };

  if (contextual.length > 0) {
    for (const q of contextual) add(q);
    for (const q of legacy) add(q);
    const cap = isStalkingQuestionPack(merged)
      ? 4
      : isSelfDefenseQuestionPack(merged)
        ? 3
        : isMatrimonialQuestionPack(merged)
          ? 2
          : 2;
    return merged.slice(0, cap);
  }

  if (legacy.length > 0) {
    for (const q of legacy) add(q);
    return merged;
  }

  for (const q of miMapped) add(q);
  return merged;
}
