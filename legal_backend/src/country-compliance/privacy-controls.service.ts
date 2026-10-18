import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  evaluatePrivacyAssessment,
  normalizePrivacyAssessment,
  PrivacyAssessment,
} from './privacy-controls';

@Injectable()
export class PrivacyControlsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTenantAssessment(tenantId: string) {
    const [tenant, profile] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { primaryCountry: true, dataRegion: true },
      }),
      this.prisma.firmProfile.findUnique({
        where: { tenantId },
        select: { settings: true },
      }),
    ]);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const root =
      profile?.settings &&
      typeof profile.settings === 'object' &&
      !Array.isArray(profile.settings)
        ? (profile.settings as Record<string, unknown>)
        : {};
    const governance =
      root.governance &&
      typeof root.governance === 'object' &&
      !Array.isArray(root.governance)
        ? (root.governance as Record<string, unknown>)
        : root;
    const assessment = normalizePrivacyAssessment(governance.privacyAssessment);
    const policy = await this.prisma.countryCompliancePolicy.findUnique({
      where: { countryCode: tenant.primaryCountry.toUpperCase() },
      select: { allowTrainingOptIn: true },
    });
    const status = evaluatePrivacyAssessment({
      countryCode: tenant.primaryCountry,
      dataRegion: tenant.dataRegion,
      assessment,
      allowTrainingOptIn: policy?.allowTrainingOptIn,
    });

    return { assessment, status };
  }

  async assertTenantProcessingAllowed(
    tenantId: string,
    flow: 'document_storage' | 'training' | 'integration',
  ): Promise<void> {
    const { status } = await this.getTenantAssessment(tenantId);
    const allowed =
      flow === 'training'
        ? status.trainingAllowed
        : flow === 'integration'
          ? status.integrationsAllowed
          : status.processingAllowed;
    if (!allowed) {
      throw new ForbiddenException({
        code: 'PRIVACY_ASSESSMENT_REQUIRED',
        flow,
        countryCode: status.countryCode,
        policyVersion: status.policyVersion,
        blockers: status.blockers,
        message:
          'Complete the privacy assessment and resolve all residency, transfer, and sensitive-data requirements before continuing.',
      });
    }
  }

  stampAssessment(
    assessment: PrivacyAssessment,
    actorUserId?: string,
  ): PrivacyAssessment {
    return {
      ...normalizePrivacyAssessment(assessment),
      assessedAt: new Date().toISOString(),
      ...(actorUserId ? { assessedBy: actorUserId } : {}),
    };
  }
}
