import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { DataClassificationService } from '@/platform/security/data-classification.service';
import { AISafetyLog } from '@prisma/client';

export type SafetyCheckType =
  | 'hallucination_risk'
  | 'pii_in_output'
  | 'legal_unauthorized_advice'
  | 'prompt_injection_in_input'
  | 'factual_claim_without_citation'
  | 'overconfident_legal_conclusion';

export interface SafetyCheck {
  checkType: SafetyCheckType;
  passed: boolean;
  score: number; // 0-1, 1 = safest
  details?: string;
  flaggedContent?: string;
}

export interface LegalRequestContext {
  feature: string;
  tenantId?: string;
  userId?: string;
  workflowId?: string;
  hasAttorneyContext?: boolean;
  jurisdiction?: string;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

const RISK_THRESHOLDS: Record<RiskLevel, number> = {
  low: 0.3,
  medium: 0.5,
  high: 0.7,
  critical: 0.85,
};

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:previous|prior|all)\s+instructions/i,
  /you\s+are\s+now\s+(?:a\s+)?(?:different|new|an?\s+)/i,
  /act\s+as\s+(?:a\s+)?(?:jailbreak|DAN|developer mode)/i,
  /\[system\]/i,
  /\[assistant\]/i,
  /forget\s+(?:your\s+)?(?:training|instructions|guidelines)/i,
  /override\s+(?:your\s+)?(?:safety|guidelines|instructions)/i,
];

