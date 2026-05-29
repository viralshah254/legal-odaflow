import {
  ForbiddenException,
  Inject,
  forwardRef,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AnonymizationService } from '@/anonymization/anonymization.service';
import { AutomationEngineService } from '@/automations/automation-engine.service';
import { PrismaService } from '@/prisma/prisma.service';
import { StorageRegionService } from '@/storage/storage-region.service';
import { JobsService } from '@/jobs/jobs.service';
import { IntakeAnalysisService } from '@/marketplace/intake-analysis.service';
import { DocumentTrainingPermissionService } from '@/training-consent/document-training-permission.service';
import {
  CreateUploadUrlDto,
  UploadConsumerDocumentDto,
  UploadDocumentMetadataDto,
} from './dto/upload-document.dto';
import {
  CreateDocumentFolderDto,
  CreateDocumentVersionDto,
  UpdateDocumentFolderDto,
} from './dto/document-management.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly configService: ConfigService,
    private readonly documentTrainingPermission: DocumentTrainingPermissionService,
    private readonly anonymizationService: AnonymizationService,
    @Inject(forwardRef(() => AutomationEngineService))
    private readonly automationEngine: AutomationEngineService,
    @Inject(forwardRef(() => IntakeAnalysisService))
    private readonly intakeAnalysis: IntakeAnalysisService,
    private readonly storageRegion: StorageRegionService,
  ) {}

  async createUploadUrl(tenantId: string, dto: CreateUploadUrlDto) {
    await this.storageRegion.assertTenantStorageRegion(tenantId);
    const provider = this.configService.get<string>('S3_PROVIDER', 'local');
    const bucket = this.configService.get<string>('S3_BUCKET', '');
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');
    const cdnUrl = this.configService.get<string>('S3_PUBLIC_CDN_URL', '').trim();
    const apiUrl = this.configService
      .get<string>('API_URL', 'http://localhost:4000')
      .replace(/\/$/, '');

    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const safeFileName = this.sanitizeFileName(dto.fileName);
    const safeScope = this.sanitizeScope(dto.scope ?? 'documents');
    const key = `${tenantId}/${safeScope}/${datePrefix}/${randomUUID()}-${safeFileName}`;

    if (provider === 'local') {
      const localBaseUrl = cdnUrl || `${apiUrl}/uploads`;
      const fileUrl = `${localBaseUrl}/${key}`;
      return { uploadUrl: fileUrl, fileUrl, key };
    }

    const fileUrl = cdnUrl
      ? `${cdnUrl}/${key}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return {
      uploadUrl: fileUrl,
      fileUrl,
      key,
    };
  }

  async uploadTenantDocument(
    tenantId: string,
    userId: string,
    dto: UploadDocumentMetadataDto,
  ) {
    if (dto.matterId) {
      const matter = await this.prisma.matter.findFirst({
        where: { id: dto.matterId, tenantId },
      });

      if (!matter) {
        throw new NotFoundException('Matter not found for tenant');
      }
    }

    const document = await this.prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          tenantId,
          matterId: dto.matterId,
          folderId: dto.folderId,
          fileName: dto.fileName,
          fileUrl: dto.fileUrl,
          mimeType: dto.mimeType,
          uploadedById: userId,
          version: 1,
        },
      });
      await tx.documentVersion.create({
        data: {
          tenantId,
          documentId: created.id,
          version: 1,
          fileName: dto.fileName,
          fileUrl: dto.fileUrl,
          uploadedById: userId,
        },
      });
      return created;
    });

    await this.jobsService.enqueueOcrJob({
      documentId: document.id,
      tenantId,
      userId,
      fileUrl: dto.fileUrl,
      scope: 'TENANT',
    });

    const permission = await this.documentTrainingPermission.ensureForDocumentUpload({
      documentId: document.id,
      userId,
      tenantId,
    });

    if (permission.allowedForTraining) {
      await this.anonymizationService.createAndEnqueue({
        sourceType: 'DOCUMENT',
        sourceId: document.id,
      });
    }

    await this.automationEngine.dispatch(tenantId, 'document.uploaded', {
      documentId: document.id,
      fileName: document.fileName,
      matterId: document.matterId,
      userId,
    });

    return {
      document,
      ocrJob: {
        status: 'QUEUED',
        message: 'OCR processing queued',
      },
    };
  }

  async uploadConsumerDocument(userId: string, dto: UploadConsumerDocumentDto) {
    const consumerCase = await this.prisma.consumerCase.findFirst({
      where: { id: dto.consumerCaseId, userId },
    });

    if (!consumerCase) {
      throw new NotFoundException('Consumer case not found');
    }

    const document = await this.prisma.consumerDocument.create({
      data: {
        userId,
        consumerCaseId: dto.consumerCaseId,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        mimeType: dto.mimeType,
        documentType: dto.documentType,
        fileSizeBytes: dto.fileSizeBytes,
        ocrStatus: 'PENDING',
      },
    });

    await this.jobsService.enqueueOcrJob({
      documentId: document.id,
      tenantId: undefined,
      userId,
      fileUrl: dto.fileUrl,
      scope: 'CONSUMER',
    });

    void this.intakeAnalysis
      .triggerDocRefresh(dto.consumerCaseId, userId)
      .catch(() => undefined);

    return {
      document,
      ocrJob: {
        status: 'QUEUED',
        message: 'OCR processing queued',
      },
    };
  }

  async listTenantDocuments(
    tenantId: string,
    matterId?: string,
    folderId?: string,
    search?: string,
  ) {
    return this.prisma.document.findMany({
      where: {
        tenantId,
        matterId: matterId || undefined,
        folderId: folderId || undefined,
        fileName: search ? { contains: search, mode: 'insensitive' } : undefined,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTenantDocument(
    tenantId: string,
    documentId: string,
    userId?: string,
    role?: string,
  ) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (userId) {
      await this.assertDocumentAccess(tenantId, document, userId, role, 'READ');
    }

    return document;
  }

  async getDocumentDownloadUrl(
    tenantId: string,
    documentId: string,
    userId: string,
    role?: string,
  ) {
    const document = await this.getTenantDocument(tenantId, documentId, userId, role);

    if (!document.fileUrl) {
      throw new NotFoundException('Document file not available');
    }

    return {
      documentId: document.id,
      fileName: document.fileName,
      fileUrl: document.fileUrl,
      mimeType: document.mimeType,
      version: document.version ?? 1,
    };
  }

  async listConsumerDocuments(userId: string, caseId: string) {
    const consumerCase = await this.prisma.consumerCase.findFirst({
      where: { id: caseId, userId },
    });

    if (!consumerCase) {
      throw new NotFoundException('Consumer case not found');
    }

    return this.prisma.consumerDocument.findMany({
      where: { consumerCaseId: caseId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDocumentJob(userId: string, jobId: string) {
    const job = await this.prisma.agentJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.userId && job.userId !== userId) {
      throw new ForbiddenException('Job access denied');
    }

    return job;
  }

  async listFolders(tenantId: string, matterId?: string, clientId?: string) {
    return this.prisma.documentFolder.findMany({
      where: {
        tenantId,
        matterId: matterId || undefined,
        clientId: clientId || undefined,
      },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    });
  }

  async createFolder(tenantId: string, dto: CreateDocumentFolderDto) {
    if (dto.matterId) {
      await this.ensureMatter(tenantId, dto.matterId);
    }
    if (dto.parentId) {
      await this.ensureFolder(tenantId, dto.parentId);
    }

    return this.prisma.documentFolder.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        parentId: dto.parentId,
        clientId: dto.clientId,
        matterId: dto.matterId,
      },
    });
  }

  async updateFolder(tenantId: string, folderId: string, dto: UpdateDocumentFolderDto) {
    await this.ensureFolder(tenantId, folderId);
    if (dto.parentId) {
      await this.ensureFolder(tenantId, dto.parentId);
    }

    return this.prisma.documentFolder.update({
      where: { id: folderId },
      data: {
        name: dto.name?.trim(),
        parentId: dto.parentId,
      },
    });
  }

  async deleteFolder(tenantId: string, folderId: string) {
    await this.ensureFolder(tenantId, folderId);
    await this.prisma.documentFolder.delete({
      where: { id: folderId },
    });
    return { success: true };
  }

  async listDocumentVersions(
    tenantId: string,
    documentId: string,
    userId?: string,
    role?: string,
  ) {
    await this.getTenantDocument(tenantId, documentId, userId, role);
    return this.prisma.documentVersion.findMany({
      where: { tenantId, documentId },
      orderBy: { version: 'desc' },
    });
  }

  async createDocumentVersion(
    tenantId: string,
    documentId: string,
    userId: string,
    dto: CreateDocumentVersionDto,
  ) {
    const document = await this.getTenantDocument(tenantId, documentId);
    const nextVersion = (document.version ?? 1) + 1;

    const [version] = await this.prisma.$transaction([
      this.prisma.documentVersion.create({
        data: {
          tenantId,
          documentId,
          version: nextVersion,
          fileName: dto.fileName,
          fileUrl: dto.fileUrl,
          uploadedById: userId,
        },
      }),
      this.prisma.document.update({
        where: { id: documentId },
        data: {
          fileName: dto.fileName,
          fileUrl: dto.fileUrl,
          uploadedById: userId,
          version: nextVersion,
        },
      }),
    ]);

    return version;
  }

  private sanitizeFileName(fileName: string) {
    return fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  private sanitizeScope(scope: string) {
    return scope.trim().replace(/[^a-zA-Z0-9/_-]/g, '_');
  }

  private async ensureMatter(tenantId: string, matterId: string) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });
    if (!matter) {
      throw new NotFoundException('Matter not found for tenant');
    }
  }

  private async ensureFolder(tenantId: string, folderId: string) {
    const folder = await this.prisma.documentFolder.findFirst({
      where: { id: folderId, tenantId },
    });
    if (!folder) {
      throw new NotFoundException('Folder not found for tenant');
    }
  }

  private async assertDocumentAccess(
    tenantId: string,
    document: { id: string; folderId: string | null; uploadedById: string | null },
    userId: string,
    role: string | undefined,
    requiredLevel: 'READ' | 'WRITE',
  ) {
    if (document.uploadedById === userId) {
      return;
    }

    const rules = await this.prisma.documentAccessRule.findMany({
      where: {
        tenantId,
        OR: [{ documentId: document.id }, { folderId: document.folderId ?? undefined }],
      },
    });

    if (rules.length === 0) {
      return;
    }

    const hasAccess = rules.some((rule) => {
      const level = rule.accessLevel.toUpperCase();
      if (requiredLevel === 'WRITE' && level !== 'WRITE' && level !== 'ADMIN') {
        return false;
      }
      if (rule.userId && rule.userId === userId) {
        return true;
      }
      if (rule.role && role && rule.role === role) {
        return true;
      }
      return false;
    });

    if (!hasAccess) {
      throw new ForbiddenException('Document access denied by access rule');
    }
  }
}
