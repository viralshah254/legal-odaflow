import { Module } from '@nestjs/common';
import { AccessModule } from '@/access/access.module';
import { SmartWorkspaceController } from './smart-workspace.controller';
import { SmartWorkspaceService } from './smart-workspace.service';
import { WorkspaceSearchService } from './workspace-search.service';
import { WorkspaceExportService } from './workspace-export.service';

@Module({
  imports: [AccessModule],
  controllers: [SmartWorkspaceController],
  providers: [SmartWorkspaceService, WorkspaceSearchService, WorkspaceExportService],
  exports: [SmartWorkspaceService],
})
export class SmartWorkspaceModule {}
