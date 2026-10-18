import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { JobsService } from '@/jobs/jobs.service';
import { MIGRATION_JOB_TYPES } from '@/jobs/jobs.constants';
import { PrismaService } from '@/prisma/prisma.service';
import { ClioImportDto } from './dto/clio-import.dto';

export type MigrationJobStatus =
  | 'QUEUED'
  | 'VALIDATING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

export interface ClioMigrationJob {
  jobId: string;
  agentJobId: string;
  status: MigrationJobStatus;
  provider: 'clio';
  tenantId: string;
  fileName: string;
  rowCount: number;
  parsedRowCount: number;
  entityTypes: string[];
  validationErrors: string[];
  message: string;
  queuedAt: string;
  updatedAt: string;
  completedAt?: string;
  result?: Record<string, unknown>;
}

const REQUIRED_CSV_HEADERS = ['id', 'display_name', 'type'] as const;

@Injectable()
export class MigrationService {
  constructor(
    private readonly jobsService: JobsService,
    private readonly prisma: PrismaService,
  ) {}

  async importClioCsv(tenantId: string, dto: ClioImportDto) {
    const validation = this.validateClioCsv(dto);
    const now = new Date().toISOString();

    if (validation.errors.length > 0) {
      return {
        jobId: '',
        agentJobId: '',
        status: 'FAILED' as const,
        provider: 'clio' as const,
        tenantId,
        fileName: dto.fileName,
        rowCount: dto.rowCount,
        parsedRowCount: validation.parsedRowCount,
        entityTypes: dto.entityTypes ?? ['clients', 'matters', 'contacts'],
        validationErrors: validation.errors,
        message: 'Clio CSV validation failed',
        queuedAt: now,
        updatedAt: now,
      } satisfies ClioMigrationJob;
    }

    const customJobId = randomUUID();
    const enqueue = await this.jobsService.enqueueClioMigration({
      jobId: customJobId,
      tenantId,
      fileName: dto.fileName,
      rowCount: dto.rowCount,
      parsedRowCount: validation.parsedRowCount,
      entityTypes: dto.entityTypes ?? ['clients', 'matters', 'contacts'],
      csvContent: dto.csvContent,
    });

    return this.mapAgentJob(
      await this.prisma.agentJob.findUniqueOrThrow({
        where: { id: enqueue.agentJobId },
      }),
    );
  }

  async getJobStatus(tenantId: string, jobId: string) {
    const agentJob = await this.prisma.agentJob.findFirst({
      where: {
        id: jobId,
        tenantId,
        jobType: MIGRATION_JOB_TYPES.CLIO_IMPORT,
      },
    });

    if (!agentJob) {
      throw new NotFoundException('Migration job not found');
    }

    return this.mapAgentJob(agentJob);
  }

  private mapAgentJob(agentJob: {
    id: string;
    tenantId: string | null;
    status: string;
    payload: unknown;
    result: unknown;
    error: string | null;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
  }): ClioMigrationJob {
    const payload =
      agentJob.payload && typeof agentJob.payload === 'object'
        ? (agentJob.payload as Record<string, unknown>)
        : {};
    const result =
      agentJob.result && typeof agentJob.result === 'object'
        ? (agentJob.result as Record<string, unknown>)
        : undefined;

    const validationErrors = Array.isArray(payload.validationErrors)
      ? (payload.validationErrors as string[])
      : [];

    return {
      jobId: String(payload.jobId ?? agentJob.id),
      agentJobId: agentJob.id,
      status: agentJob.status as MigrationJobStatus,
      provider: 'clio',
      tenantId: agentJob.tenantId ?? String(payload.tenantId ?? ''),
      fileName: String(payload.fileName ?? 'clio-export.csv'),
      rowCount: Number(payload.rowCount ?? 0),
      parsedRowCount: Number(payload.parsedRowCount ?? 0),
      entityTypes: Array.isArray(payload.entityTypes)
        ? (payload.entityTypes as string[])
        : ['clients', 'matters', 'contacts'],
      validationErrors,
      message:
        agentJob.error ??
        (agentJob.status === 'COMPLETED'
          ? `Import completed (${String(result?.mattersCreated ?? 0)} matters, ${String(result?.clientsCreated ?? 0)} clients)`
          : agentJob.status === 'FAILED'
            ? 'Import failed'
            : 'Clio CSV queued for import'),
      queuedAt: agentJob.createdAt.toISOString(),
      updatedAt: agentJob.updatedAt.toISOString(),
      completedAt: agentJob.completedAt?.toISOString(),
      result,
    };
  }

  private validateClioCsv(dto: ClioImportDto): {
    parsedRowCount: number;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!dto.fileName.toLowerCase().endsWith('.csv')) {
      errors.push('fileName must end with .csv');
    }

    if (dto.rowCount < 1) {
      errors.push('rowCount must be at least 1');
    }

    if (dto.rowCount > 50_000) {
      errors.push('rowCount exceeds maximum of 50,000 rows');
    }

    const csvContent = dto.csvContent?.trim();
    let parsedRowCount = dto.rowCount;

    if (csvContent) {
      const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length < 2) {
        errors.push('csvContent must include a header row and at least one data row');
      } else {
        const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
        for (const required of REQUIRED_CSV_HEADERS) {
          if (!header.includes(required)) {
            errors.push(`Missing required CSV column: ${required}`);
          }
        }
        parsedRowCount = Math.max(0, lines.length - 1);
        if (parsedRowCount !== dto.rowCount) {
          errors.push(
            `rowCount (${dto.rowCount}) does not match parsed data rows (${parsedRowCount})`,
          );
        }
      }
    } else if (dto.rowCount > 0) {
      errors.push('csvContent is required for validation (send raw CSV body)');
    }

    const allowed = new Set(['clients', 'matters', 'contacts', 'activities']);
    for (const entity of dto.entityTypes ?? []) {
      if (!allowed.has(entity)) {
        errors.push(`Unsupported entityType: ${entity}`);
      }
    }

    return { parsedRowCount, errors };
  }
}
