import { AsyncLocalStorage } from 'node:async_hooks';
import { GatewayTimeoutException } from '@nestjs/common';

type Budget = { deadlineAt: number; signal: AbortSignal };
const current = new AsyncLocalStorage<Budget>();
export function assertResearchBudgetActive(): void {
  const budget = current.getStore();
  if (budget && (budget.signal.aborted || Date.now() >= budget.deadlineAt)) {
    throw new GatewayTimeoutException('Research execution deadline exceeded');
  }
}
export function researchRequestSignal(timeoutMs?: number, existing?: AbortSignal): AbortSignal | undefined {
  assertResearchBudgetActive();
  const signals = [current.getStore()?.signal, existing, timeoutMs == null ? undefined : AbortSignal.timeout(timeoutMs)].filter((s): s is AbortSignal => Boolean(s));
  return signals.length ? AbortSignal.any(signals) : undefined;
}
/** Request-local cancellation reaches model calls, retries and source HTTP calls.
 * A child stage cannot extend its parent deadline. Timers/listeners are released. */
export async function withinResearchBudget<T>(timeoutMs: number, operation: () => Promise<T>): Promise<T> {
  assertResearchBudgetActive();
  const parent = current.getStore();
  const controller = new AbortController();
  const deadlineAt = Math.min(Date.now() + timeoutMs, parent?.deadlineAt ?? Infinity);
  const abort = () => controller.abort(parent?.signal.reason);
  parent?.signal.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    const expired = new Promise<never>((_, reject) => {
      onAbort = () => reject(new GatewayTimeoutException('Research execution deadline exceeded'));
      controller.signal.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => controller.abort(), Math.max(0, deadlineAt - Date.now()));
    });
    return await current.run({ deadlineAt, signal: controller.signal }, () => Promise.race([operation(), expired]));
  } finally {
    if (timer) clearTimeout(timer);
    if (onAbort) controller.signal.removeEventListener('abort', onAbort);
    parent?.signal.removeEventListener('abort', abort);
  }
}
