import { Global, Module } from '@nestjs/common';
import { StorageRegionService } from './storage-region.service';

@Global()
@Module({
  providers: [StorageRegionService],
  exports: [StorageRegionService],
})
export class StorageModule {}
