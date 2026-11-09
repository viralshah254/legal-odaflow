/** FIFO concurrency limiter that works in both CommonJS and ESM runtimes. */
export default function concurrencyLimit(concurrency: number) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('Invalid concurrency');
  let active = 0;
  const queue: Array<() => void> = [];
  return <T>(work: () => Promise<T>): Promise<T> => new Promise<T>((resolve, reject) => {
    const start = () => {
      active++;
      Promise.resolve().then(work).then(resolve, reject).finally(() => {
        active--;
        queue.shift()?.();
      });
    };
    if (active < concurrency) start();
    else queue.push(start);
  });
}
