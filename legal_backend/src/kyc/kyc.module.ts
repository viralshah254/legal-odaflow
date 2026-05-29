import { Module } from '@nestjs/common';
import { KycAliasController } from './kyc-alias.controller';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  controllers: [KycController, KycAliasController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
