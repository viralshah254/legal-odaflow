import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { DocumentsService } from './documents.service';
import {
  CreateUploadUrlDto,
  UploadConsumerDocumentDto,
  UploadDocumentMetadataDto,
} from './dto/upload-document.dto';
import {
  CreateDocumentFolderDto as CreateFolderDto,
  CreateDocumentVersionDto as CreateVersionDto,
  UpdateDocumentFolderDto as UpdateFolderDto,
} from './dto/document-management.dto';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('consumer/upload')
  uploadConsumerDocument(
    @CurrentUser() user: RequestUser,
    @Body() dto: UploadConsumerDocumentDto,
  ) {
    return this.documentsService.uploadConsumerDocument(user.id, dto);
  }

  @Post('upload')
  @UseGuards(TenantGuard)
  uploadTenantDocument(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
    @Body() dto: UploadDocumentMetadataDto,
  ) {
    return this.documentsService.uploadTenantDocument(tenantId, user.id, dto);
  }

  @Post('upload-url')
  @UseGuards(TenantGuard)
  createUploadUrl(
    @TenantId() tenantId: string,
    @Body() dto: CreateUploadUrlDto,
  ) {
    return this.documentsService.createUploadUrl(tenantId, dto);
  }

  @Get('consumer/:caseId')
  listConsumerDocuments(
    @CurrentUser() user: RequestUser,
    @Param('caseId') caseId: string,
  ) {
    return this.documentsService.listConsumerDocuments(user.id, caseId);
  }

  @Get('jobs/:jobId')
  getDocumentJob(
    @CurrentUser() user: RequestUser,
    @Param('jobId') jobId: string,
  ) {
    return this.documentsService.getDocumentJob(user.id, jobId);
  }

  @Get()
  @UseGuards(TenantGuard)
  listTenantDocuments(
    @TenantId() tenantId: string,
    @Query('matterId') matterId?: string,
    @Query('folderId') folderId?: string,
    @Query('search') search?: string,
  ) {
    return this.documentsService.listTenantDocuments(tenantId, matterId, folderId, search);
  }

  @Get('folders')
  @UseGuards(TenantGuard)
  listFolders(
    @TenantId() tenantId: string,
    @Query('matterId') matterId?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.documentsService.listFolders(tenantId, matterId, clientId);
  }

  @Post('folders')
  @UseGuards(TenantGuard)
  createFolder(@TenantId() tenantId: string, @Body() dto: CreateFolderDto) {
    return this.documentsService.createFolder(tenantId, dto);
  }

  @Patch('folders/:folderId')
  @UseGuards(TenantGuard)
  updateFolder(
    @TenantId() tenantId: string,
    @Param('folderId') folderId: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.documentsService.updateFolder(tenantId, folderId, dto);
  }

  @Delete('folders/:folderId')
  @UseGuards(TenantGuard)
  deleteFolder(@TenantId() tenantId: string, @Param('folderId') folderId: string) {
    return this.documentsService.deleteFolder(tenantId, folderId);
  }

  @Get(':documentId/versions')
  @UseGuards(TenantGuard)
  listDocumentVersions(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.listDocumentVersions(
      tenantId,
      documentId,
      user.id,
      user.tenantRole,
    );
  }

  @Post(':documentId/versions')
  @UseGuards(TenantGuard)
  createDocumentVersion(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
    @Param('documentId') documentId: string,
    @Body() dto: CreateVersionDto,
  ) {
    return this.documentsService.createDocumentVersion(tenantId, documentId, user.id, dto);
  }

  @Get(':documentId/download')
  @UseGuards(TenantGuard)
  getDocumentDownload(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.getDocumentDownloadUrl(
      tenantId,
      documentId,
      user.id,
      user.tenantRole,
    );
  }

  @Get(':documentId')
  @UseGuards(TenantGuard)
  getTenantDocument(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.getTenantDocument(
      tenantId,
      documentId,
      user.id,
      user.tenantRole,
    );
  }
}