const UNAUTHORIZED_ADVICE_PATTERNS = [
  /you\s+(?:should|must|need\s+to|have\s+to)\s+(?:file|sue|sign|agree|accept|reject)/i,
  /(?:definitely|certainly|absolutely)\s+(?:do|don't|avoid|take)/i,
  /I\s+(?:recommend|advise|suggest)\s+you\s+to/i,
];

const OVERCONFIDENT_PATTERNS = [
  /(?:this\s+is\s+definitely|guaranteed|certain|100%|absolutely\s+clear)/i,
  /(?:without\s+(?:a\s+)?doubt|undoubtedly)\s+(?:valid|illegal|legal|enforceable)/i,
  /(?:will\s+definitely|will\s+certainly)\s+(?:win|lose|succeed|fail)/i,
];

const CITATION_CLAIM_PATTERNS = [
  /(?:under|pursuant\s+to|according\s+to|per)\s+(?:section|article|rule|act|code)\s+\d/i,
  /(?:the\s+law\s+states|statute\s+says|regulation\s+requires)\s+that/i,
];

@Injectable()
export class AiSafetyService {
  private readonly logger = new Logger(AiSafetyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataClassification: DataClassificationService,
  ) {}

  async scanInput(
    input: string,
    context: LegalRequestContext,
  ): Promise<SafetyCheck[]> {
    const checks: SafetyCheck[] = [];

    // Prompt injection check
    const injectionMatches = PROMPT_INJECTION_PATTERNS.filter((p) => p.test(input));
    checks.push({
      checkType: 'prompt_injection_in_input',
      passed: injectionMatches.length === 0,
      score: injectionMatches.length === 0 ? 1.0 : Math.max(0, 1 - injectionMatches.length * 0.3),
      details: injectionMatches.length > 0 ? `${injectionMatches.length} injection pattern(s) detected` : undefined,
      flaggedContent: injectionMatches.length > 0 ? input.slice(0, 200) : undefined,
    });

    return checks;
  }

  async scanOutput(
    output: string,
    context: LegalRequestContext,
  ): Promise<SafetyCheck[]> {
    const checks: SafetyCheck[] = [];

    // PII in output
    const classification = this.dataClassification.classify(output, { tenantId: context.tenantId });
    checks.push({
      checkType: 'pii_in_output',
      passed: !classification.piiDetected,
      score: classification.piiDetected ? 0.3 : 1.0,
      details: classification.piiDetected
        ? `PII types found: ${classification.piiTypes.join(', ')}`
        : undefined,
      flaggedContent: classification.piiDetected ? classification.piiTypes.join(', ') : undefined,
    });

    // Unauthorized legal advice
    const adviceMatches = UNAUTHORIZED_ADVICE_PATTERNS.filter((p) => p.test(output));
    const hasAttorneyCtx = context.hasAttorneyContext ?? false;
    checks.push({
      checkType: 'legal_unauthorized_advice',
      passed: adviceMatches.length === 0 || hasAttorneyCtx,
      score: adviceMatches.length === 0 || hasAttorneyCtx ? 1.0 : Math.max(0.1, 1 - adviceMatches.length * 0.25),
      details: adviceMatches.length > 0 && !hasAttorneyCtx
        ? `${adviceMatches.length} directive(s) without attorney context`
        : undefined,
    });

    // Factual claim without citation
    const citationMatches = CITATION_CLAIM_PATTERNS.filter((p) => p.test(output));
    const hasCitation = /\[\d+\]|\(\d{4}\)|see\s+also|cf\.|ibid/i.test(output);
    const citationRisk = citationMatches.length > 0 && !hasCitation;
    checks.push({
      checkType: 'factual_claim_without_citation',
      passed: !citationRisk,
      score: citationRisk ? 0.5 : 1.0,
      details: citationRisk ? `${citationMatches.length} legal claim(s) without citation` : undefined,
    });

    // Overconfident legal conclusion
    const overconfidentMatches = OVERCONFIDENT_PATTERNS.filter((p) => p.test(output));
    checks.push({
      checkType: 'overconfident_legal_conclusion',
      passed: overconfidentMatches.length === 0,
      score: overconfidentMatches.length === 0 ? 1.0 : Math.max(0.2, 1 - overconfidentMatches.length * 0.2),
      details: overconfidentMatches.length > 0
        ? `${overconfidentMatches.length} overconfident statement(s) detected`
        : undefined,
    });

    return checks;
  }

  async recordSafetyLog(
    workflowId: string | undefined,
    tenantId: string | undefined,
    input: string,
    output: string,
    checks: SafetyCheck[],
    context?: Partial<LegalRequestContext>,
  ): Promise<AISafetyLog> {
    const overallPassed = checks.every((c) => c.passed);
    const riskScore = checks.length > 0
      ? checks.reduce((sum, c) => sum + (1 - c.score), 0) / checks.length
      : 0;
    const blockedOutput = riskScore >= RISK_THRESHOLDS.high;
    const flaggedContent = checks
      .filter((c) => c.flaggedContent)
      .map((c) => c.flaggedContent)
      .join('; ');

    return this.prisma.aISafetyLog.create({
      data: {
        tenantId,
        userId: context?.userId,
        workflowId,
        feature: context?.feature ?? 'unknown',
        safetyChecks: checks as any,
        overallPassed,
        blockedOutput,
        riskScore,
        flaggedContent: flaggedContent || null,
      },
    });
  }

  shouldBlock(checks: SafetyCheck[], riskLevel: RiskLevel): boolean {
    const threshold = RISK_THRESHOLDS[riskLevel];
    const avgRisk = checks.length > 0
      ? checks.reduce((sum, c) => sum + (1 - c.score), 0) / checks.length
      : 0;
    const hasCriticalFail = checks.some(
      (c) => !c.passed && (c.checkType === 'prompt_injection_in_input' || c.score < 0.2),
    );
    return hasCriticalFail || avgRisk >= threshold;
  }

  async getFlags(
    tenantId: string,
    filters?: {
      feature?: string;
      onlyFailed?: boolean;
      onlyBlocked?: boolean;
      limit?: number;
    },
  ): Promise<AISafetyLog[]> {
    return this.prisma.aISafetyLog.findMany({
      where: {
        tenantId,
        ...(filters?.feature ? { feature: filters.feature } : {}),
        ...(filters?.onlyFailed ? { overallPassed: false } : {}),
        ...(filters?.onlyBlocked ? { blockedOutput: true } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit ?? 100,
    });
  }

  async markReviewed(id: string, reviewedBy: string, note?: string): Promise<AISafetyLog> {
    return this.prisma.aISafetyLog.update({
      where: { id },
      data: { reviewedBy, reviewNote: note },
    });
  }
}
