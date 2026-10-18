import {
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { Prisma } from '@prisma/client';
import { AnonymizationService } from '@/anonymization/anonymization.service';
import { MatterAccessService } from '@/access/matter-access.service';
import { assertUploadBuffer } from '@/common/file-upload-validation';
import { AutomationEngineService } from '@/automations/automation-engine.service';
import { MatterAutonomyService } from '@/matter-autonomy/matter-autonomy.service';
import { MatterAnalysisSnapshotService } from '@/matter-analysis-snapshot/matter-analysis-snapshot.service';
import { PrismaService } from '@/prisma/prisma.service';
import { EncryptionService } from '@/security/encryption.service';
import { S3UploadService } from '@/storage/s3-upload.service';
import { StorageRegionService } from '@/storage/storage-region.service';
import { JobsService } from '@/jobs/jobs.service';
import { IntakeAnalysisService } from '@/marketplace/intake-analysis.service';
import { TenantRolePermissionsService } from '@/governance/tenant-role-permissions.service';
import { AzureOcrService } from '@/ocr/azure-ocr.service';
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
import { UpdateDocumentMetadataDto } from './dto/update-document.dto';
import { resolveAppUrl } from '@/common/app-url';
import { LocalUploadTokenService } from './local-upload-token.service';

const documentListInclude = {
  client: { select: { id: true, name: true, clientCode: true } },
  matter: { select: { id: true, title: true } },
} as const;

export interface ResearchContextDocument {
  id: string;
  fileName: string;
  updatedAt: Date;
  extractedText: string;
  truncated: boolean;
}

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
    private readonly azureOcr: AzureOcrService,
    private readonly s3Upload: S3UploadService,
    private readonly encryption: EncryptionService,
    private readonly localUploadTokens: LocalUploadTokenService,
    @Optional()
    private readonly matterAutonomy: MatterAutonomyService | null = null,
    @Optional()
    private readonly matterAnalysisSnapshots: MatterAnalysisSnapshotService | null = null,
    private readonly matterAccess: MatterAccessService,
    private readonly rolePermissions: TenantRolePermissionsService,
  ) {}

  private localUploadBaseUrl(): string {
    const apiUrl = this.configService
      .get<string>('API_URL', 'http://localhost:4000')
      .replace(/\/$/, '');
    const cdnUrl = this.configService.get<string>('S3_PUBLIC_CDN_URL', '').trim();
    return cdnUrl || `${apiUrl}/uploads`;
  }

  private buildLocalUploadUrls(key: string): { uploadUrl: string; fileUrl: string } {
    const baseUrl = this.localUploadBaseUrl();
    return {
      uploadUrl: this.localUploadTokens.buildSignedUrl(baseUrl, key, 'PUT'),
      fileUrl: this.localUploadTokens.buildSignedUrl(baseUrl, key, 'GET'),
    };
  }

  private uploadRoot(): string {
    return this.configService.get<string>('UPLOAD_DIR', join(process.cwd(), 'uploads'));
  }

  private async persistUploadBytes(
    key: string,
    buffer: Buffer,
    mimeType?: string,
  ): Promise<string> {
    const provider = this.configService.get<string>('S3_PROVIDER', 'local');

    if (provider === 'local') {
      const target = join(this.uploadRoot(), key);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, buffer);
      return this.buildLocalUploadUrls(key).fileUrl;
    }

    if (!this.s3Upload.isConfigured()) {
      throw new BadRequestException('Cloud storage is not configured for uploads');
    }

    return this.s3Upload.putObject(key, buffer, mimeType);
  }

  private static readonly PREVIEW_DOCUMENT_MAX_CHARS = 12_000;
  private static readonly PREVIEW_DOCUMENT_PER_FILE_CHARS = 4_000;

  async createUploadUrl(tenantId: string, dto: CreateUploadUrlDto) {
    await this.storageRegion.assertTenantStorageRegion(tenantId);
    const provider = this.configService.get<string>('S3_PROVIDER', 'local');
    const bucket = this.configService.get<string>('S3_BUCKET', '');
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');
    const cdnUrl = this.configService.get<string>('S3_PUBLIC_CDN_URL', '').trim();

    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const safeFileName = this.sanitizeFileName(dto.fileName);
    const safeScope = this.sanitizeScope(dto.scope ?? 'documents');
    const key = `${tenantId}/${safeScope}/${datePrefix}/${randomUUID()}-${safeFileName}`;

    if (provider === 'local') {
      const { uploadUrl, fileUrl } = this.buildLocalUploadUrls(key);
      return { uploadUrl, fileUrl, key };
    }

    if (!this.s3Upload.isConfigured()) {
      throw new BadRequestException('Cloud storage is not configured for uploads');
    }

    const mimeType = dto.mimeType?.trim() || 'application/octet-stream';
    const { uploadUrl, uploadHeaders } = await this.s3Upload.createPresignedPutUrl(
      key,
      mimeType,
    );
    const fileUrl = cdnUrl
      ? `${cdnUrl}/${key}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return {
      uploadUrl,
      uploadHeaders,
      fileUrl,
      key,
    };
  }

  async createConsumerUploadUrl(
    userId: string,
    consumerCaseId: string,
    fileName: string,
  ) {
    const consumerCase = await this.prisma.consumerCase.findFirst({
      where: { id: consumerCaseId, userId },
    });

    if (!consumerCase) {
      throw new NotFoundException('Consumer case not found');
    }

    const provider = this.configService.get<string>('S3_PROVIDER', 'local');
    const bucket = this.configService.get<string>('S3_BUCKET', '');
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');
    const cdnUrl = this.configService.get<string>('S3_PUBLIC_CDN_URL', '').trim();

    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const safeFileName = this.sanitizeFileName(fileName);
    const key = `consumer/${userId}/${consumerCaseId}/${datePrefix}/${randomUUID()}-${safeFileName}`;

    if (provider === 'local') {
      const { uploadUrl, fileUrl } = this.buildLocalUploadUrls(key);
      return { uploadUrl, fileUrl, key };
    }

    if (!this.s3Upload.isConfigured()) {
      throw new BadRequestException('Cloud storage is not configured for uploads');
    }

    const { uploadUrl, uploadHeaders } = await this.s3Upload.createPresignedPutUrl(
      key,
      'application/octet-stream',
    );
    const fileUrl = cdnUrl
      ? `${cdnUrl}/${key}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return {
      uploadUrl,
      uploadHeaders,
      fileUrl,
      key,
    };
  }

  /**
   * Sync-extract consumer documents for issue-checker preview (bounded wait).
   */
  async loadDocumentContextForPreview(
    userId: string,
    consumerCaseId: string,
  ): Promise<{ context: string; documentCount: number }> {
    const documents = await this.prisma.consumerDocument.findMany({
      where: { consumerCaseId, userId },
      orderBy: { createdAt: 'asc' },
    });

    if (documents.length === 0) {
      return { context: '', documentCount: 0 };
    }

    const parts: string[] = [];

    for (const doc of documents) {
      let text =
        this.encryption
          .decryptStringFromStorage(
            doc.extractedText,
            this.consumerDocumentTextAad(doc.id),
          )
          ?.trim() ?? '';

      if (!text && doc.fileUrl && doc.ocrStatus !== 'FAILED') {
        try {
          text = (await this.azureOcr.extractTextFromUrl(doc.fileUrl)).trim();
          await this.prisma.consumerDocument.update({
            where: { id: doc.id },
            data: {
              extractedText: this.encryption.encryptStringForStorage(
                text,
                this.consumerDocumentTextAad(doc.id),
              ),
              ocrStatus: text ? 'COMPLETED' : 'FAILED',
            },
          });
        } catch {
          await this.prisma.consumerDocument.update({
            where: { id: doc.id },
            data: { ocrStatus: 'FAILED' },
          });
        }
      }

      if (text) {
        parts.push(
          `### ${doc.fileName}\n${text.slice(0, DocumentsService.PREVIEW_DOCUMENT_PER_FILE_CHARS)}`,
        );
      } else {
        parts.push(
          `### ${doc.fileName}\n(No text could be extracted from this file yet.)`,
        );
      }
    }

    const context = parts.join('\n\n').slice(0, DocumentsService.PREVIEW_DOCUMENT_MAX_CHARS);
    return { context, documentCount: documents.length };
  }

  async uploadTenantDocument(
    tenantId: string,
    userId: string,
    dto: UploadDocumentMetadataDto,
  ) {
    let resolvedClientId: string | null | undefined = dto.clientId;

    if (dto.matterId) {
      const matter = await this.ensureMatter(tenantId, dto.matterId);
      if (dto.clientId !== undefined && dto.clientId !== matter.clientId) {
        throw new BadRequestException('Document client must match the selected matter');
      }
      resolvedClientId = matter.clientId;
    }

    if (!dto.matterId && resolvedClientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: resolvedClientId, tenantId },
      });

      if (!client) {
        throw new NotFoundException('Client not found for tenant');
      }
    }

    const document = await this.prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          tenantId,
          matterId: dto.matterId,
          clientId: resolvedClientId,
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

    // Autonomous matter brain — fire-and-forget refresh on document upload
    if (document.matterId) {
      if (this.matterAnalysisSnapshots) {
        void this.matterAnalysisSnapshots
          .run(tenantId, document.matterId, userId, 'incremental')
          .catch(() => {
            this.matterAutonomy?.triggerOnDocumentUpload(document.matterId!, tenantId, userId);
          });
      } else {
        this.matterAutonomy?.triggerOnDocumentUpload(document.matterId, tenantId, userId);
      }
    }

    return {
      document,
      ocrJob: {
        status: 'QUEUED',
        message: 'OCR processing queued',
      },
    };
  }

  async uploadConsumerFileFromBuffer(
    userId: string,
    consumerCaseId: string,
    file: { buffer: Buffer; originalname: string; mimetype?: string; size: number },
    documentType?: string,
  ) {
    assertUploadBuffer(file.buffer, file.originalname, 'document');
    const { key } = await this.createConsumerUploadUrl(
      userId,
      consumerCaseId,
      file.originalname,
    );
    const fileUrl = await this.persistUploadBytes(
      key,
      file.buffer,
      file.mimetype,
    );

    return this.uploadConsumerDocument(userId, {
      consumerCaseId,
      fileName: file.originalname,
      fileUrl,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      documentType: documentType || 'FIRM_INTAKE',
    });
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
    clientId?: string,
    scope?: 'all' | 'general' | 'client',
    status: 'ACTIVE' | 'ARCHIVED' | 'all' = 'ACTIVE',
  ) {
    const trimmedSearch = search?.trim();
    const effectiveScope = scope ?? (clientId ? 'client' : 'all');

    const where: Prisma.DocumentWhereInput = {
      tenantId,
      matterId: matterId || undefined,
      folderId: folderId || undefined,
      status: status === 'all' ? undefined : status,
    };

    if (effectiveScope === 'general') {
      where.clientId = null;
    } else if (effectiveScope === 'client') {
      where.clientId = clientId ?? { not: null };
    } else if (clientId) {
      where.clientId = clientId;
    }

    if (trimmedSearch) {
      where.OR = [
        { fileName: { contains: trimmedSearch, mode: 'insensitive' } },
        { extractedText: { contains: trimmedSearch, mode: 'insensitive' } },
        { documentCode: { contains: trimmedSearch, mode: 'insensitive' } },
        {
          client: {
            OR: [
              { name: { contains: trimmedSearch, mode: 'insensitive' } },
              { clientCode: { contains: trimmedSearch, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const documents = await this.prisma.document.findMany({
      where,
      include: documentListInclude,
      orderBy: { createdAt: 'desc' },
    });
    return documents.map((document) => this.decryptDocumentText(document));
  }

  async listAccessibleMatterDocumentsForResearch(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ): Promise<Array<{ id: string; fileName: string; updatedAt: Date; hasExtractedText: boolean }>> {
    await this.matterAccess.ensureMatterAccess(tenantId, userId, matterId, role);
    const documents = await this.prisma.document.findMany({
      where: { tenantId, matterId, status: 'ACTIVE' },
      select: {
        id: true,
        fileName: true,
        updatedAt: true,
        extractedText: true,
        folderId: true,
        matterId: true,
        uploadedById: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const accessible = await Promise.all(
      documents.map(async (document) => {
        try {
          await this.assertDocumentAccess(tenantId, document, userId, role, 'READ');
          return {
            id: document.id,
            fileName: document.fileName,
            updatedAt: document.updatedAt,
            hasExtractedText: Boolean(document.extractedText?.trim()),
          };
        } catch {
          return null;
        }
      }),
    );
    return accessible.filter((document): document is NonNullable<typeof document> => document !== null);
  }

  async loadSelectedMatterDocumentsForResearch(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
    selectedDocumentIds: string[],
    caps: { perItemChars: number; totalChars: number },
  ): Promise<ResearchContextDocument[]> {
    const ids = [...new Set(selectedDocumentIds.filter(Boolean))];
    if (ids.length === 0) return [];

    await this.matterAccess.ensureMatterAccess(tenantId, userId, matterId, role);
    const documents = await this.prisma.document.findMany({
      where: { id: { in: ids }, tenantId, matterId, status: 'ACTIVE' },
      select: {
        id: true,
        fileName: true,
        updatedAt: true,
        extractedText: true,
        folderId: true,
        matterId: true,
        uploadedById: true,
      },
    });
    if (documents.length !== ids.length) {
      throw new ForbiddenException('Selected document is not available for this matter');
    }

    const byId = new Map(documents.map((document) => [document.id, document]));
    let remaining = Math.max(0, caps.totalChars);
    const result: ResearchContextDocument[] = [];
    for (const id of ids) {
      const document = byId.get(id)!;
      await this.assertDocumentAccess(tenantId, document, userId, role, 'READ');
      const decrypted = this.decryptDocumentText(document).extractedText?.trim() ?? '';
      const allowance = Math.min(Math.max(0, caps.perItemChars), remaining);
      const extractedText = decrypted.slice(0, allowance);
      result.push({
        id: document.id,
        fileName: document.fileName,
        updatedAt: document.updatedAt,
        extractedText,
        truncated: decrypted.length > extractedText.length,
      });
      remaining -= extractedText.length;
    }
    return result;
  }

  async updateTenantDocument(
    tenantId: string,
    documentId: string,
    userId: string,
    role: string | undefined,
    dto: UpdateDocumentMetadataDto,
  ) {
    const existing = await this.getTenantDocument(tenantId, documentId, userId, role);
    const targetMatterId =
      dto.matterId !== undefined ? dto.matterId : existing.matterId;
    let resolvedClientId: string | null | undefined = dto.clientId;

    if (targetMatterId) {
      const matter = await this.ensureMatter(tenantId, targetMatterId);
      if (dto.clientId !== undefined && dto.clientId !== matter.clientId) {
        throw new BadRequestException('Document client must match the selected matter');
      }
      resolvedClientId = matter.clientId;
    } else if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, tenantId },
      });
      if (!client) {
        throw new NotFoundException('Client not found for tenant');
      }
    }

    const document = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        ...(targetMatterId || dto.clientId !== undefined
          ? { clientId: resolvedClientId }
          : {}),
        ...(dto.matterId !== undefined ? { matterId: dto.matterId } : {}),
        ...(dto.folderId !== undefined ? { folderId: dto.folderId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: documentListInclude,
    });
    return this.decryptDocumentText(document);
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

    return this.decryptDocumentText(document);
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

    const documents = await this.prisma.consumerDocument.findMany({
      where: { consumerCaseId: caseId, userId },
      orderBy: { createdAt: 'desc' },
    });
    return documents.map((document) => this.decryptConsumerDocumentText(document));
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

  async restoreDocumentVersion(
    tenantId: string,
    documentId: string,
    versionId: string,
    userId: string,
    role?: string,
  ) {
    await this.getTenantDocument(tenantId, documentId, userId, role);

    const version = await this.prisma.documentVersion.findFirst({
      where: { id: versionId, documentId, tenantId },
    });
    if (!version) {
      throw new NotFoundException('Document version not found');
    }

    const document = await this.getTenantDocument(tenantId, documentId);
    const nextVersion = (document.version ?? 1) + 1;

    const [restoredVersion] = await this.prisma.$transaction([
      this.prisma.documentVersion.create({
        data: {
          tenantId,
          documentId,
          version: nextVersion,
          fileName: version.fileName,
          fileUrl: version.fileUrl,
          uploadedById: userId,
        },
      }),
      this.prisma.document.update({
        where: { id: documentId },
        data: {
          fileName: version.fileName,
          fileUrl: version.fileUrl,
          uploadedById: userId,
          version: nextVersion,
        },
      }),
    ]);

    return {
      restoredFromVersion: version.version,
      version: restoredVersion,
    };
  }

  async generateShareLink(
    tenantId: string,
    documentId: string,
    userId: string,
    role?: string,
  ) {
    await this.getTenantDocument(tenantId, documentId, userId, role);

    const token = randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const shareLink = await this.prisma.documentShareLink.create({
      data: {
        tenantId,
        documentId,
        token,
        expiresAt,
        createdBy: userId,
      },
    });

    const appUrl = resolveAppUrl(this.configService.get<string>('APP_URL'));

    return {
      id: shareLink.id,
      token: shareLink.token,
      expiresAt: shareLink.expiresAt,
      shareUrl: `${appUrl}/portal/documents/share/${shareLink.token}`,
    };
  }

  private sanitizeFileName(fileName: string) {
    return fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  private sanitizeScope(scope: string) {
    return scope.trim().replace(/[^a-zA-Z0-9/_-]/g, '_');
  }

  private documentTextAad(documentId: string) {
    return `document-extracted-text:${documentId}`;
  }

  private consumerDocumentTextAad(documentId: string) {
    return `consumer-document-extracted-text:${documentId}`;
  }

  private decryptDocumentText<T extends { id: string; extractedText: string | null }>(
    document: T,
  ): T {
    return {
      ...document,
      extractedText: this.encryption.decryptStringFromStorage(
        document.extractedText,
        this.documentTextAad(document.id),
      ),
    };
  }

  private decryptConsumerDocumentText<
    T extends { id: string; extractedText: string | null },
  >(document: T): T {
    return {
      ...document,
      extractedText: this.encryption.decryptStringFromStorage(
        document.extractedText,
        this.consumerDocumentTextAad(document.id),
      ),
    };
  }

  private async ensureMatter(tenantId: string, matterId: string) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      select: { id: true, clientId: true },
    });
    if (!matter) {
      throw new NotFoundException('Matter not found for tenant');
    }
    return matter;
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
    document: {
      id: string;
      folderId: string | null;
      matterId?: string | null;
      uploadedById: string | null;
    },
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

    if (rules.length > 0) {
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
      return;
    }

    if (await this.hasDefaultDocumentAccess(tenantId, document, userId, role)) {
      return;
    }

    throw new ForbiddenException('Document access denied');
  }

  private async hasDefaultDocumentAccess(
    tenantId: string,
    document: { matterId?: string | null },
    userId: string,
    role: string | undefined,
  ): Promise<boolean> {
    if (this.matterAccess.hasFullAccess(role)) {
      return true;
    }

    if (await this.rolePermissions.hasPermission(tenantId, role, 'canViewAllMatters')) {
      return true;
    }

    if (!document.matterId) {
      return false;
    }

    try {
      await this.matterAccess.ensureMatterAccess(tenantId, userId, document.matterId, role);
      return true;
    } catch {
      return false;
    }
  }

  async triggerOcrForDocument(tenantId: string, documentId: string, userId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
      select: { id: true, fileUrl: true, extractedText: true },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.extractedText?.trim()) {
      return { status: 'already_done', message: 'OCR already complete for this document.' };
    }
    await this.jobsService.enqueueOcrJob({
      documentId: doc.id,
      tenantId,
      userId,
      fileUrl: doc.fileUrl,
      scope: 'TENANT',
    });
    return { status: 'enqueued' };
  }
}
