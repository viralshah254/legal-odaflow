import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IntegrationPlatformService } from './integration-platform.service';

@Controller('integrations')
export class IntegrationPlatformController {
  constructor(private readonly svc: IntegrationPlatformService) {}

  @Get('connectors')
  listConnectors() {
    return this.svc.listConnectors();
  }

  @Get('connections')
  getConnections(
    @Query('tenantId') tenantId: string,
    @Query('userId') userId: string,
  ) {
    return this.svc.getConnections(tenantId, userId);
  }

  @Post('connections/:connectorId/connect')
  connect(
    @Param('connectorId') connectorId: string,
    @Body() body: { tenantId: string; userId: string; code: string; redirectUri: string },
  ) {
    return this.svc.connectOAuth(
      body.tenantId,
      body.userId,
      connectorId,
      body.code,
      body.redirectUri,
    );
  }

  @Delete('connections/:connectorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(
    @Param('connectorId') connectorId: string,
    @Query('tenantId') tenantId: string,
    @Query('userId') userId: string,
  ) {
    return this.svc.revokeConnection(tenantId, userId, connectorId);
  }

  @Post('connections/:id/import')
  importFiles(
    @Param('id') id: string,
    @Body() body: { tenantId: string; fileIds: string[] },
  ) {
    return this.svc.importFromDrive(id, body.tenantId, body.fileIds);
  }

  @Post('connections/:id/sync-calendar')
  @HttpCode(HttpStatus.NO_CONTENT)
  syncCalendar(
    @Param('id') id: string,
    @Body() body: { tenantId: string; matterId: string },
  ) {
    return this.svc.syncCalendar(id, body.tenantId, body.matterId);
  }
}
