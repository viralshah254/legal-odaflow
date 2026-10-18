import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UmbrellaLegalEvalHarness } from '@/eval/umbrella-legal-eval.harness';

export type AccuracyReportSummary = {
  generatedAt: string;
  groundedRate: number;
  substancePassRate: number;
  editionFreshness: string;
  goldenEvalScore: number;
  goldenEvalPassed: boolean;
  sampleSize: number;
};

@Injectable()
export class AccuracyReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly goldenEval: UmbrellaLegalEvalHarness,
  ) {}

  async buildAdminReport(): Promise<AccuracyReportSummary> {
    const outputs = await this.prisma.aIOutput.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        aiCitations: { include: { authority: true } },
      },
    });

    let grounded = 0;
    let withCitations = 0;
    let substancePass = 0;

    for (const output of outputs) {
      if (output.aiCitations.length > 0) {
        withCitations += 1;
        const hasAuthority = output.aiCitations.some((c) => c.authorityId);
        if (hasAuthority) grounded += 1;
        if (!output.requiresLawyerReview) substancePass += 1;
      }
    }

    const golden = await this.goldenEval.runGoldenRetrievalBenchmark();

    return {
      generatedAt: new Date().toISOString(),
      groundedRate: withCitations > 0 ? Number((grounded / withCitations).toFixed(3)) : 0,
      substancePassRate: outputs.length > 0 ? Number((substancePass / outputs.length).toFixed(3)) : 0,
      editionFreshness: 'COI_2024 + IN_2023_CODES (BNSS/BNS/BSA)',
      goldenEvalScore: golden.score,
      goldenEvalPassed: golden.passed,
      sampleSize: outputs.length,
    };
  }

  async buildPublicSummary(): Promise<Pick<AccuracyReportSummary, 'generatedAt' | 'groundedRate' | 'substancePassRate' | 'goldenEvalScore' | 'goldenEvalPassed'>> {
    const full = await this.buildAdminReport();
    return {
      generatedAt: full.generatedAt,
      groundedRate: full.groundedRate,
      substancePassRate: full.substancePassRate,
      goldenEvalScore: full.goldenEvalScore,
      goldenEvalPassed: full.goldenEvalPassed,
    };
  }
}
