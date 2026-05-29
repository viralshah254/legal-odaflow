import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * Ensures tenant document storage uses the tenant's configured data region.
 */
@Injectable()
export class StorageRegionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async assertTenantStorageRegion(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { dataRegion: true, primaryCountry: true },
    });

    if (!tenant) {
      throw new ForbiddenException('Tenant not found');
    }

    const requiredRegion = tenant.dataRegion?.trim();
    if (!requiredRegion) {
      return;
    }

    const activeRegion = this.configService
      .get<string>('S3_REGION', 'us-east-1')
      .trim();

    if (requiredRegion !== activeRegion) {
      throw new ForbiddenException(
        `Document storage region mismatch: tenant requires ${requiredRegion}, active storage is ${activeRegion}`,
      );
    }
  }
}
