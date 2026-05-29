import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatterAccessService } from '@/access/matter-access.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateKycChecklistDto,
  CreateKycDocumentDto,
  InitializeKycClientDto,
  UpdateKycDocumentByTypeDto,
  UpdateKycChecklistDto,
  UpdateKycDocumentDto,
} from './dto/kyc.dto';

@Injectable()
export class KycService {
  private readonly kycDocLabels: Record<string, string> = {
    ID_PASSPORT: 'ID/Passport',
    PROOF_OF_ADDRESS: 'Proof of Address',
    COMPANY_REGISTRATION: 'Company Registration',
    KRA_PIN: 'KRA PIN Certificate',
    CR12: 'CR12 Form',
    DIRECTOR_IDS: 'Director IDs',
    PARTNERSHIP_DEED: 'Partnership Deed',
    NGO_REGISTRATION: 'NGO Registration',
    BANK_STATEMENT: 'Bank Statement',
    OTHER: 'Other Document',
  };

  private readonly requiredDocsByClientType: Record<string, string[]> = {
    INDIVIDUAL: ['ID_PASSPORT', 'PROOF_OF_ADDRESS', 'KRA_PIN'],
    COMPANY: ['COMPANY_REGISTRATION', 'CR12', 'DIRECTOR_IDS', 'KRA_PIN'],
    NGO: ['NGO_REGISTRATION', 'DIRECTOR_IDS', 'KRA_PIN'],
    PARTNERSHIP: ['PARTNERSHIP_DEED', 'DIRECTOR_IDS', 'KRA_PIN'],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
  ) {}

