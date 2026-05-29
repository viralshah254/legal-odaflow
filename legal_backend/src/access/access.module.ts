import { Global, Module } from '@nestjs/common';
import { MatterAccessController } from './matter-access.controller';
import { MatterAccessManagementService } from './matter-access-management.service';
import { MatterAccessService } from './matter-access.service';

@Global()
@Module({
  controllers: [MatterAccessController],
  providers: [MatterAccessService, MatterAccessManagementService],
  exports: [MatterAccessService, MatterAccessManagementService],
})
export class AccessModule {}
