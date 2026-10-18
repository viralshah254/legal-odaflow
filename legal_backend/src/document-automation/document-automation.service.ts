import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateQuestionnaireDto, UpdateQuestionnaireDto } from './dto/questionnaire.dto';

export interface MergeFieldContext {
  // Canonical camelCase keys
  clientName?: string;
  matterTitle?: string;
  caseNumber?: string;
  today?: string;
  firmName?: string;
  practiceArea?: string;
  jurisdiction?: string;
  courtName?: string;
  factsSummary?: string;
  desiredOutcome?: string;
  opposingParty?: string;
  matterDescription?: string;
  // Contract & Document Drafting fields (populated from planningAnswers)
  party1Name?: string;
  party1Address?: string;
  party2Name?: string;
  party2Address?: string;
  servicesDescription?: string;
  paymentTerms?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  governingLaw?: string;
  // NDA-specific
  ndaDurationYears?: string;
  // Partnership-specific
  equitySplit?: string;
  partnerRoles?: string;
  businessName?: string;
  capitalContribution?: string;
  // Lease-specific
  propertyAddress?: string;
  rentAmount?: string;
  leaseTerm?: string;
  depositAmount?: string;
  landlordName?: string;
  landlordAddress?: string;
  tenantName?: string;
  tenantAddress?: string;
  // Employment-specific
  jobTitle?: string;
  salary?: string;
  startDate?: string;
  probationPeriod?: string;
  workingHours?: string;
  overtimeTerms?: string;
  noticePeriod?: string;
  // Catch-all for template-specific fields
  [key: string]: string | undefined;
}

/** Convert camelCase key to snake_case alias, e.g. clientName -> client_name */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Convert snake_case key to camelCase alias, e.g. client_name -> clientName */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export interface AssembledDocument {
  title: string;
  body: string;
  appliedClauses: string[];
  skippedClauses: string[];
}

@Injectable()
export class DocumentAutomationService {
  constructor(private readonly prisma: PrismaService) {}

