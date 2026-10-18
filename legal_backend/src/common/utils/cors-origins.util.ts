export function parseCorsOrigins(
  value = process.env.CORS_ORIGINS ?? 'http://localhost:3000',
): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
