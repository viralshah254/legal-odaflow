import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

// Jurisdiction-aware limitation periods (in days) per practice area
const LIMITATION_PERIODS: Record<
  string,
  Record<string, { days: number; rule: string }>
> = {
  litigation_disputes: {
    GB: { days: 2190, rule: 'Limitation Act 1980 s.2 (contract/tort 6yr)' },
    KE: { days: 2190, rule: 'Limitation of Actions Act Cap 22 s.4 (6yr)' },
    US: { days: 1460, rule: 'Varies by state; typically 4yr contract (CA), 3yr tort' },
    IN: { days: 1095, rule: 'Limitation Act 1963 Art.55 (contract 3yr)' },
  },
  employment_labour: {
    GB: { days: 91, rule: 'Employment Rights Act 1996 s.111 (3 months less 1 day)' },
    KE: { days: 1095, rule: 'Employment Act 2007 (3yr)' },
    US: { days: 300, rule: 'Title VII / ADA — 300 days to EEOC' },
    IN: { days: 365, rule: 'Industrial Disputes Act s.10A (1yr)' },
  },
  family_matrimonial: {
    GB: { days: -1, rule: 'No fixed limitation — petition anytime after 1yr of marriage' },
    KE: { days: -1, rule: 'Marriage Act 2014 — no fixed period' },
    US: { days: -1, rule: 'No federal limitation — state law varies' },
    IN: { days: -1, rule: 'HMA/SMA — petition after 1yr of marriage' },
  },
  criminal_defense: {
    GB: { days: 182, rule: 'Magistrates\' Courts Act 1980 s.127 (6 months summary offences)' },
    KE: { days: 365, rule: 'Criminal Procedure Code (varies by offence)' },
    US: { days: 1825, rule: 'Federal: 5yr general SOL (18 USC 3282)' },
    IN: { days: 365, rule: 'BNSS 2023 s.479 (varies by offence)' },
  },
  real_estate_property: {
    GB: { days: 4380, rule: 'Limitation Act 1980 s.15 (12yr adverse possession)' },
    KE: { days: 4380, rule: 'Limitation of Actions Act s.7 (12yr land)' },
    US: { days: 3650, rule: 'Varies by state: 10yr average' },
    IN: { days: 4380, rule: 'Limitation Act 1963 Art.65 (12yr adverse possession)' },
  },
  intellectual_property: {
    GB: { days: 2190, rule: 'Limitation Act 1980 s.2 (6yr IP infringement)' },
    KE: { days: 2190, rule: 'Industrial Property Act / Copyright Act (6yr)' },
    US: { days: 1095, rule: 'Lanham Act s.43 (3yr); Patents Act 35 USC 286 (6yr)' },
    IN: { days: 1095, rule: 'Trade Marks Act 1999 s.47 / Patents Act (3yr infringement)' },
  },
  corporate_commercial: {
    GB: { days: 2190, rule: 'Limitation Act 1980 s.5 (contract 6yr)' },
    KE: { days: 2190, rule: 'Limitation of Actions Act s.4 (6yr contract)' },
    US: { days: 1460, rule: 'UCC Art.2 (4yr); common law contract (varies)' },
    IN: { days: 1095, rule: 'Limitation Act 1963 Art.55 (contract 3yr)' },
  },
  tax: {
    GB: { days: 1460, rule: 'Taxes Management Act 1970 — HMRC enquiry window 4yr' },
    KE: { days: 1825, rule: 'Tax Procedures Act 2015 — 5yr assessment window' },
    US: { days: 1095, rule: 'IRC s.6501 — IRS 3yr assessment window' },
    IN: { days: 1095, rule: 'Income Tax Act 1961 s.149 — 3yr reassessment' },
  },
  wills_estates_probate: {
    GB: { days: 4380, rule: 'Limitation Act 1980 s.22 (12yr probate claims)' },
    KE: { days: 2190, rule: 'Law of Succession Act — 6yr from date of death' },
    US: { days: 730, rule: 'State probate codes vary — typically 2yr from death' },
    IN: { days: 365, rule: 'Indian Succession Act 1925 Art.137 (1yr)' },
  },
  immigration: {
    GB: { days: 28, rule: 'Immigration Rules — 28 days appeal from Home Office refusal' },
    KE: { days: 60, rule: 'Kenya Citizenship and Immigration Act — 60 days' },
    US: { days: 30, rule: 'Immigration Court — 30 days appeal from IJ order' },
    IN: { days: 60, rule: 'Foreigners Act 1946 — 60 days' },
  },
};

