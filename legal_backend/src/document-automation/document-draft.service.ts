import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join, dirname } from 'path';
import * as fs from 'fs';
import { PrismaService } from '@/prisma/prisma.service';
import { AiGatewayService } from '@/ai/ai-gateway.service';
import { CitationVerificationService } from '@/ai/citations/citation-verification.service';
import { DocumentAutomationService } from './document-automation.service';
import { ExportBrandingService } from '@/export/export-branding.service';

export interface DraftWithAiResult {
  documentId: string;
  draftHtml: string;
  disclaimer: string;
  provider: string;
  modelName: string;
  creditsCharged: number;
  verification?: import('@/ai/drafting/draft-verification.types').DraftVerificationAudit;
}

export interface ExportResult {
  url: string;
  format: 'docx' | 'pdf';
  fileName: string;
  downloadPath: string;
}

@Injectable()
export class DocumentDraftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
    private readonly documentAutomation: DocumentAutomationService,
    private readonly citationVerification: CitationVerificationService,
    private readonly config: ConfigService,
    private readonly exportBranding: ExportBrandingService,
  ) {}

  private uploadRoot(): string {
    return this.config.get<string>('UPLOAD_DIR', join(process.cwd(), 'uploads'));
  }

  private resolvePublicFileUrl(key: string): string {
    const apiUrl = this.config.get<string>('API_URL', 'http://localhost:4000').replace(/\/$/, '');
    const cdnUrl = this.config.get<string>('S3_PUBLIC_CDN_URL', '').trim();
    return `${cdnUrl || `${apiUrl}/uploads`}/${key}`;
  }

  private fileUrlToLocalPath(fileUrl: string): string | null {
    const uploadsMarker = '/uploads/';
    const idx = fileUrl.indexOf(uploadsMarker);
    if (idx < 0) return null;
    const key = fileUrl.slice(idx + uploadsMarker.length);
    return join(this.uploadRoot(), key);
  }

  private async launchPdfBrowser() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer = require('puppeteer-core') as typeof import('puppeteer-core');

    const configured = this.config.get<string>('PUPPETEER_EXECUTABLE_PATH')?.trim();
    if (configured && fs.existsSync(configured)) {
      return puppeteer.launch({
        executablePath: configured,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (fs.existsSync(macChrome)) {
      return puppeteer.launch({
        executablePath: macChrome,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    const chromium = await import('@sparticuz/chromium-min');
    return puppeteer.launch({
      args: chromium.default.args,
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });
  }

  private persistExportBuffer(
    tenantId: string,
    matterId: string,
    documentId: string,
    version: number,
    ext: 'html' | 'pdf' | 'docx',
    buffer: Buffer,
  ): { fileUrl: string; localPath: string } {
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const key = `${tenantId}/matters/${matterId}/${datePrefix}/${documentId}-v${version}.${ext}`;
    const localPath = join(this.uploadRoot(), key);
    fs.mkdirSync(dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, buffer);
    return { fileUrl: this.resolvePublicFileUrl(key), localPath };
  }

  private exportFileName(baseName: string, ext: 'pdf' | 'docx'): string {
    const stripped = baseName.replace(/\.(html?|pdf|docx)$/i, '');
    return `${stripped}.${ext}`;
  }

  async readExportFile(
    tenantId: string,
    documentId: string,
    format: 'pdf' | 'docx',
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!doc) throw new NotFoundException('Document not found');

    const storedUrl = format === 'pdf' ? doc.pdfUrl : doc.docxUrl;
    let localPath = storedUrl ? this.fileUrlToLocalPath(storedUrl) : null;

    if (!localPath || !fs.existsSync(localPath)) {
      const generated = format === 'pdf'
        ? await this.exportPdf(tenantId, documentId)
        : await this.exportDocx(tenantId, documentId);
      localPath = this.fileUrlToLocalPath(generated.url);
    }

    if (!localPath || !fs.existsSync(localPath)) {
      throw new NotFoundException('Export file not found');
    }

    return {
      buffer: fs.readFileSync(localPath),
      fileName: this.exportFileName(doc.fileName, format),
      mimeType:
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  async draftWithAi(
    tenantId: string,
    userId: string,
    matterId: string,
    templateId: string,
    locale?: string,
    mergeFieldOverrides?: Record<string, string>,
    knowledgeSources?: string[],
  ): Promise<DraftWithAiResult> {
    // 1. Load matter with full context
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      include: { client: true, tenant: true },
    });
    if (!matter) throw new NotFoundException('Matter not found');

    // 2. Load template
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id: templateId, tenantId, isActive: true },
    });
    if (!template) throw new NotFoundException('Template not found');

    // 3. Run deterministic merge for known fields
    const assembled = await this.documentAutomation.generateFromTemplate(
      tenantId,
      matterId,
      templateId,
    );

    // 4. Call AI to fill in remaining placeholders
    // Flatten planningAnswers into matterContext so the AI can use questionnaire responses
    const planningAnswers =
      matter.planningAnswers && typeof matter.planningAnswers === 'object'
        ? (matter.planningAnswers as Record<string, unknown>)
        : {};

    const draftWorkspace =
      matter.draftWorkspace && typeof matter.draftWorkspace === 'object'
        ? (matter.draftWorkspace as Record<string, unknown>)
        : {};

    const overrides = mergeFieldOverrides ?? {};

    const matterContext = {
      clientName: matter.client?.name,
      practiceArea: matter.practiceArea,
      factsSummary: matter.factsSummary ?? undefined,
      desiredOutcome: matter.desiredOutcome ?? undefined,
      opposingParty: matter.opposingParty ?? undefined,
      jurisdiction: matter.jurisdiction ?? undefined,
      countryCode: matter.countryCode,
      situationSummary:
        (overrides._situationSummary as string | undefined) ??
        (typeof draftWorkspace.situation === 'string' ? draftWorkspace.situation : undefined),
      clauseOutlineJson:
        (overrides._clauseOutline as string | undefined) ??
        (Array.isArray(draftWorkspace.clauseOutline)
          ? JSON.stringify(draftWorkspace.clauseOutline)
          : undefined),
      selectedTemplateKind:
        (overrides._selectedTemplateKind as string | undefined) ??
        template.documentKind ??
        undefined,
      selectedTemplateJurisdiction:
        (overrides._selectedTemplateJurisdiction as string | undefined) ??
        template.jurisdiction ??
        undefined,
      appliedClauses: assembled.appliedClauses.join(', '),
      skippedClauses: assembled.skippedClauses.join(', '),
      ...planningAnswers,
      ...overrides,
    };

    const aiResult = await this.aiGateway.runTemplateDraft({
      userId,
      tenantId,
      matterId,
      templateId,
      templateHtml: template.content,
      templateName: template.name,
      mergedHtml: assembled.body,
      matterContext,
      locale,
      templateMeta: {
        documentKind: template.documentKind ?? undefined,
        countryCode: template.countryCode ?? matter.countryCode,
        practiceArea: template.practiceArea ?? undefined,
        jurisdiction: template.jurisdiction ?? undefined,
      },
      knowledgeSources,
    });

    // 5. Persist the draft as a Document on the matter
    const doc = await this.prisma.document.create({
      data: {
        tenantId,
        matterId,
        clientId: matter.clientId ?? undefined,
        fileName: `${template.name} — Draft.html`,
        fileUrl: '', // will be updated when exported
        mimeType: 'text/html',
        htmlContent: aiResult.draftHtml,
        visibility: 'PRIVATE',
        version: 1,
        generatedFromTemplateId: templateId,
        aiDraftStatus: 'DRAFT',
        uploadedById: userId,
      },
    });

    // Run citation verification in background (non-blocking)
    void this.citationVerification
      .verifyDocumentDraftCitations({
        documentId: doc.id,
        tenantId,
        htmlContent: aiResult.draftHtml,
      })
      .catch(() => {});

    return {
      documentId: doc.id,
      draftHtml: aiResult.draftHtml,
      disclaimer: aiResult.disclaimer,
      provider: aiResult.provider,
      modelName: aiResult.modelName,
      creditsCharged: aiResult.chargedCredits,
      verification: aiResult.verification,
    };
  }

  async updateDraftHtml(
    tenantId: string,
    documentId: string,
    htmlContent: string,
  ): Promise<void> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (!doc.matterId) throw new NotFoundException('Matter not linked to document');

    const nextVersion = doc.version + 1;
    const { fileUrl } = this.persistExportBuffer(
      tenantId,
      doc.matterId,
      documentId,
      nextVersion,
      'html',
      Buffer.from(htmlContent, 'utf8'),
    );
    const fileName = doc.fileName.replace(/\.(pdf|docx)$/i, '.html');

    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        htmlContent,
        fileUrl,
        fileName,
        mimeType: 'text/html',
        aiDraftStatus: 'REVIEWED',
        version: nextVersion,
      },
    });
  }

  async exportDocx(tenantId: string, documentId: string): Promise<ExportResult> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!doc || !doc.htmlContent) throw new NotFoundException('Document or HTML content not found');
    if (!doc.matterId) throw new NotFoundException('Matter not linked to document');

    const branding = await this.exportBranding.getBranding(tenantId);
    const date = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    const letterhead = this.exportBranding.buildLetterheadHtml(branding, { date });
    const footer = this.exportBranding.buildFooterHtml(date);
    const fullHtml = `${letterhead}${doc.htmlContent}${footer}`;

    let docxBuffer: Buffer;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const htmlToDocx = require('html-to-docx') as (
        html: string,
        header?: string,
        opts?: Record<string, unknown>,
        footer?: string,
      ) => Promise<Buffer>;

      docxBuffer = await htmlToDocx(fullHtml, undefined, {
        table: { row: { cantSplit: true } },
        footer: true,
        pageNumber: true,
      });
    } catch (err) {
      throw new NotFoundException(
        `DOCX conversion failed; content preserved in editor. ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const { fileUrl } = this.persistExportBuffer(
      tenantId,
      doc.matterId,
      documentId,
      doc.version,
      'docx',
      docxBuffer,
    );
    const fileName = this.exportFileName(doc.fileName, 'docx');
    const downloadPath = `/document-automation/documents/${documentId}/export/docx/download`;

    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        docxUrl: fileUrl,
        fileUrl,
        fileName,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        aiDraftStatus: 'REVIEWED',
      },
    });

    return { url: fileUrl, format: 'docx', fileName, downloadPath };
  }

  async exportPdf(tenantId: string, documentId: string): Promise<ExportResult> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!doc || !doc.htmlContent) throw new NotFoundException('Document or HTML content not found');
    if (!doc.matterId) throw new NotFoundException('Matter not linked to document');

    const branding = await this.exportBranding.getBranding(tenantId);
    const date = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    const letterhead = this.exportBranding.buildLetterheadHtml(branding, { date });
    const footer = this.exportBranding.buildFooterHtml(date);

    let pdfBuffer: Buffer;

    try {
      const browser = await this.launchPdfBrowser();
      const page = await browser.newPage();
      await page.setContent(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; padding: 24px; }
          h1,h2,h3 { page-break-after: avoid; }
        </style></head><body>${letterhead}${doc.htmlContent}${footer}</body></html>`,
        { waitUntil: 'load' },
      );
      pdfBuffer = Buffer.from(await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } }));
      await browser.close();
    } catch {
      throw new NotFoundException(
        'PDF export failed. Install Chrome or set PUPPETEER_EXECUTABLE_PATH, then try again.',
      );
    }

    const { fileUrl } = this.persistExportBuffer(
      tenantId,
      doc.matterId,
      documentId,
      doc.version,
      'pdf',
      pdfBuffer,
    );
    const fileName = this.exportFileName(doc.fileName, 'pdf');
    const downloadPath = `/document-automation/documents/${documentId}/export/pdf/download`;

    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        pdfUrl: fileUrl,
        fileUrl,
        fileName,
        mimeType: 'application/pdf',
        aiDraftStatus: 'REVIEWED',
      },
    });

    return { url: fileUrl, format: 'pdf', fileName, downloadPath };
  }

  async getDraft(tenantId: string, documentId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
      select: {
        id: true,
        fileName: true,
        htmlContent: true,
        aiDraftStatus: true,
        generatedFromTemplateId: true,
        docxUrl: true,
        pdfUrl: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async listMatterDocuments(tenantId: string, matterId: string) {
    return this.prisma.document.findMany({
      where: { tenantId, matterId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        aiDraftStatus: true,
        generatedFromTemplateId: true,
        docxUrl: true,
        pdfUrl: true,
        version: true,
        createdAt: true,
      },
    });
  }
}
