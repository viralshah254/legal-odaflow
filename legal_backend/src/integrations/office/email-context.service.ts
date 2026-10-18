/**
 * Outlook add-in: email thread analysis, suggested actions, agreement cross-check.
 */

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { PrismaService } from '@/prisma/prisma.service';

export interface EmailContextDto {
  subject: string;
  body: string;
  threadItems?: Array<{ subject?: string; body?: string; from?: string }>;
  matterId?: string;
  tenantId: string;
}

export interface SuggestedAction {
  id: string;
  label: string;
  prompt: string;
  type: 'summarize' | 'reply' | 'cross_check' | 'custom';
}

export interface EmailNarrative {
  id: string;
  minutes: number;
  narrative: string;
  activityType: 'email' | 'research' | 'drafting' | 'call' | 'review';
}

export interface AgreementCrossCheck {
  name: string;
  foundInMatter: boolean;
  documentId?: string;
  documentTitle?: string;
  mismatch?: string;
}

@Injectable()
export class EmailContextService {
  constructor(
    private readonly llm: LlmCompletionService,
    private readonly prisma: PrismaService,
  ) {}

  async analyzeEmail(dto: EmailContextDto): Promise<{
    summary: string;
    parties: string[];
    agreementNames: string[];
    suggestedActions: SuggestedAction[];
    crossChecks: AgreementCrossCheck[];
  }> {
    const threadText = this.buildThreadText(dto);
    const extracted = await this.extractEntities(threadText, dto.subject);

    const suggestedActions: SuggestedAction[] = [
      {
        id: randomUUID(),
        label: 'Summarize the Email Thread',
        prompt: 'Summarize this email thread in bullet points for a lawyer, highlighting decisions needed.',
        type: 'summarize',
      },
      {
        id: randomUUID(),
        label: 'Draft a Professional Legal Reply',
        prompt: 'Draft a professional legal reply that addresses the key points and preserves our position.',
        type: 'reply',
      },
      {
        id: randomUUID(),
        label: 'Cross-Check Referenced Agreements',
        prompt: 'List every agreement or contract referenced and flag anything that needs verification against our records.',
        type: 'cross_check',
      },
    ];

    const crossChecks = await this.crossCheckAgreements(
      extracted.agreementNames,
      dto.tenantId,
      dto.matterId,
    );

    return {
      summary: extracted.summary,
      parties: extracted.parties,
      agreementNames: extracted.agreementNames,
      suggestedActions,
      crossChecks,
    };
  }

