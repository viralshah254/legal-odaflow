import { normalizeLocale } from '@/config/locales';
import type { IssueCheckerType } from './issue-checker.constants';

export interface PlanQuestionFallback {
  id: string;
  text: string;
  required: boolean;
  options: string[];
}

export interface FollowUpQuestionFallback {
  question: string;
  answerType: 'yes_no' | 'single_choice' | 'duration' | 'text';
  options?: string[];
}

type LocaleFallbackMap<T> = Partial<Record<string, T>> & { en: T };

function pickLocalized<T>(map: LocaleFallbackMap<T>, locale?: string | null): T {
  const normalized = normalizeLocale(locale);
  return map[normalized] ?? map.en;
}

const PLAN_QUESTIONS_BY_LOCALE: LocaleFallbackMap<PlanQuestionFallback[]> = {
  en: [
    { id: 'q1', text: 'When did this situation begin?', required: false, options: ['Less than 1 month ago', '1–6 months ago', '6–12 months ago', 'Over a year ago'] },
    { id: 'q2', text: 'Do you have any written agreements or contracts?', required: false, options: ['Yes, signed', 'Yes, unsigned', 'Verbal only', 'No agreement', 'Not sure'] },
    { id: 'q3', text: 'Have you taken any legal steps so far?', required: false, options: ['No, not yet', 'Sent a demand letter', 'Filed a complaint', 'Court proceedings started', 'Sought legal advice'] },
  ],
  hi: [
    { id: 'q1', text: 'यह स्थिति कब शुरू हुई?', required: false, options: ['1 महीने से कम पहले', '1–6 महीने पहले', '6–12 महीने पहले', 'एक वर्ष से अधिक पहले'] },
    { id: 'q2', text: 'क्या आपके पास कोई लिखित समझौता या अनुबंध है?', required: false, options: ['हाँ, हस्ताक्षरित', 'हाँ, बिना हस्ताक्षर', 'केवल मौखिक', 'कोई समझौता नहीं', 'पक्का नहीं'] },
    { id: 'q3', text: 'क्या आपने अब तक कोई कानूनी कदम उठाया है?', required: false, options: ['नहीं, अभी नहीं', 'मांग पत्र भेजा', 'शिकायत दर्ज की', 'अदालती कार्यवाही शुरू', 'कानूनी सलाह ली'] },
  ],
  fr: [
    { id: 'q1', text: 'Quand cette situation a-t-elle commencé ?', required: false, options: ['Il y a moins d’un mois', 'Il y a 1 à 6 mois', 'Il y a 6 à 12 mois', 'Il y a plus d’un an'] },
    { id: 'q2', text: 'Avez-vous des accords ou contrats écrits ?', required: false, options: ['Oui, signé', 'Oui, non signé', 'Verbal seulement', 'Aucun accord', 'Pas sûr'] },
    { id: 'q3', text: 'Avez-vous déjà entrepris des démarches juridiques ?', required: false, options: ['Non, pas encore', 'Mise en demeure envoyée', 'Plainte déposée', 'Procédure judiciaire engagée', 'Conseil juridique obtenu'] },
  ],
  de: [
    { id: 'q1', text: 'Wann hat diese Situation begonnen?', required: false, options: ['Vor weniger als 1 Monat', 'Vor 1–6 Monaten', 'Vor 6–12 Monaten', 'Vor über einem Jahr'] },
    { id: 'q2', text: 'Haben Sie schriftliche Vereinbarungen oder Verträge?', required: false, options: ['Ja, unterschrieben', 'Ja, nicht unterschrieben', 'Nur mündlich', 'Keine Vereinbarung', 'Nicht sicher'] },
    { id: 'q3', text: 'Haben Sie bereits rechtliche Schritte unternommen?', required: false, options: ['Nein, noch nicht', 'Mahnschreiben gesendet', 'Beschwerde eingereicht', 'Gerichtsverfahren eingeleitet', 'Rechtsberatung eingeholt'] },
  ],
};

