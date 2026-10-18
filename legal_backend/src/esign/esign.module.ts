import { Module } from '@nestjs/common';
import { ESignController } from './esign.controller';
import { ESignService } from './esign.service';

@Module({
  controllers: [ESignController],
  providers: [ESignService],
  exports: [ESignService],
})
export class ESignModule {}
