/** Serialized polling with a wall-clock deadline, including a stalled poll.
 * Timing out stops waiting; it does not pretend to cancel or restart server work. */
export function pollResearchUntilDone<T>(poll: (signal: AbortSignal) => Promise<T | undefined>, options: { timeoutMs: number; intervalMs?: number }): Promise<T> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    let settled = false, next: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: unknown, value?: T) => {
      if (settled) return;
      settled = true; controller.abort(); clearTimeout(deadline); if (next) clearTimeout(next);
      if (error) reject(error); else resolve(value as T);
    };
    const deadline = setTimeout(() => finish(new Error('Research is taking longer than the request limit. Check research history before retrying; your existing job may still finish.')), options.timeoutMs);
    const tick = async () => {
      try {
        const result = await poll(controller.signal);
        if (settled) return;
        if (result !== undefined) finish(undefined, result);
        else next = setTimeout(() => void tick(), options.intervalMs ?? 2000);
      } catch (error) { finish(error); }
    };
    void tick();
  });
}