const GENERIC_OUTCOME_OPTIONS_BY_LOCALE: LocaleFallbackMap<string[]> = {
  en: ['Reach a settlement', 'Get compensation / damages', 'Stop the opposing party', 'Restore my legal rights', 'Negotiate an agreement'],
  hi: ['समझौता करें', 'मुआवज़ा / हर्जाना प्राप्त करें', 'विरोधी पक्ष को रोकें', 'अपने कानूनी अधिकार बहाल करें', 'समझौते पर बातचीत करें'],
  fr: ['Parvenir à un règlement', 'Obtenir une indemnisation / des dommages-intérêts', 'Faire cesser la partie adverse', 'Rétablir mes droits légaux', 'Négocier un accord'],
  de: ['Eine Einigung erzielen', 'Entschädigung / Schadensersatz erhalten', 'Die Gegenpartei stoppen', 'Meine Rechte wiederherstellen', 'Eine Vereinbarung aushandeln'],
};

const CLASSIFY_FALLBACK_QUESTIONS_EN: Record<IssueCheckerType | 'Other', FollowUpQuestionFallback[]> = {
  'Employment & Workplace': [
    { question: 'Is there a signed written employment contract?', answerType: 'yes_no' },
    { question: 'What type of employment arrangement is this?', answerType: 'single_choice', options: ['Full-time employee', 'Part-time employee', 'Independent contractor', 'Not sure'] },
    { question: 'Was the issue or termination communicated in writing?', answerType: 'yes_no' },
    { question: 'What is the notice or contract period?', answerType: 'duration' },
  ],
  'Landlord & Tenant': [
    { question: 'Is there a written tenancy agreement in place?', answerType: 'yes_no' },
    { question: 'Have you received any formal notice?', answerType: 'single_choice', options: ['Eviction notice', 'Rent increase notice', 'Other formal notice', 'No formal notice'] },
    { question: 'Has the deposit been registered with a scheme?', answerType: 'single_choice', options: ['Yes', 'No', 'Not sure'] },
    { question: 'What is the remaining lease term?', answerType: 'duration' },
  ],
  'Family & Divorce': [
    { question: 'Are children involved in this matter?', answerType: 'yes_no' },
    { question: 'Is there a prenuptial or postnuptial agreement?', answerType: 'single_choice', options: ['Yes', 'No', 'Not sure'] },
    { question: 'What assets are being disputed?', answerType: 'text' },
    { question: 'Has either party filed any court applications?', answerType: 'yes_no' },
  ],
  'Consumer Rights': [
    { question: 'Do you have receipts or written proof of the transaction?', answerType: 'yes_no' },
    { question: 'Have you already contacted the seller about this?', answerType: 'single_choice', options: ['Yes, in writing', 'Yes, verbally only', 'No'] },
    { question: 'What resolution are you seeking?', answerType: 'single_choice', options: ['Full refund', 'Replacement', 'Repair', 'Compensation', 'Other'] },
  ],
  'Contract Dispute': [
    { question: 'Is the contract written or verbal?', answerType: 'single_choice', options: ['Written and signed', 'Written but unsigned', 'Verbal only'] },
    { question: 'Have you sent a formal demand or notice to the other party?', answerType: 'yes_no' },
    { question: 'What was the original contract duration?', answerType: 'duration' },
    { question: 'Describe the specific obligation that was breached', answerType: 'text' },
  ],
  'Contract & Document Drafting': [
    { question: 'What type of document do you need drafted?', answerType: 'single_choice', options: ['Service / contractor agreement', 'Employment contract', 'NDA / confidentiality', 'Partnership / shareholder agreement', 'Lease / property agreement', 'Other'] },
    { question: "What is Party 1's full name? (your client, employer, landlord, or disclosing party)", answerType: 'text' },
    { question: "What is Party 2's full name? (counterparty, employee, tenant, or receiving party)", answerType: 'text' },
    { question: "What is Party 1's address?", answerType: 'text' },
    { question: "What is Party 2's address?", answerType: 'text' },
    { question: 'Briefly describe the key subject matter or purpose of the agreement (e.g. services to be provided, property details, employment role)', answerType: 'text' },
    { question: 'What are the payment or financial terms? (e.g. fixed fee, hourly rate, monthly rent, salary)', answerType: 'text' },
    { question: 'What is the intended start date and duration / end date of the agreement?', answerType: 'duration' },
    { question: 'Which governing law / jurisdiction should apply?', answerType: 'text' },
    { question: 'Does a draft already exist that needs review or revision?', answerType: 'yes_no' },
    { question: 'Are there any special clauses or terms you specifically want included? (e.g. confidentiality, IP ownership, non-compete, break clause)', answerType: 'text' },
  ],
  'Debt & Collections': [
    { question: 'Do you dispute the debt or acknowledge it?', answerType: 'single_choice', options: ['I dispute it', 'I acknowledge it', 'Partially disputed'] },
    { question: 'Have you received written communication from the collector?', answerType: 'yes_no' },
    { question: 'Has a court judgment been issued against you?', answerType: 'single_choice', options: ['Yes', 'No', 'Not sure'] },
  ],
  'Criminal Matter': [
    { question: 'Current status of the matter?', answerType: 'single_choice', options: ['Under investigation only', 'Formally charged', 'Court date set', 'Awaiting verdict'] },
    { question: 'Do you currently have legal representation?', answerType: 'yes_no' },
    { question: 'Are there witnesses or evidence in your favour?', answerType: 'single_choice', options: ['Yes', 'No', 'Not sure'] },
  ],
  'Immigration': [
    { question: 'What is your current immigration status?', answerType: 'single_choice', options: ['Valid visa / permit', 'Visa expired', 'Asylum seeker', 'Undocumented', 'Other'] },
    { question: 'Have you received an official notice or decision?', answerType: 'yes_no' },
    { question: 'Have you had previous visa refusals or immigration issues?', answerType: 'single_choice', options: ['Yes', 'No', 'Not sure'] },
  ],
  'Corporate & Commercial': [
    { question: 'Is there a written shareholders or partnership agreement?', answerType: 'yes_no' },
    { question: 'What is the main commercial dispute about?', answerType: 'text' },
    { question: 'Have formal notices or demands been sent?', answerType: 'yes_no' },
  ],
  'Real Estate & Conveyancing': [
    { question: 'Is there a signed sale or purchase agreement?', answerType: 'yes_no' },
    { question: 'What stage has the transaction reached?', answerType: 'single_choice', options: ['Offer accepted', 'Exchange completed', 'Completion delayed', 'Deal collapsed', 'Not sure'] },
    { question: 'Are title or boundary issues involved?', answerType: 'yes_no' },
  ],
  'Intellectual Property': [
    { question: 'Do you own registered IP rights (patent, trademark, copyright)?', answerType: 'single_choice', options: ['Yes', 'No', 'Application pending', 'Not sure'] },
    { question: 'Has the infringement been documented?', answerType: 'yes_no' },
    { question: 'What remedy are you seeking?', answerType: 'single_choice', options: ['Cease use', 'Licensing fee', 'Damages', 'Injunction', 'Other'] },
  ],
  'Tax & Revenue': [
    { question: 'Have you received a formal assessment or notice?', answerType: 'yes_no' },
    { question: 'Which tax period or year is affected?', answerType: 'text' },
    { question: 'Have you filed an objection or appeal?', answerType: 'single_choice', options: ['Yes', 'No', 'In progress', 'Not sure'] },
  ],
  'Wills, Estates & Probate': [
    { question: 'Is there a valid will?', answerType: 'single_choice', options: ['Yes', 'No', 'Uncertain / disputed', 'Not sure'] },
    { question: 'Are beneficiaries or executors in dispute?', answerType: 'yes_no' },
    { question: 'Has probate or letters of administration been granted?', answerType: 'single_choice', options: ['Yes', 'No', 'Application pending', 'Not sure'] },
  ],
  Other: [
    { question: 'Who are the main parties involved?', answerType: 'text' },
    { question: 'Is there written evidence or documentation?', answerType: 'single_choice', options: ['Yes', 'No', 'Some, but incomplete'] },
    { question: 'Have you taken any formal steps to resolve this?', answerType: 'yes_no' },
  ],
};

