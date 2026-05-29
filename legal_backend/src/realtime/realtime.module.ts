import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeAuthService } from './realtime-auth.service';
import { RealtimePublisherService } from './realtime-publisher.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'change_me_dev_secret'),
      }),
    }),
  ],
  providers: [RealtimeGateway, RealtimeAuthService, RealtimePublisherService],
  exports: [RealtimePublisherService],
})
export class RealtimeModule {}
