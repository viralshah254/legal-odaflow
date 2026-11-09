export function parseCorsOrigins(
  value = process.env.CORS_ORIGINS ?? 'http://localhost:3000',
): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** Resolve after ConfigModule loads the mounted env, rather than at decorator import time. */
export function resolveCorsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allowed?: boolean) => void,
): void {
  callback(null, !origin || parseCorsOrigins().includes(origin));
}
