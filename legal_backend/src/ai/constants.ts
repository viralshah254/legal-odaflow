export { AI_TASK_TYPES } from '@/ai-credits/task-types';

export const AI_MODES = {
  CONSUMER_FREE_PREVIEW: 'CONSUMER_FREE_PREVIEW',
  FIRM_INTAKE_PREVIEW: 'FIRM_INTAKE_PREVIEW',
  LAWYER_COPILOT: 'LAWYER_COPILOT',
  LEGAL_RESEARCH: 'LEGAL_RESEARCH',
  LAWYER_LEGAL_RESEARCH: 'LAWYER_LEGAL_RESEARCH',
} as const;

export const CONSUMER_DISCLAIMER =
  'Legal by OdaFlow provides legal information, document explanation, self-help preparation, and risk analysis. ' +
  'It is not a law firm and does not replace a licensed lawyer. ' +
  'For legal advice specific to your situation, you should consult a qualified lawyer in your jurisdiction.';
