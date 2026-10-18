import { Injectable, NotFoundException } from '@nestjs/common';

export const RESEARCH_FEATURE_FLAGS = {
  WORKSPACE_FOLLOW_ON: 'RESEARCH_WORKSPACE_FOLLOW_ON',
  MANUAL_CITATION_REVIEW: 'RESEARCH_MANUAL_CITATION_REVIEW',
  MATTER_FILING: 'RESEARCH_MATTER_FILING',
  KENYA_VERIFIED: 'RESEARCH_KENYA_VERIFIED',
} as const;

export type ResearchFeatureFlag =
  (typeof RESEARCH_FEATURE_FLAGS)[keyof typeof RESEARCH_FEATURE_FLAGS];

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  tenantIds?: string[];
  userIds?: string[];
  rolloutPercentage?: number;
  environment?: string[];
  description?: string;
  expiresAt?: Date;
}

export interface FeatureFlagContext {
  tenantId?: string;
  userId?: string;
}

const DEFAULT_FLAGS: FeatureFlag[] = [
  {
    key: 'DRAFT_ENGINE_V2',
    enabled: false,
    description: 'Enable drafting v2 engine with procedural gate and repair loop',
  },
  {
    key: 'MI_DRAFT_INTENT',
    enabled: true,
    description: 'Matter intelligence in draft intent',
  },
  {
    key: 'MI_INTAKE',
    enabled: true,
    description: 'Matter intelligence in intake',
  },
  {
    key: 'MI_COPILOT',
    enabled: true,
    description: 'Matter intelligence in copilot',
  },
  {
    key: 'MI_LEGAL_RESEARCH',
    enabled: true,
    description: 'Matter intelligence in legal research',
  },
  {
    key: 'MI_INDIA_DRAFT',
    enabled: true,
    description: 'Matter intelligence in India draft',
  },
  {
    key: 'MI_DOCUMENT_REVIEW',
    enabled: true,
    description: 'Matter intelligence in document review',
  },
  {
    key: 'MATTER_FILE_REVIEW_V2',
    enabled: true,
    description: 'Matter-wide cited file review and cross-document synthesis',
  },
  {
    key: 'MI_SHADOW_MODE',
    enabled: false,
    description: 'Run MI pipeline without affecting outputs',
  },
  {
    key: 'WORKFLOW_DURABILITY',
    enabled: true,
    description: 'Use WorkflowRun persistence for all AI workflows',
  },
  {
    key: 'KNOWLEDGE_GRAPH_V1',
    enabled: false,
    description: 'Enable knowledge graph integration',
  },
  {
    key: 'LEGAL_MEMORY_WRITE',
    enabled: false,
    description: 'Enable legal memory write path',
  },
  {
    key: 'CONTRADICTION_DETECTION',
    enabled: false,
    description: 'Enable contradiction detection service',
  },
  {
    key: 'FILING_READINESS_GATE',
    enabled: false,
    description: 'Block export until filing readiness passed',
  },
  {
    key: RESEARCH_FEATURE_FLAGS.WORKSPACE_FOLLOW_ON,
    enabled: true,
    description:
      'Stage 1: canonical research workspace, context, and revision follow-ons',
  },
  {
    key: RESEARCH_FEATURE_FLAGS.MANUAL_CITATION_REVIEW,
    enabled: true,
    description:
      'Independent role-gated lawyer decisions on unresolved citation tasks',
  },
  {
    key: RESEARCH_FEATURE_FLAGS.KENYA_VERIFIED,
    enabled: false,
    description:
      'Fail-closed Kenya Verified publication after source-policy approval',
  },
  {
    key: RESEARCH_FEATURE_FLAGS.MATTER_FILING,
    enabled: false,
    description:
      'Stage 3: client/matter filing and matter-document promotion',
  },
];

@Injectable()
export class FeatureFlagsService {
  private readonly runtimeOverrides = new Map<string, boolean>();

  isEnabled(key: string, context?: FeatureFlagContext): boolean {
    if (this.runtimeOverrides.has(key)) {
      return this.runtimeOverrides.get(key)!;
    }

    const envKey = `FEATURE_${key.toUpperCase()}`;
    const envVal = process.env[envKey];
    if (envVal !== undefined) {
      return envVal.toLowerCase() === 'true' || envVal === '1';
    }

    const flag = DEFAULT_FLAGS.find((f) => f.key === key);
    if (!flag) return false;

    if (flag.expiresAt && new Date() > flag.expiresAt) {
      return false;
    }

    if (flag.environment && flag.environment.length > 0) {
      const currentEnv = process.env.NODE_ENV ?? 'development';
      if (!flag.environment.includes(currentEnv)) {
        return false;
      }
    }

    if (flag.tenantIds && flag.tenantIds.length > 0) {
      if (!context?.tenantId || !flag.tenantIds.includes(context.tenantId)) {
        return false;
      }
    }

    if (flag.userIds && flag.userIds.length > 0) {
      if (!context?.userId || !flag.userIds.includes(context.userId)) {
        return false;
      }
    }

    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      const seed = context?.userId ?? context?.tenantId ?? key;
      const bucket = this.stableHash(seed + key) % 100;
      if (bucket >= flag.rolloutPercentage) {
        return false;
      }
    }

    return flag.enabled;
  }

  getAll(): FeatureFlag[] {
    return DEFAULT_FLAGS;
  }

  assertEnabled(
    key: ResearchFeatureFlag,
    context: Required<FeatureFlagContext>,
  ): void {
    if (this.isEnabled(key, context)) return;

    throw new NotFoundException({
      code: 'FEATURE_UNAVAILABLE',
      feature: key,
      message: 'This capability is not available for the current account',
      fallback: 'legacy_research',
    });
  }

  setOverride(
    key: string,
    enabled: boolean,
    _context?: FeatureFlagContext,
  ): void {
    this.runtimeOverrides.set(key, enabled);
  }

  private stableHash(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
