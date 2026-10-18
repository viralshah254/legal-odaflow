import { Global, Module } from '@nestjs/common';
import { CountryComplianceModule } from '@/country-compliance/country-compliance.module';
import { S3UploadService } from './s3-upload.service';
import { StorageRegionService } from './storage-region.service';

@Global()
@Module({
  imports: [CountryComplianceModule],
  providers: [StorageRegionService, S3UploadService],
  exports: [StorageRegionService, S3UploadService],
})
export class StorageModule {}
