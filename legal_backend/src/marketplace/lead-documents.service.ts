import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { JobsService } from '@/jobs/jobs.service';
import { S3UploadService } from '@/storage/s3-upload.service';
import { IntakeAnalysisService } from './intake-analysis.service';
import { CreateLeadDocumentDto } from './dto/run-lead-analysis.dto';

@Injectable()
export class LeadDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly configService: ConfigService,
    private readonly intakeAnalysis: IntakeAnalysisService,
    private readonly s3Upload: S3UploadService,
  ) {}

  async listDocuments(userId: string, leadId: string) {
    const lead = await this.intakeAnalysis.verifyLeadAccess(userId, leadId);
    return this.prisma.leadDocument.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUploadUrl(userId: string, leadId: string, fileName: string) {
    const lead = await this.intakeAnalysis.verifyLeadAccess(userId, leadId);
    if (!lead.tenantId) {
      throw new ForbiddenException('Lead has no tenant');
    }

    const provider = this.configService.get<string>('S3_PROVIDER', 'local');
    const apiUrl = this.configService
      .get<string>('API_URL', 'http://localhost:4000')
      .replace(/\/$/, '');
    const cdnUrl = this.configService.get<string>('S3_PUBLIC_CDN_URL', '').trim();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const key = `${lead.tenantId}/leads/${lead.id}/${datePrefix}/${randomUUID()}-${safeName}`;

    if (provider === 'local') {
      const localBaseUrl = cdnUrl || `${apiUrl}/uploads`;
      const fileUrl = `${localBaseUrl}/${key}`;
      return { uploadUrl: fileUrl, fileUrl, key };
    }

    if (!this.s3Upload.isConfigured()) {
      throw new BadRequestException('Cloud storage is not configured for uploads');
    }

    const bucket = this.configService.get<string>('S3_BUCKET', '');
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');
    const { uploadUrl, uploadHeaders } = await this.s3Upload.createPresignedPutUrl(
      key,
      'application/octet-stream',
    );
    const fileUrl = cdnUrl
      ? `${cdnUrl}/${key}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return { uploadUrl, uploadHeaders, fileUrl, key };
  }

  async createDocument(
    userId: string,
    leadId: string,
    dto: CreateLeadDocumentDto,
  ) {
    const lead = await this.intakeAnalysis.verifyLeadAccess(userId, leadId);
    if (!lead.tenantId) {
      throw new ForbiddenException('Lead has no tenant');
    }

    const document = await this.prisma.leadDocument.create({
      data: {
        leadId: lead.id,
        tenantId: lead.tenantId,
        uploadedById: userId,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        mimeType: dto.mimeType,
        fileSizeBytes: dto.fileSizeBytes,
        ocrStatus: 'PENDING',
      },
    });

    await this.jobsService.enqueueLeadDocumentOcrJob({
      leadDocumentId: document.id,
      tenantId: lead.tenantId,
      userId,
      fileUrl: dto.fileUrl,
    });

    return document;
  }
}
