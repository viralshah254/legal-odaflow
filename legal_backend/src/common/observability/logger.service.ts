import { Injectable } from '@nestjs/common';

export interface StructuredLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;
  requestId?: string;
  workflowId?: string;
  tenantId?: string;
  userId?: string;
  feature?: string;
  durationMs?: number;
  costUsd?: number;
  outcome?: 'success' | 'failure' | 'partial';
  error?: string;
  metadata?: Record<string, unknown>;
}

type LogLevel = StructuredLogEntry['level'];

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'api_key',
  'apikey',
  'creditcard',
  'credit_card',
]);

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function resolveMinLevel(): LogLevel {
  const configured = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  if (configured in LOG_LEVEL_RANK) return configured as LogLevel;
  return 'info';
}

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const normalised = key.toLowerCase().replace(/[-\s]/g, '_');
    if (SENSITIVE_KEYS.has(normalised)) {
      result[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redact(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

@Injectable()
export class LoggerService {
  private readonly isDevelopment = process.env.NODE_ENV !== 'production';
  private readonly minLevel = resolveMinLevel();

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_RANK[level] >= LOG_LEVEL_RANK[this.minLevel];
  }

  private write(
    level: LogLevel,
    event: string,
    context?: Partial<StructuredLogEntry>,
    error?: Error,
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...context,
    };

    if (error) {
      entry.error = error.message;
      if (!entry.metadata) entry.metadata = {};
      if (error.stack) entry.metadata.stack = error.stack;
      if (error.name) entry.metadata.errorName = error.name;
    }

    if (entry.metadata) {
      entry.metadata = redact(entry.metadata);
    }

    const serialised = JSON.stringify(entry);

    if (this.isDevelopment) {
      const colour =
        level === 'error'
          ? '\x1b[31m'
          : level === 'warn'
          ? '\x1b[33m'
          : level === 'debug'
          ? '\x1b[90m'
          : '\x1b[36m';
      const reset = '\x1b[0m';
      const prefix = `${colour}[${level.toUpperCase()}]${reset} ${event}`;
      const extras = Object.entries(entry)
        .filter(([k]) => !['timestamp', 'level', 'event'].includes(k))
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(' ');
      console.log(`${prefix}${extras ? ' ' + extras : ''}`);
    } else {
      if (level === 'error' || level === 'warn') {
        console.error(serialised);
      } else {
        console.log(serialised);
      }
    }
  }

  info(event: string, context?: Partial<StructuredLogEntry>): void {
    this.write('info', event, context);
  }

  warn(event: string, context?: Partial<StructuredLogEntry>): void {
    this.write('warn', event, context);
  }

  error(
    event: string,
    error?: Error,
    context?: Partial<StructuredLogEntry>,
  ): void {
    this.write('error', event, context, error);
  }

  debug(event: string, context?: Partial<StructuredLogEntry>): void {
    this.write('debug', event, context);
  }
}
