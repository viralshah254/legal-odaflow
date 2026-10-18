import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/prisma/prisma.module';
import { DataClassificationService } from './data-classification.service';
import { PromptInjectionGuard } from './prompt-injection.guard';
import { EthicalWallService } from './ethical-wall.service';
import { EthicalWallGuard } from './ethical-wall.guard';
import { LegalHoldService } from './legal-hold.service';
import { RetentionPolicyService } from './retention-policy.service';
import { SecurityMonitorService } from './security-monitor.service';
import { ConflictsEnhancedService } from './conflicts-enhanced.service';
import { SecurityController } from './security.controller';
import { LoggerService } from '@/common/observability/logger.service';
import { MalwareScanService } from './malware-scan.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [SecurityController],
  providers: [
    LoggerService,
    DataClassificationService,
    PromptInjectionGuard,
    SecurityMonitorService,
    EthicalWallService,
    EthicalWallGuard,
    LegalHoldService,
    RetentionPolicyService,
    ConflictsEnhancedService,
    MalwareScanService,
  ],
  exports: [
    DataClassificationService,
    PromptInjectionGuard,
    SecurityMonitorService,
    EthicalWallService,
    EthicalWallGuard,
    LegalHoldService,
    RetentionPolicyService,
    ConflictsEnhancedService,
    MalwareScanService,
  ],
})
export class PlatformSecurityModule {}
