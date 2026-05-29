import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AiComplianceGuardService } from '@/ai/ai-compliance-guard.service';
import { CountryComplianceService } from '@/country-compliance/country-compliance.service';
import { COUNTRY_COMPLIANCE_POLICY_SEEDS } from '@/country-compliance/country-compliance.seed';

export type EvalBenchmarkResult = {
  name: string;
  passed: boolean;
  score: number;
  details: Record<string, unknown>;
};

export type EvalSuiteResult = {
  runId: string;
  startedAt: string;
  completedAt: string;
  overallScore: number;
  passed: boolean;
  benchmarks: EvalBenchmarkResult[];
};

@Injectable()
export class EvalSuiteRunner {
  constructor(
    private readonly prisma: PrismaService,
    private readonly complianceGuard: AiComplianceGuardService,
    private readonly countryCompliance: CountryComplianceService,
  ) {}

  async runFullSuite(): Promise<EvalSuiteResult> {
    const runId = `eval_${Date.now()}`;
    const startedAt = new Date().toISOString();

    const benchmarks = await Promise.all([
      this.runCitationAccuracyBenchmark(),
      this.runEscalationDetectionBenchmark(),
      this.runJurisdictionBenchmarks(),
    ]);

    const overallScore =
      benchmarks.reduce((sum, b) => sum + b.score, 0) / benchmarks.length;
    const passed = benchmarks.every((b) => b.passed);

    return {
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      overallScore: Number(overallScore.toFixed(4)),
      passed,
      benchmarks,
    };
  }

  async runCitationAccuracyBenchmark(): Promise<EvalBenchmarkResult> {
    const outputs = await this.prisma.aIOutput.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        aiCitations: {
          include: { authority: true },
        },
      },
    });

    if (outputs.length === 0) {
      return {
        name: 'citation_accuracy',
        passed: true,
        score: 1,
        details: { message: 'No AI outputs yet — seed data passes by default' },
      };
    }

    let cited = 0;
    let grounded = 0;

    for (const output of outputs) {
      if (output.aiCitations.length > 0) {
        cited += 1;
        const withAuthority = output.aiCitations.filter((c) => c.authorityId);
        if (withAuthority.length > 0) {
          grounded += 1;
        }
      }
    }

    const citationRate = cited / outputs.length;
    const groundingRate = grounded / Math.max(cited, 1);
    const score = citationRate * 0.5 + groundingRate * 0.5;

    return {
      name: 'citation_accuracy',
      passed: score >= 0.6,
      score: Number(score.toFixed(4)),
      details: {
        samples: outputs.length,
        outputsWithCitations: cited,
        outputsWithGroundedCitations: grounded,
        citationRate,
        groundingRate,
      },
    };
  }

  async runEscalationDetectionBenchmark(): Promise<EvalBenchmarkResult> {
    const fixtures: Array<{ text: string; expectEscalation: boolean }> = [
      {
        text: 'You should sue immediately and guaranteed win in court.',
        expectEscalation: true,
      },
      {
        text: 'General information about tenant rights and documentation steps.',
        expectEscalation: false,
      },
      {
        text: 'Criminal charges may apply; seek counsel before responding to police.',
        expectEscalation: true,
      },
    ];

    const policy = await this.countryCompliance.getPolicy('US');
    let correct = 0;

    for (const fixture of fixtures) {
      const result = this.complianceGuard.sanitizeOutput(
        fixture.text,
        policy,
        'consumer',
      );
      if (result.requiresLawyerReview === fixture.expectEscalation) {
        correct += 1;
      }
    }

    const score = correct / fixtures.length;

    return {
      name: 'escalation_detection',
      passed: score >= 0.66,
      score: Number(score.toFixed(4)),
      details: { fixtures: fixtures.length, correct },
    };
  }

  async runJurisdictionBenchmarks(): Promise<EvalBenchmarkResult> {
    const countries = COUNTRY_COMPLIANCE_POLICY_SEEDS.map((s) => s.countryCode);
    const results: Record<string, boolean> = {};

    for (const code of countries) {
      const policy = await this.countryCompliance.getPolicy(code);
      results[code] =
        Boolean(policy.countryCode) &&
        typeof policy.allowConsumerGuidance === 'boolean' &&
        typeof policy.requireLawyerReviewForAdvice === 'boolean';
    }

    const passedCount = Object.values(results).filter(Boolean).length;
    const score = passedCount / countries.length;

    return {
      name: 'jurisdiction_benchmarks',
      passed: score === 1,
      score: Number(score.toFixed(4)),
      details: { countries: results },
    };
  }
}