  async generateFromTemplate(tenantId: string, matterId: string, templateId: string) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      include: { client: true, tenant: true },
    });
    if (!matter) {
      throw new NotFoundException('Matter not found');
    }

    const pa = (matter.planningAnswers ?? {}) as Record<string, string>;

    const context: MergeFieldContext = {
      clientName: matter.client?.name,
      matterTitle: matter.title,
      matterDescription: matter.factsSummary?.split('\n')[0] ?? matter.title,
      caseNumber: matter.caseNumber ?? undefined,
      opposingParty: matter.opposingParty ?? undefined,
      practiceArea: matter.practiceArea,
      jurisdiction: pa['governingLaw'] ?? matter.jurisdiction ?? undefined,
      courtName: matter.courtName ?? undefined,
      factsSummary: matter.factsSummary ?? undefined,
      desiredOutcome: matter.desiredOutcome ?? undefined,
      firmName: matter.tenant?.name ?? 'Our Firm',
      // Contract drafting fields from planningAnswers
      party1Name: pa['party1Name'] ?? pa["What is Party 1's full name? (your client, employer, landlord, or disclosing party)"] ?? matter.client?.name,
      party1Address: pa['party1Address'] ?? pa["What is Party 1's address?"],
      party2Name: pa['party2Name'] ?? pa["What is Party 2's full name? (counterparty, employee, tenant, or receiving party)"] ?? matter.opposingParty ?? undefined,
      party2Address: pa['party2Address'] ?? pa["What is Party 2's address?"],
      servicesDescription: pa['servicesDescription'] ?? pa['Briefly describe the key subject matter or purpose of the agreement (e.g. services to be provided, property details, employment role)'],
      paymentTerms: pa['paymentTerms'] ?? pa['What are the payment or financial terms? (e.g. fixed fee, hourly rate, monthly rent, salary)'],
      contractStartDate: pa['contractStartDate'] ?? pa['What is the intended start date and duration / end date of the agreement?'],
      contractEndDate: pa['contractEndDate'],
      governingLaw: pa['governingLaw'] ?? pa['Which governing law / jurisdiction should apply?'] ?? matter.jurisdiction ?? undefined,
      ndaDurationYears: pa['ndaDurationYears'],
      equitySplit: pa['equitySplit'],
      partnerRoles: pa['partnerRoles'],
      businessName: pa['businessName'],
      capitalContribution: pa['capitalContribution'],
      propertyAddress: pa['propertyAddress'],
      rentAmount: pa['rentAmount'],
      leaseTerm: pa['leaseTerm'],
      depositAmount: pa['depositAmount'],
      jobTitle: pa['jobTitle'],
      salary: pa['salary'],
      startDate: pa['startDate'] ?? pa['contractStartDate'],
      probationPeriod: pa['probationPeriod'],
      workingHours: pa['workingHours'],
      noticePeriod: pa['noticePeriod'],
      // Spread all planningAnswers as catch-all
      ...pa,
    };

    const answers: Record<string, string | boolean> = {};
    for (const [key, value] of Object.entries(pa)) {
      if (typeof value === 'string') answers[key] = value;
    }
    answers.countryCode = matter.countryCode;

    return this.assembleFromQuestionnaire(tenantId, templateId, answers, context);
  }

  async assembleFromQuestionnaire(
    tenantId: string,
    templateId: string,
    answers: Record<string, string | boolean>,
    context: MergeFieldContext,
  ): Promise<AssembledDocument> {
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id: templateId, tenantId },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const bodyTemplate = template.content ?? '';
    const clauses = this.parseConditionalClauses(bodyTemplate);
    const applied: string[] = [];
    const skipped: string[] = [];
    let body = bodyTemplate;

    for (const clause of clauses) {
      const shouldInclude = this.evaluateCondition(clause.condition, answers);
      if (shouldInclude) {
        body = body.replace(clause.marker, clause.content);
        applied.push(clause.id);
      } else {
        body = body.replace(clause.marker, '');
        skipped.push(clause.id);
      }
    }

    body = this.applyMergeFields(body, context);

    return {
      title: template.name,
      body,
      appliedClauses: applied,
      skippedClauses: skipped,
    };
  }

  createQuestionnaire(tenantId: string, dto: CreateQuestionnaireDto) {
    return this.prisma.questionnaire.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        templateId: dto.templateId,
        questions: dto.questions as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
      },
    });
  }

  listQuestionnaires(tenantId: string, isActive?: string) {
    return this.prisma.questionnaire.findMany({
      where: {
        tenantId,
        isActive: isActive === undefined ? undefined : isActive === 'true',
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findQuestionnaire(tenantId: string, questionnaireId: string) {
    const row = await this.prisma.questionnaire.findFirst({
      where: { id: questionnaireId, tenantId },
    });
    if (!row) {
      throw new NotFoundException('Questionnaire not found');
    }
    return row;
  }

  async updateQuestionnaire(
    tenantId: string,
    questionnaireId: string,
    dto: UpdateQuestionnaireDto,
  ) {
    await this.findQuestionnaire(tenantId, questionnaireId);
    return this.prisma.questionnaire.update({
      where: { id: questionnaireId },
      data: {
        name: dto.name?.trim(),
        templateId: dto.templateId,
        questions: dto.questions as Prisma.InputJsonValue | undefined,
        isActive: dto.isActive,
      },
    });
  }

  async removeQuestionnaire(tenantId: string, questionnaireId: string) {
    await this.findQuestionnaire(tenantId, questionnaireId);
    await this.prisma.questionnaire.delete({ where: { id: questionnaireId } });
    return { success: true };
  }

  private applyMergeFields(text: string, context: MergeFieldContext): string {
    const today = new Date().toISOString().slice(0, 10);
    const merged: Record<string, string> = {
      today,
      date: today,
    };

    for (const [key, value] of Object.entries(context)) {
      if (value === undefined) continue;
      // Store under the original key
      merged[key] = value;
      // Also store under the snake_case alias
      const snake = toSnakeCase(key);
      if (snake !== key) merged[snake] = value;
      // Also store under the camelCase alias
      const camel = toCamelCase(key);
      if (camel !== key) merged[camel] = value;
    }

    // Common display aliases not in context object
    if (!merged.matter_description && merged.matterDescription) {
      merged.matter_description = merged.matterDescription;
    }
    if (!merged.firm_name && merged.firmName) {
      merged.firm_name = merged.firmName;
    }
    if (!merged.client_name && merged.clientName) {
      merged.client_name = merged.clientName;
    }
    if (!merged.matter_title && merged.matterTitle) {
      merged.matter_title = merged.matterTitle;
    }
    if (!merged.facts_summary && merged.factsSummary) {
      merged.facts_summary = merged.factsSummary;
    }

    return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => merged[key] ?? `[${key}]`);
  }

  private parseConditionalClauses(body: string) {
    const regex = /\[\[if:([^\]]+)\]\]([\s\S]*?)\[\[\/if\]\]/g;
    const clauses: Array<{ id: string; marker: string; condition: string; content: string }> = [];
    let match: RegExpExecArray | null;
    let index = 0;
    while ((match = regex.exec(body)) !== null) {
      clauses.push({
        id: `clause_${index++}`,
        marker: match[0],
        condition: match[1].trim(),
        content: match[2].trim(),
      });
    }
    return clauses;
  }

  private normalizeAnswer(value: string | boolean | undefined): string {
    if (value === true) return 'yes';
    if (value === false) return 'no';
    return String(value ?? '').trim().toLowerCase();
  }

  private evaluateCondition(condition: string, answers: Record<string, string | boolean>) {
    const parts = condition.trim().split(/\s+/);
    const key = parts[0];
    const op = parts[1] ?? '==';
    const raw = parts.slice(2).join(' ');
    const value = answers[key];
    const normalized = this.normalizeAnswer(value);
    const rawNorm = raw.toLowerCase();

    if (op === 'truthy') {
      return Boolean(value && normalized !== 'no' && normalized !== 'false');
    }
    if (op === 'empty') {
      return !value || normalized === '';
    }
    if (op === '==') {
      if (rawNorm === 'yes') return ['yes', 'true', '1'].includes(normalized);
      if (rawNorm === 'no') return ['no', 'false', '0'].includes(normalized);
      if (rawNorm === 'client') return ['client', 'party1', 'employer'].includes(normalized);
      if (rawNorm === 'provider') return ['provider', 'party2', 'contractor'].includes(normalized);
      return normalized === rawNorm || String(value) === raw;
    }
    if (op === '!=') {
      return normalized !== rawNorm && String(value) !== raw;
    }
    return Boolean(value);
  }
}