  async summarizeThread(dto: EmailContextDto): Promise<{ summary: string }> {
    const threadText = this.buildThreadText(dto);
    const result = await this.llm.complete({
      modelName: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Summarize this email thread for a lawyer. Use bullet points. Highlight action items, deadlines, and open questions.',
        },
        { role: 'user', content: `Subject: ${dto.subject}\n\n${threadText}` },
      ],
      maxTokens: 800,
      temperature: 0.2,
    });
    return { summary: result.content.trim() };
  }

  async extractEmailData(emailBody: string, emailSubject: string): Promise<{
    subject: string;
    parties: string[];
    issueType: string;
    jurisdiction: string;
    summary: string;
    clientName: string;
    clientEmail: string;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  }> {
    const result = await this.llm.complete({
      modelName: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Extract structured intake data from an email. Reply with ONLY valid JSON:
{ "parties": [], "issueType": "", "jurisdiction": "", "summary": "", "clientName": "", "clientEmail": "", "urgency": "LOW|MEDIUM|HIGH" }`,
        },
        { role: 'user', content: `Subject: ${emailSubject}\n\n${emailBody.slice(0, 8000)}` },
      ],
      maxTokens: 600,
      temperature: 0.1,
    });

    const defaults = {
      subject: emailSubject,
      parties: [] as string[],
      issueType: 'general',
      jurisdiction: '',
      summary: '',
      clientName: '',
      clientEmail: '',
      urgency: 'MEDIUM' as const,
    };

    try {
      const match = result.content.match(/\{[\s\S]*\}/);
      if (!match) return defaults;
      const parsed = JSON.parse(match[0]);
      return {
        subject: emailSubject,
        parties: parsed.parties ?? [],
        issueType: parsed.issueType ?? 'general',
        jurisdiction: parsed.jurisdiction ?? '',
        summary: parsed.summary ?? '',
        clientName: parsed.clientName ?? '',
        clientEmail: parsed.clientEmail ?? '',
        urgency: ['LOW', 'MEDIUM', 'HIGH'].includes(parsed.urgency) ? parsed.urgency : 'MEDIUM',
      };
    } catch {
      return defaults;
    }
  }

  async draftReply(payload: {
    emailBody: string;
    emailSubject: string;
    instruction?: string;
    matterId?: string;
    tenantId: string;
    tone?: string;
  }): Promise<{ draft: string }> {
    const instruction =
      payload.instruction?.trim() ||
      'Draft a professional legal reply addressing the key points in this email.';

    const result = await this.llm.complete({
      modelName: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a lawyer drafting an email reply. Tone: ${payload.tone ?? 'professional and concise'}. Reply with ONLY the email body text, no subject line.`,
        },
        {
          role: 'user',
          content: `Instruction: ${instruction}\n\nSubject: ${payload.emailSubject}\n\nEmail:\n${payload.emailBody.slice(0, 8000)}`,
        },
      ],
      maxTokens: 1200,
      temperature: 0.3,
    });

    return { draft: result.content.trim() };
  }

  /** Outlook Narratives: infer billable time entries from email thread activity. */
  async generateNarratives(dto: EmailContextDto): Promise<{ narratives: EmailNarrative[] }> {
    const threadText = this.buildThreadText(dto);

    const result = await this.llm.complete({
      modelName: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a legal timekeeping assistant (like Lucio Narratives). From an email thread, suggest billable time entries a lawyer would log on their timesheet.
Return ONLY valid JSON array (max 5 items). Each object:
- minutes: number (6–120, realistic for the activity)
- narrative: string (invoice-ready, past tense, specific to the email work — e.g. "Reviewed and responded to client inquiry regarding contract indemnity provisions")
- activityType: one of "email" | "research" | "drafting" | "call" | "review"

Focus on legal work implied by reading, drafting, reviewing, or coordinating in the thread. Do not invent court appearances or filings unless mentioned.`,
        },
        {
          role: 'user',
          content: threadText.slice(0, 12_000),
        },
      ],
      maxTokens: 900,
      temperature: 0.2,
    });

    const narratives: EmailNarrative[] = [];
    try {
      const match = result.content.match(/\[[\s\S]*\]/);
      const parsed = match ? JSON.parse(match[0]) : [];
      if (Array.isArray(parsed)) {
        for (const item of parsed.slice(0, 5)) {
          const minutes = Math.min(240, Math.max(6, Number(item.minutes) || 15));
          const narrative = String(item.narrative ?? '').trim();
          if (!narrative) continue;
          const activityType = ['email', 'research', 'drafting', 'call', 'review'].includes(
            item.activityType,
          )
            ? item.activityType
            : 'email';
          narratives.push({
            id: randomUUID(),
            minutes,
            narrative,
            activityType,
          });
        }
      }
    } catch {
      // fall through to default
    }

    if (narratives.length === 0) {
      narratives.push({
        id: randomUUID(),
        minutes: 12,
        narrative: `Reviewed email correspondence${dto.subject ? `: ${dto.subject.slice(0, 80)}` : ''} and prepared response`,
        activityType: 'email',
      });
    }

    return { narratives };
  }

  private buildThreadText(dto: EmailContextDto): string {
    const parts = [`Subject: ${dto.subject}`, dto.body];
    for (const item of dto.threadItems ?? []) {
      parts.push(`\n--- From: ${item.from ?? 'unknown'} ---\n${item.body ?? ''}`);
    }
    return parts.join('\n\n').slice(0, 24_000);
  }

  private async extractEntities(
    threadText: string,
    subject: string,
  ): Promise<{ summary: string; parties: string[]; agreementNames: string[] }> {
    const result = await this.llm.complete({
      modelName: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Analyze this email thread. Reply with ONLY valid JSON:
{ "summary": "2-3 sentence summary", "parties": ["names"], "agreementNames": ["MSA", "NDA", etc.] }`,
        },
        { role: 'user', content: `Subject: ${subject}\n\n${threadText.slice(0, 12000)}` },
      ],
      maxTokens: 500,
      temperature: 0.1,
    });

    try {
      const match = result.content.match(/\{[\s\S]*\}/);
      if (!match) {
        return { summary: '', parties: [], agreementNames: [] };
      }
      const parsed = JSON.parse(match[0]);
      return {
        summary: parsed.summary ?? '',
        parties: parsed.parties ?? [],
        agreementNames: parsed.agreementNames ?? [],
      };
    } catch {
      return { summary: '', parties: [], agreementNames: [] };
    }
  }

  private async crossCheckAgreements(
    agreementNames: string[],
    tenantId: string,
    matterId?: string,
  ): Promise<AgreementCrossCheck[]> {
    if (agreementNames.length === 0) return [];

    const where: { tenantId: string; matterId?: string } = { tenantId };
    if (matterId) where.matterId = matterId;

    const documents = await this.prisma.document.findMany({
      where,
      select: { id: true, fileName: true, documentCode: true },
      take: 100,
      orderBy: { updatedAt: 'desc' },
    });

    return agreementNames.map((name) => {
      const normalized = name.toLowerCase();
      const match = documents.find(
        (d) =>
          d.fileName?.toLowerCase().includes(normalized) ||
          d.documentCode?.toLowerCase().includes(normalized),
      );

      return {
        name,
        foundInMatter: !!match,
        documentId: match?.id,
        documentTitle: match?.fileName ?? match?.documentCode ?? undefined,
        mismatch: match ? undefined : 'Not found in linked matter documents',
      };
    });
  }
}
