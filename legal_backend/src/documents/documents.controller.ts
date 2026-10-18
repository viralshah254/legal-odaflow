import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { DocumentsService } from './documents.service';
import {
  CreateConsumerUploadUrlDto,
  CreateUploadUrlDto,
  UploadConsumerFileDto,
  UploadConsumerDocumentDto,
  UploadDocumentMetadataDto,
} from './dto/upload-document.dto';
import {
  CreateDocumentFolderDto as CreateFolderDto,
  CreateDocumentVersionDto as CreateVersionDto,
  UpdateDocumentFolderDto as UpdateFolderDto,
} from './dto/document-management.dto';
import { UpdateDocumentMetadataDto } from './dto/update-document.dto';

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

  @Post('consumer/upload-url')
  createConsumerUploadUrl(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateConsumerUploadUrlDto,
  ) {
    return this.documentsService.createConsumerUploadUrl(
      user.id,
      dto.consumerCaseId,
      dto.fileName,
    );
  }

  @Post('consumer/upload-file')
  @UseInterceptors(FileInterceptor('file'))
  uploadConsumerFile(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadConsumerFileDto,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    return this.documentsService.uploadConsumerFileFromBuffer(
      user.id,
      dto.consumerCaseId,
      file,
      dto.documentType,
    );
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
    @Query('clientId') clientId?: string,
    @Query('scope') scope?: 'all' | 'general' | 'client',
    @Query('folderId') folderId?: string,
    @Query('search') search?: string,
    @Query('status') status?: 'ACTIVE' | 'ARCHIVED' | 'all',
  ) {
    return this.documentsService.listTenantDocuments(
      tenantId,
      matterId,
      folderId,
      search,
      clientId,
      scope,
      status,
    );
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

  @Post(':documentId/versions/:versionId/restore')
  @UseGuards(TenantGuard)
  restoreDocumentVersion(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.documentsService.restoreDocumentVersion(
      tenantId,
      documentId,
      versionId,
      user.id,
      user.tenantRole,
    );
  }

  @Get(':documentId/share-link')
  @UseGuards(TenantGuard)
  generateShareLink(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.generateShareLink(
      tenantId,
      documentId,
      user.id,
      user.tenantRole,
    );
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

  @Patch(':documentId')
  @UseGuards(TenantGuard)
  updateTenantDocument(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
    @Param('documentId') documentId: string,
    @Body() dto: UpdateDocumentMetadataDto,
  ) {
    return this.documentsService.updateTenantDocument(
      tenantId,
      documentId,
      user.id,
      user.tenantRole,
      dto,
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

  /**
   * POST /documents/:documentId/trigger-ocr
   * Re-enqueues OCR for a document that has no extractedText (e.g. scanned PDFs).
   * Used by the OcrBanner component in the Smart Research Workspace.
   */
  @Post(':documentId/trigger-ocr')
  @UseGuards(TenantGuard)
  async triggerOcr(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.triggerOcrForDocument(tenantId, documentId, user.id);
  }
}
