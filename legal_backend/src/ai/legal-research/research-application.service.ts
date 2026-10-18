import { Injectable } from '@nestjs/common';
import { AiGatewayService } from '@/ai/ai-gateway.service';

/**
 * U15 — Canonical research entry (extracted facade over the rich gateway path).
 * Platform workflow adapters should delegate here instead of weaker local synthesis.
 */
@Injectable()
export class ResearchApplicationService {
  constructor(private readonly gateway: AiGatewayService) {}

  runLawyerResearch(params: Parameters<AiGatewayService['runLawyerLegalResearch']>[0]) {
    return this.gateway.runLawyerLegalResearch(params);
  }
}
