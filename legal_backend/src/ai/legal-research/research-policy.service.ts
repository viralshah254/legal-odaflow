import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ResearchPolicy {
  /**
   * Whether the ReAct agent may be escalated to fill evidence gaps.
   * False for QUICK mode or when agent budget is exhausted.
   */
  agentEscalationAllowed: boolean;
  /** How many agent calls remain in this request's budget. */
  remainingAgentCalls: number;
  /** Whether the tenant / plan allows ULTRA-tier research. */
  planAllowsUltra: boolean;
}

export interface ResearchPolicyInput {
  researchMode?: string;
  tenantId?: string;
  userId?: string;
  planTier?: string;
}

/**
 * Derives the research policy from request context.
 * Evidence escalation depends on legal need, mode, and budget — NOT on tenantId existence.
 *
 * Wave 1 stub: all non-QUICK authenticated calls allow agent escalation.
 * Wave 2 will add per-tenant credit-based budgets.
 */
@Injectable()
export class ResearchPolicyService {
  constructor(private readonly configService: ConfigService) {}

  get(input: ResearchPolicyInput): ResearchPolicy {
    const maxRounds = this.configService.get<number>('LEGAL_RESEARCH_MAX_AGENT_ROUNDS', 2);
    const isQuickMode = input.researchMode === 'FAST' || input.researchMode === 'QUICK';

    // Agent escalation requires at minimum a non-QUICK mode and some user identity.
    const agentEscalationAllowed =
      !isQuickMode && (!!input.tenantId || !!input.userId);

    return {
      agentEscalationAllowed,
      remainingAgentCalls: agentEscalationAllowed ? maxRounds : 0,
      planAllowsUltra: input.planTier === 'firm_pro_plus',
    };
  }
}
