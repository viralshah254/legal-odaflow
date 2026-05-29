import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PaymentsModule } from '@/payments/payments.module';
import { MatterOutcomeModule } from '@/matter-outcome/matter-outcome.module';
import { PortalAuthGuard } from '@/common/guards/portal-auth.guard';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [
    PaymentsModule,
    MatterOutcomeModule,
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
  ],
  controllers: [PortalController],
  providers: [PortalService, PortalAuthGuard],
})
export class PortalModule {}
