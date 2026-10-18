import { Module } from '@nestjs/common';
import { LegalLocationService } from './legal-location.service';

@Module({
  providers: [LegalLocationService],
  exports: [LegalLocationService],
})
export class LegalLocationModule {}
