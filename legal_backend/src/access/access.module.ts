import { Global, Module } from '@nestjs/common';
import { PlatformSecurityModule } from '@/platform/security/platform-security.module';
import { ArtifactAccessResolver } from './artifact-access.resolver';
import { MatterAccessController } from './matter-access.controller';
import { MatterAccessManagementService } from './matter-access-management.service';
import { MatterAccessService } from './matter-access.service';

@Global()
@Module({
  imports: [PlatformSecurityModule],
  controllers: [MatterAccessController],
  providers: [MatterAccessService, MatterAccessManagementService, ArtifactAccessResolver],
  exports: [MatterAccessService, MatterAccessManagementService, ArtifactAccessResolver],
})
export class AccessModule {}
