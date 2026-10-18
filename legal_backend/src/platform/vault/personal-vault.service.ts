import { Injectable, Logger, NotFoundException, Inject, Optional, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { PersonalLegalVault } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { STORAGE_GATEWAY, StorageGateway } from '@/platform/gateways/storage-gateway.interface';
import { MalwareScanService } from '@/platform/security/malware-scan.service';
import { DataClassificationService } from '@/platform/security/data-classification.service';

export interface VaultDocument {
  id: string;
  title: string;
  type: string;
  fileKey: string;
  mimeType: string;
  expiryDate?: string;
  addedAt: string;
}

export interface VaultContact {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  notes?: string;
  addedAt: string;
}

export interface VaultLifeEvent {
  id: string;
  date: string;
  type: string;
  title: string;
  description?: string;
  documentIds?: string[];
  addedAt: string;
}

@Injectable()
export class PersonalVaultService {
  private readonly logger = new Logger(PersonalVaultService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(STORAGE_GATEWAY) private readonly storageGateway: StorageGateway | null,
    @Optional() private readonly malwareScan: MalwareScanService | null,
    @Optional() private readonly dataClassifier: DataClassificationService | null,
  ) {}

  async getOrCreateVault(userId: string, tenantId?: string): Promise<PersonalLegalVault> {
    const existing = await this.prisma.personalLegalVault.findUnique({
      where: { userId },
    });
    if (existing) return existing;

    return this.prisma.personalLegalVault.create({
      data: {
        userId,
        tenantId,
        documents: [],
        contacts: [],
        events: [],
      },
    });
  }

  async getVault(userId: string): Promise<PersonalLegalVault> {
    const vault = await this.prisma.personalLegalVault.findUnique({
      where: { userId },
    });
    if (!vault) {
      throw new NotFoundException(`Vault for user ${userId} not found`);
    }
    return vault;
  }

  async addDocument(
    userId: string,
    doc: {
      title: string;
      type: string;
      fileKey: string;
      mimeType: string;
      expiryDate?: string;
    },
  ): Promise<PersonalLegalVault> {
    const vault = await this.getOrCreateVault(userId);
    const docs = (vault.documents as unknown) as VaultDocument[];

    const newDoc: VaultDocument = {
      id: uuidv4(),
      ...doc,
      addedAt: new Date().toISOString(),
    };

    return this.prisma.personalLegalVault.update({
      where: { userId },
      data: { documents: [...docs, newDoc] as any },
    });
  }

  async addContact(
    userId: string,
    contact: {
      name: string;
      role: string;
      phone?: string;
      email?: string;
      notes?: string;
    },
  ): Promise<PersonalLegalVault> {
    const vault = await this.getOrCreateVault(userId);
    const contacts = (vault.contacts as unknown) as VaultContact[];

    const newContact: VaultContact = {
      id: uuidv4(),
      ...contact,
      addedAt: new Date().toISOString(),
    };

    return this.prisma.personalLegalVault.update({
      where: { userId },
      data: { contacts: [...contacts, newContact] as any },
    });
  }

  async addLifeEvent(
    userId: string,
    event: {
      date: string;
      type: string;
      title: string;
      description?: string;
      documentIds?: string[];
    },
  ): Promise<PersonalLegalVault> {
    const vault = await this.getOrCreateVault(userId);
    const events = (vault.events as unknown) as VaultLifeEvent[];

    const newEvent: VaultLifeEvent = {
      id: uuidv4(),
      ...event,
      addedAt: new Date().toISOString(),
    };

    return this.prisma.personalLegalVault.update({
      where: { userId },
      data: { events: [...events, newEvent] as any },
    });
  }

  /**
   * Upload a file to S3 / StorageGateway and register in the vault.
   */
  async uploadDocument(
    userId: string,
    tenantId: string | undefined,
    input: {
      title: string;
      type: string;
      mimeType: string;
      content: Buffer;
      expiryDate?: string;
    },
  ): Promise<{ vault: PersonalLegalVault; signedUrl: string }> {
    const docId = uuidv4();
    const fileKey = `vault/${userId}/${docId}/${input.title.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

    // Malware scan before uploading
    if (this.malwareScan) {
      const scanResult = await this.malwareScan.scanBuffer(input.content, input.title, input.mimeType);
      if (scanResult.threatDetected) {
        this.logger.warn(`Malware detected in vault upload by ${userId}: ${scanResult.threatName}`);
        throw new BadRequestException(`File rejected: malware detected (${scanResult.threatName ?? 'unknown threat'})`);
      }
    }

    // Classify sensitivity for audit trail
    if (this.dataClassifier) {
      const textSample = input.content.slice(0, 4000).toString('utf-8');
      this.dataClassifier.classify(textSample); // Result stored in future audit log
    }

    let signedUrl = '';

    if (this.storageGateway) {
      await this.storageGateway.upload({
        key: fileKey,
        content: input.content,
        contentType: input.mimeType,
        metadata: { userId, vaultDocId: docId, tenantId: tenantId ?? '' },
        expiresAt: input.expiryDate ? new Date(input.expiryDate) : undefined,
      });
      signedUrl = await this.storageGateway.getSignedUrl(fileKey, 3600);
    } else {
      signedUrl = `https://storage.odaflow.com/${fileKey}`;
    }

    const vault = await this.addDocument(userId, {
      title: input.title,
      type: input.type,
      fileKey,
      mimeType: input.mimeType,
      expiryDate: input.expiryDate,
    });

    this.logger.log(`Vault document uploaded: ${fileKey} for user ${userId}`);
    return { vault, signedUrl };
  }

  /**
   * Get a signed download URL for a vault document.
   */
  async getDocumentDownloadUrl(userId: string, docId: string): Promise<string> {
    const vault = await this.getVault(userId);
    const docs = (vault.documents as unknown) as VaultDocument[];
    const doc = docs.find((d) => d.id === docId);

    if (!doc) throw new NotFoundException(`Document ${docId} not found in vault`);

    if (this.storageGateway) {
      const exists = await this.storageGateway.exists(doc.fileKey).catch(() => false);
      if (!exists) throw new NotFoundException(`File ${doc.fileKey} not found in storage`);
      return this.storageGateway.getSignedUrl(doc.fileKey, 3600);
    }

    return `https://storage.odaflow.com/${doc.fileKey}`;
  }

  /**
   * Delete a document from storage and vault.
   */
  async deleteDocument(userId: string, docId: string): Promise<PersonalLegalVault> {
    const vault = await this.getVault(userId);
    const docs = (vault.documents as unknown) as VaultDocument[];
    const doc = docs.find((d) => d.id === docId);

    if (doc && this.storageGateway) {
      await this.storageGateway.delete(doc.fileKey).catch((err) => {
        this.logger.warn(`Storage delete failed for ${doc.fileKey}: ${String(err)}`);
      });
    }

    return this.removeDocument(userId, docId);
  }

  async removeDocument(userId: string, docId: string): Promise<PersonalLegalVault> {
    const vault = await this.getVault(userId);
    const docs = ((vault.documents as unknown) as VaultDocument[]).filter((d) => d.id !== docId);

    return this.prisma.personalLegalVault.update({
      where: { userId },
      data: { documents: docs as any },
    });
  }
}
