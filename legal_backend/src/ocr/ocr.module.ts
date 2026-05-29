import { Module } from '@nestjs/common';
import { AzureOcrService } from './azure-ocr.service';

@Module({
  providers: [AzureOcrService],
  exports: [AzureOcrService],
})
export class OcrModule {}
