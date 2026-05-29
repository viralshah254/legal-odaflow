import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ClioImportDto } from './dto/clio-import.dto';

export type MigrationJobStatus =
  | 'QUEUED'
  | 'VALIDATING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

export interface ClioMigrationJob {
  jobId: string;
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
}

const REQUIRED_CSV_HEADERS = ['id', 'display_name', 'type'] as const;

@Injectable()
export class MigrationService {
  private readonly jobs = new Map<string, ClioMigrationJob>();

  importClioCsv(tenantId: string, dto: ClioImportDto) {
    const jobId = randomUUID();
    const validation = this.validateClioCsv(dto);
    const now = new Date().toISOString();

    const job: ClioMigrationJob = {
      jobId,
      status: validation.errors.length > 0 ? 'FAILED' : 'QUEUED',
      provider: 'clio',
      tenantId,
      fileName: dto.fileName,
      rowCount: dto.rowCount,
      parsedRowCount: validation.parsedRowCount,
      entityTypes: dto.entityTypes ?? ['clients', 'matters', 'contacts'],
      validationErrors: validation.errors,
      message:
        validation.errors.length > 0
          ? 'Clio CSV validation failed'
          : 'Clio CSV validated and queued for import',
      queuedAt: now,
      updatedAt: now,
    };

    this.jobs.set(jobId, job);

    if (validation.errors.length === 0) {
      void this.simulateJobProgress(jobId);
    }

    return job;
  }

  getJobStatus(tenantId: string, jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.tenantId !== tenantId) {
      throw new NotFoundException('Migration job not found');
    }
    return job;
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

  private async simulateJobProgress(jobId: string) {
    const advance = (status: MigrationJobStatus, message: string) => {
      const job = this.jobs.get(jobId);
      if (!job) return;
      job.status = status;
      job.message = message;
      job.updatedAt = new Date().toISOString();
      if (status === 'COMPLETED' || status === 'FAILED') {
        job.completedAt = job.updatedAt;
      }
      this.jobs.set(jobId, job);
    };

    await new Promise((r) => setTimeout(r, 400));
    advance('VALIDATING', 'Validating Clio export mappings…');
    await new Promise((r) => setTimeout(r, 600));
    advance('PROCESSING', 'Importing clients and matters…');
    await new Promise((r) => setTimeout(r, 800));
    advance(
      'COMPLETED',
      `Imported ${this.jobs.get(jobId)?.parsedRowCount ?? 0} rows (stub worker; connect BullMQ for production).`,
    );
  }
}
