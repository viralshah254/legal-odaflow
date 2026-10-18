/**
 * Single routing policy for unified draft adapters (F10).
 */
export function isUnifiedDraftEngineEnabled(
  tenantId: string,
  userId: string,
  opts?: { allowlistTenants?: string[]; allowlistUsers?: string[] },
): boolean {
  if (process.env.UNIFIED_DRAFT_ENGINE_ENABLED !== 'true') return false;

  const tenantEnv = process.env.UNIFIED_DRAFT_ALLOWLIST_TENANTS ?? '';
  const userEnv = process.env.UNIFIED_DRAFT_ALLOWLIST_USERS ?? '';
  const allowTenants = (
    opts?.allowlistTenants ?? tenantEnv.split(',').map((s) => s.trim()).filter(Boolean)
  ).filter(Boolean);
  const allowUsers = (
    opts?.allowlistUsers ?? userEnv.split(',').map((s) => s.trim()).filter(Boolean)
  ).filter(Boolean);

  if (allowTenants.length > 0 && !allowTenants.includes(tenantId)) return false;
  if (allowUsers.length > 0 && !allowUsers.includes(userId)) return false;

  const pct = Math.min(100, Math.max(0, Number(process.env.UNIFIED_DRAFT_ENGINE_PERCENT ?? '0')));
  if (pct === 0) return false;
  if (pct >= 100) return true;

  let h = 0;
  const salt = tenantId + userId;
  for (let i = 0; i < salt.length; i++) {
    h = (Math.imul(31, h) + salt.charCodeAt(i)) >>> 0;
  }
  return h % 100 < pct;
}