  async getClientChecklist(
    tenantId: string,
    clientId: string,
    userId: string,
    role?: string,
  ) {
    await this.ensureClientReadable(tenantId, clientId, userId, role);
    const documents = await this.prisma.kycDocument.findMany({
      where: { tenantId, clientId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      clientId,
      documents: documents.map((document) => this.toApiDocument(document)),
      overallStatus: this.computeOverallStatus(documents.map((doc) => doc.status)),
    };
  }

  async initializeClientChecklist(
    tenantId: string,
    clientId: string,
    userId: string,
    role: string | undefined,
    dto: InitializeKycClientDto,
  ) {
    await this.ensureClientReadable(tenantId, clientId, userId, role);

    const normalizedType = this.normalizeClientType(dto.clientType);
    const requiredDocTypes =
      this.requiredDocsByClientType[normalizedType] ?? [
        'ID_PASSPORT',
        'PROOF_OF_ADDRESS',
      ];

    const checklist =
      (await this.prisma.kycChecklist.findFirst({
        where: { tenantId, clientId },
        orderBy: { updatedAt: 'desc' },
      })) ??
      (await this.prisma.kycChecklist.create({
        data: {
          tenantId,
          clientId,
          name: 'Primary KYC Checklist',
          status: 'PENDING',
        },
      }));

    const existingDocuments = await this.prisma.kycDocument.findMany({
      where: { tenantId, clientId },
    });
    const existingTypes = new Set(
      existingDocuments.map((document) => document.documentType.toUpperCase()),
    );

    const docsToCreate = requiredDocTypes.filter(
      (docType) => !existingTypes.has(docType),
    );

    if (docsToCreate.length > 0) {
      await this.prisma.kycDocument.createMany({
        data: docsToCreate.map((docType) => ({
          tenantId,
          clientId,
          checklistId: checklist.id,
          documentType: docType,
          status: 'MISSING',
        })),
      });
    }

    return this.getClientChecklist(tenantId, clientId, userId, role);
  }

  async updateDocumentByType(
    tenantId: string,
    clientId: string,
    docType: string,
    userId: string,
    role: string | undefined,
    dto: UpdateKycDocumentByTypeDto,
  ) {
    await this.ensureClientReadable(tenantId, clientId, userId, role);

    const normalizedDocType = this.normalizeDocType(docType);
    const existingDocument = await this.prisma.kycDocument.findFirst({
      where: {
        tenantId,
        clientId,
        documentType: normalizedDocType,
      },
    });

    const nextStatus = dto.status
      ? this.normalizeKycStatus(dto.status)
      : dto.fileUrl
        ? 'PENDING'
        : existingDocument?.status ?? 'PENDING';
    const nextFileName = dto.fileName ?? existingDocument?.fileName ?? undefined;

    const document = existingDocument
      ? await this.prisma.kycDocument.update({
          where: { id: existingDocument.id },
          data: {
            status: nextStatus,
            fileUrl: dto.fileUrl ?? existingDocument.fileUrl,
            fileName: nextFileName,
          },
        })
      : await this.prisma.kycDocument.create({
          data: {
            tenantId,
            clientId,
            documentType: normalizedDocType,
            status: nextStatus,
            fileUrl: dto.fileUrl,
            fileName: nextFileName,
          },
        });

    return this.toApiDocument(document);
  }

  async listMissingAlerts(tenantId: string, userId: string, role?: string) {
    const clients = await this.getAccessibleClientsWithKyc(tenantId, userId, role);
    return clients
      .map((client) => ({
        clientId: client.id,
        clientName: client.name,
        docs: client.kycDocuments
          .filter(
            (document) => this.normalizeKycStatus(document.status) === 'MISSING',
          )
          .map((document) => this.toApiDocument(document)),
      }))
      .filter((alert) => alert.docs.length > 0);
  }

  async listExpiredAlerts(tenantId: string, userId: string, role?: string) {
    const clients = await this.getAccessibleClientsWithKyc(tenantId, userId, role);
    return clients
      .map((client) => ({
        clientId: client.id,
        clientName: client.name,
        docs: client.kycDocuments
          .filter(
            (document) => this.normalizeKycStatus(document.status) === 'EXPIRED',
          )
          .map((document) => this.toApiDocument(document)),
      }))
      .filter((alert) => alert.docs.length > 0);
  }

  async listChecklists(
    tenantId: string,
    clientId: string,
    userId: string,
    role?: string,
  ) {
    await this.ensureClientReadable(tenantId, clientId, userId, role);

    return this.prisma.kycChecklist.findMany({
      where: { tenantId, clientId },
      include: { documents: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createChecklist(
    tenantId: string,
    clientId: string,
    userId: string,
    role: string | undefined,
    dto: CreateKycChecklistDto,
  ) {
    await this.ensureClientReadable(tenantId, clientId, userId, role);

    return this.prisma.kycChecklist.create({
      data: {
        tenantId,
        clientId,
        name: dto.name,
        status: dto.status ?? 'PENDING',
      },
      include: { documents: true },
    });
  }

  async updateChecklist(
    tenantId: string,
    clientId: string,
    checklistId: string,
    userId: string,
    role: string | undefined,
    dto: UpdateKycChecklistDto,
  ) {
    await this.ensureChecklist(tenantId, clientId, checklistId, userId, role);

    return this.prisma.kycChecklist.update({
      where: { id: checklistId },
      data: dto,
      include: { documents: true },
    });
  }

  async listDocuments(
    tenantId: string,
    clientId: string,
    userId: string,
    role?: string,
  ) {
    await this.ensureClientReadable(tenantId, clientId, userId, role);

    return this.prisma.kycDocument.findMany({
      where: { tenantId, clientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDocument(
    tenantId: string,
    clientId: string,
    userId: string,
    role: string | undefined,
    dto: CreateKycDocumentDto,
  ) {
    await this.ensureClientReadable(tenantId, clientId, userId, role);

    return this.prisma.kycDocument.create({
      data: {
        tenantId,
        clientId,
        checklistId: dto.checklistId,
        documentType: dto.documentType,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        status: dto.status ?? 'PENDING',
      },
    });
  }

  async updateDocument(
    tenantId: string,
    clientId: string,
    documentId: string,
    userId: string,
    role: string | undefined,
    dto: UpdateKycDocumentDto,
  ) {
    await this.ensureDocument(tenantId, clientId, documentId, userId, role);

    return this.prisma.kycDocument.update({
      where: { id: documentId },
      data: dto,
    });
  }

  private async ensureClientReadable(
    tenantId: string,
    clientId: string,
    userId: string,
    role?: string,
  ) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (this.matterAccess.hasFullAccess(role)) {
      return;
    }

    const accessibleClientIds = await this.matterAccess.getAccessibleClientIds(
      tenantId,
      userId,
      role,
    );

    if (!accessibleClientIds?.includes(clientId)) {
      throw new ForbiddenException('Client access denied');
    }
  }

  private async ensureChecklist(
    tenantId: string,
    clientId: string,
    checklistId: string,
    userId: string,
    role?: string,
  ) {
    await this.ensureClientReadable(tenantId, clientId, userId, role);

    const checklist = await this.prisma.kycChecklist.findFirst({
      where: { id: checklistId, tenantId, clientId },
    });

    if (!checklist) {
      throw new NotFoundException('KYC checklist not found');
    }
  }

  private async ensureDocument(
    tenantId: string,
    clientId: string,
    documentId: string,
    userId: string,
    role?: string,
  ) {
    await this.ensureClientReadable(tenantId, clientId, userId, role);

    const document = await this.prisma.kycDocument.findFirst({
      where: { id: documentId, tenantId, clientId },
    });

    if (!document) {
      throw new NotFoundException('KYC document not found');
    }
  }

  private normalizeClientType(clientType?: string) {
    return (clientType ?? '').trim().toUpperCase();
  }

  private normalizeDocType(docType: string) {
    return docType.trim().toUpperCase();
  }

  private normalizeKycStatus(status: string) {
    const normalized = status.trim().toUpperCase();
    if (normalized === 'RECEIVED') {
      return 'PENDING';
    }
    if (normalized === 'COMPLETE') {
      return 'VERIFIED';
    }
    if (
      normalized === 'MISSING' ||
      normalized === 'PENDING' ||
      normalized === 'VERIFIED' ||
      normalized === 'EXPIRED'
    ) {
      return normalized;
    }
    return 'PENDING';
  }

  private toApiDocument(document: {
    id: string;
    clientId: string;
    documentType: string;
    fileName: string | null;
    fileUrl: string | null;
    status: string;
    createdAt: Date;
  }) {
    return {
      id: document.id,
      clientId: document.clientId,
      docType: document.documentType,
      label:
        this.kycDocLabels[document.documentType.toUpperCase()] ??
        document.documentType,
      status: this.toApiStatus(document.status),
      uploadedAt: document.fileUrl ? document.createdAt.toISOString() : null,
      expiresAt: null,
      fileUrl: document.fileUrl,
    };
  }

  private toApiStatus(status: string): 'missing' | 'pending' | 'verified' | 'expired' {
    const normalized = this.normalizeKycStatus(status);
    if (normalized === 'MISSING') {
      return 'missing';
    }
    if (normalized === 'VERIFIED') {
      return 'verified';
    }
    if (normalized === 'EXPIRED') {
      return 'expired';
    }
    return 'pending';
  }

  private computeOverallStatus(statuses: string[]) {
    const normalizedStatuses = statuses.map((status) =>
      this.normalizeKycStatus(status),
    );
    if (normalizedStatuses.length === 0) {
      return 'missing';
    }
    if (normalizedStatuses.some((status) => status === 'MISSING')) {
      return 'missing';
    }
    if (normalizedStatuses.some((status) => status === 'EXPIRED')) {
      return 'expired';
    }
    if (normalizedStatuses.some((status) => status === 'PENDING')) {
      return 'pending';
    }
    return 'verified';
  }

  private async getAccessibleClientsWithKyc(
    tenantId: string,
    userId: string,
    role?: string,
  ) {
    if (this.matterAccess.hasFullAccess(role)) {
      return this.prisma.client.findMany({
        where: { tenantId },
        include: { kycDocuments: true },
      });
    }

    const accessibleClientIds = await this.matterAccess.getAccessibleClientIds(
      tenantId,
      userId,
      role,
    );
    if (!accessibleClientIds || accessibleClientIds.length === 0) {
      return [];
    }

    return this.prisma.client.findMany({
      where: {
        tenantId,
        id: { in: accessibleClientIds },
      },
      include: { kycDocuments: true },
    });
  }
}
