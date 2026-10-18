function isRetryableDbError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Can't reach database") ||
    msg.includes('P1001') ||
    msg.includes('P1017') ||
    msg.includes('PrismaClientInitializationError') ||
    msg.includes('Connection refused') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('Server has closed the connection') ||
    msg.includes('Connection pool timeout') ||
    msg.includes('ECONNRESET') ||
    msg.includes('EPIPE')
  );
}

export async function retryDb<T>(
  fn: () => Promise<T>,
  opts?: { maxAttempts?: number; baseDelayMs?: number },
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? 10;
  const baseDelayMs = opts?.baseDelayMs ?? 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryableDbError(err) || attempt === maxAttempts) {
        throw err;
      }
      const delay = Math.min(baseDelayMs * attempt, 15000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('retryDb: unreachable');
}
