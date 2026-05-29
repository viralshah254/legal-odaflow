type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function resolveMinLevel(): LogLevel {
  const configured = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  if (configured in LOG_LEVELS) {
    return configured as LogLevel;
  }
  return 'info';
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[resolveMinLevel()];
}

function write(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
): void {
  if (!shouldLog(level)) {
    return;
  }

  const entry: Record<string, unknown> = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  if (context && Object.keys(context).length > 0) {
    entry.context = context;
  }

  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    write('debug', message, context);
  },
  info(message: string, context?: Record<string, unknown>): void {
    write('info', message, context);
  },
  warn(message: string, context?: Record<string, unknown>): void {
    write('warn', message, context);
  },
  error(message: string, context?: Record<string, unknown>): void {
    write('error', message, context);
  },
};
