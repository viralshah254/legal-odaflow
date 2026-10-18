import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AccessModule } from '@/access/access.module';
import { AutomationsModule } from '@/automations/automations.module';
import { AnonymizationModule } from '@/anonymization/anonymization.module';
import { GovernanceModule } from '@/governance/governance.module';
import { JobsModule } from '@/jobs/jobs.module';
import { MarketplaceModule } from '@/marketplace/marketplace.module';
import { MatterAutonomyModule } from '@/matter-autonomy/matter-autonomy.module';
import { MatterAnalysisSnapshotModule } from '@/matter-analysis-snapshot/matter-analysis-snapshot.module';
import { OcrModule } from '@/ocr/ocr.module';
import { TrainingConsentModule } from '@/training-consent/training-consent.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { LocalUploadTokenService } from './local-upload-token.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'change_me_dev_secret'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
    AccessModule,
    GovernanceModule,
    JobsModule,
    OcrModule,
    AutomationsModule,
    TrainingConsentModule,
    AnonymizationModule,
    MatterAutonomyModule,
    MatterAnalysisSnapshotModule,
    forwardRef(() => MarketplaceModule),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, LocalUploadTokenService],
  exports: [DocumentsService, LocalUploadTokenService],
})
export class DocumentsModule {}
