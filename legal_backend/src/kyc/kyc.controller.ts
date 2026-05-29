import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import {
  CreateKycChecklistDto,
  CreateKycDocumentDto,
  UpdateKycChecklistDto,
  UpdateKycDocumentDto,
} from './dto/kyc.dto';
import { KycService } from './kyc.service';

@Controller('clients/:clientId/kyc')
@UseGuards(TenantGuard)
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Get('checklists')
  listChecklists(
    @TenantId() tenantId: string,
    @Param('clientId') clientId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.kycService.listChecklists(
      tenantId,
      clientId,
      user.id,
      user.tenantRole,
    );
  }

  @Post('checklists')
  createChecklist(
    @TenantId() tenantId: string,
    @Param('clientId') clientId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateKycChecklistDto,
  ) {
    return this.kycService.createChecklist(
      tenantId,
      clientId,
      user.id,
      user.tenantRole,
      dto,
    );
  }

  @Patch('checklists/:checklistId')
  updateChecklist(
    @TenantId() tenantId: string,
    @Param('clientId') clientId: string,
    @Param('checklistId') checklistId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateKycChecklistDto,
  ) {
    return this.kycService.updateChecklist(
      tenantId,
      clientId,
      checklistId,
      user.id,
      user.tenantRole,
      dto,
    );
  }

  @Get('documents')
  listDocuments(
    @TenantId() tenantId: string,
    @Param('clientId') clientId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.kycService.listDocuments(
      tenantId,
      clientId,
      user.id,
      user.tenantRole,
    );
  }

  @Post('documents')
  createDocument(
    @TenantId() tenantId: string,
    @Param('clientId') clientId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateKycDocumentDto,
  ) {
    return this.kycService.createDocument(
      tenantId,
      clientId,
      user.id,
      user.tenantRole,
      dto,
    );
  }

  @Patch('documents/:documentId')
  updateDocument(
    @TenantId() tenantId: string,
    @Param('clientId') clientId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateKycDocumentDto,
  ) {
    return this.kycService.updateDocument(
      tenantId,
      clientId,
      documentId,
      user.id,
      user.tenantRole,
      dto,
    );
  }
}