export interface CreateCourtDeadlineDto {
  title: string;
  deadlineType: string;
  dueDate: string;
  calculatedFrom?: string;
  ruleReference?: string;
  notes?: string;
  calendarEventId?: string;
}

export interface UpdateCourtDeadlineDto {
  title?: string;
  dueDate?: string;
  status?: string;
  notes?: string;
  calendarEventId?: string;
}

@Injectable()
export class CourtDeadlinesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByMatter(tenantId: string, matterId: string) {
    return this.prisma.courtDeadline.findMany({
      where: { tenantId, matterId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async create(
    tenantId: string,
    matterId: string,
    dto: CreateCourtDeadlineDto,
  ) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });
    if (!matter) throw new NotFoundException('Matter not found');

    return this.prisma.courtDeadline.create({
      data: {
        tenantId,
        matterId,
        title: dto.title,
        deadlineType: dto.deadlineType,
        dueDate: new Date(dto.dueDate),
        calculatedFrom: dto.calculatedFrom
          ? new Date(dto.calculatedFrom)
          : undefined,
        ruleReference: dto.ruleReference,
        notes: dto.notes,
        calendarEventId: dto.calendarEventId,
      },
    });
  }

  async update(
    tenantId: string,
    deadlineId: string,
    dto: UpdateCourtDeadlineDto,
  ) {
    const existing = await this.prisma.courtDeadline.findFirst({
      where: { id: deadlineId, tenantId },
    });
    if (!existing) throw new NotFoundException('Deadline not found');

    return this.prisma.courtDeadline.update({
      where: { id: deadlineId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
        ...(dto.status && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.calendarEventId !== undefined && {
          calendarEventId: dto.calendarEventId,
        }),
      },
    });
  }

  async delete(tenantId: string, deadlineId: string) {
    const existing = await this.prisma.courtDeadline.findFirst({
      where: { id: deadlineId, tenantId },
    });
    if (!existing) throw new NotFoundException('Deadline not found');
    return this.prisma.courtDeadline.delete({ where: { id: deadlineId } });
  }

  /**
   * Auto-calculate limitation period deadline for a matter
   */
  async calculateLimitationPeriod(tenantId: string, matterId: string) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });
    if (!matter) throw new NotFoundException('Matter not found');

    const countryCode = matter.countryCode.toUpperCase();
    const practiceArea = matter.practiceArea;

    const periods = LIMITATION_PERIODS[practiceArea];
    if (!periods) {
      return { calculated: false, reason: 'No limitation period data for this practice area' };
    }

    const period = periods[countryCode];
    if (!period) {
      return { calculated: false, reason: `No limitation period data for ${countryCode}` };
    }

    if (period.days < 0) {
      return { calculated: false, reason: period.rule };
    }

    // Matter creation is an administrative event, not the legal accrual date.
    // Do not persist a deadline until an evidenced trigger and applicable rule
    // (including exceptions and extensions) have been confirmed.
    return {
      calculated: false,
      reason: 'Confirm the legal trigger date and applicable limitation rule before calculating a deadline. Matter creation date cannot be used.',
      requiresLawyerReview: true,
    };
  }

  getLimitationPeriodInfo(practiceArea: string, countryCode: string) {
    const periods = LIMITATION_PERIODS[practiceArea];
    if (!periods) return null;
    return periods[countryCode.toUpperCase()] ?? null;
  }

  getAllLimitationPeriods(practiceArea?: string) {
    if (practiceArea) {
      return LIMITATION_PERIODS[practiceArea] ?? null;
    }
    return LIMITATION_PERIODS;
  }
}