const CLASSIFY_FALLBACK_OUTCOMES_EN: Record<IssueCheckerType | 'Other', string[]> = {
  'Employment & Workplace': ['Wrongful termination claim filed', 'Compensation / back pay received', 'Settlement agreement reached', 'Employment contract enforced', 'HR dispute formally resolved'],
  'Landlord & Tenant': ['Deposit returned in full', 'Eviction notice challenged', 'Lease terms enforced', 'Repairs completed by landlord', 'Negotiated early exit agreed'],
  'Family & Divorce': ['Custody arrangement formalised', 'Fair asset division agreed', 'Child support order obtained', 'Divorce finalised', 'Mediation agreement reached'],
  'Consumer Rights': ['Full refund obtained', 'Product replaced or repaired', 'Financial compensation awarded', 'Company formally warned', 'Chargeback / dispute resolved'],
  'Contract Dispute': ['Contract enforced or rescinded', 'Outstanding payment recovered', 'Damages awarded', 'Settlement agreement signed', 'Breach formally documented'],
  'Contract & Document Drafting': ['Contract drafted and ready to sign', 'Agreement reviewed and finalised', 'All parties aligned on terms', 'Legally compliant document delivered', 'Signed copy held on file'],
  'Debt & Collections': ['Debt disputed and reduced', 'Repayment plan agreed', 'Harassment stopped', 'Judgment set aside', 'Debt written off or settled'],
  'Criminal Matter': ['Charges dropped or reduced', 'Acquittal at trial', 'Favourable plea agreement', 'Legal representation secured', 'Case dismissed'],
  'Immigration': ['Visa or permit approved', 'Deportation order challenged', 'Asylum claim accepted', 'Status regularised', 'Appeal successfully lodged'],
  'Corporate & Commercial': ['Commercial dispute settled', 'Contract enforced', 'Director dispute resolved', 'Business assets protected', 'Partnership terms clarified'],
  'Real Estate & Conveyancing': ['Sale or purchase completed', 'Deposit protected', 'Title defect remedied', 'Breach of contract remedy obtained', 'Completion date enforced'],
  'Intellectual Property': ['Infringement stopped', 'Licensing agreement reached', 'IP rights registered', 'Damages or royalties recovered', 'Cease-and-desist complied with'],
  'Tax & Revenue': ['Assessment reduced or cancelled', 'Penalty waived', 'Payment plan agreed', 'Appeal upheld', 'Tax position clarified'],
  'Wills, Estates & Probate': ['Estate distributed per will', 'Executor dispute resolved', 'Probate granted', 'Beneficiary entitlement confirmed', 'Family provision claim settled'],
  Other: ['Formal resolution reached', 'Legal rights protected', 'Financial compensation obtained', 'Agreement documented in writing', 'Matter escalated to court'],
};

const CLASSIFY_FALLBACK_QUESTIONS_BY_LOCALE: LocaleFallbackMap<
  Record<IssueCheckerType | 'Other', FollowUpQuestionFallback[]>
> = {
  en: CLASSIFY_FALLBACK_QUESTIONS_EN,
};

const CLASSIFY_FALLBACK_OUTCOMES_BY_LOCALE: LocaleFallbackMap<
  Record<IssueCheckerType | 'Other', string[]>
> = {
  en: CLASSIFY_FALLBACK_OUTCOMES_EN,
};

export function getPlanQuestionsFallback(locale?: string | null): PlanQuestionFallback[] {
  return pickLocalized(PLAN_QUESTIONS_BY_LOCALE, locale);
}

export function getGenericOutcomeOptionsFallback(locale?: string | null): string[] {
  return pickLocalized(GENERIC_OUTCOME_OPTIONS_BY_LOCALE, locale);
}

export function getClassifyFallbackQuestions(
  issueType: string,
  locale?: string | null,
): FollowUpQuestionFallback[] {
  const byType = pickLocalized(CLASSIFY_FALLBACK_QUESTIONS_BY_LOCALE, locale);
  const key = (issueType in byType ? issueType : 'Other') as IssueCheckerType | 'Other';
  return byType[key] ?? byType.Other;
}

export function getClassifyFallbackOutcomes(
  issueType: string,
  locale?: string | null,
): string[] {
  const byType = pickLocalized(CLASSIFY_FALLBACK_OUTCOMES_BY_LOCALE, locale);
  const key = (issueType in byType ? issueType : 'Other') as IssueCheckerType | 'Other';
  return byType[key] ?? byType.Other;
}
