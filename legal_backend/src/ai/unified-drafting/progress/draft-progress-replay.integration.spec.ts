/**
 * C14 – Draft progress replay integration spec (B09 fix)
 *
 * Verifies:
 * 1. Sequence numbers are monotonically increasing per job.
 * 2. replaySince(jobId, lastSeq) returns only events after the given sequence.
 * 3. Duplicate events (same eventId) are dropped by the dedup mechanism.
 * 4. replaySince() returns empty array for unknown jobs.
 * 5. Terminal events (ready/failed) are persisted to the durable store.
 * 6. Events are delivered to subscribers via the Subject.
 * 7. Multiple concurrent jobs do not interfere with each other's sequences.
 */

// Mock ioredis BEFORE the service is imported so the constructor doesn't open
// a real socket.
jest.mock('ioredis', () => {
  const EventEmitter = require('events');
  return class FakeRedis extends EventEmitter {
    private store: Map<string, string[]> = new Map();
    constructor() { super(); }
    async publish() { return 0; }
    async rpush(key: string, ...vals: string[]) {
      const list = this.store.get(key) ?? [];
      list.push(...vals);
      this.store.set(key, list);
      return list.length;
    }
    async expire() { return 1; }
    async lrange(key: string, _s: number, _e: number) { return this.store.get(key) ?? []; }
    async psubscribe() { return undefined; }
    async quit() { return 'OK'; }
    on(event: string, cb: (...args: any[]) => void) { super.on(event, cb); return this; }
    _getStore() { return this.store; }
  };
});

import { DraftProgressService } from './draft-progress.service';
import { ConfigService } from '@nestjs/config';

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

function makeService() {
  const configService = { get: jest.fn((_key: string, def: string) => def) } as any;
  const service = new DraftProgressService(configService as ConfigService);

  // Access the fake Redis instances created by the mock
  const pub = (service as any).redisPub;
  const sub = (service as any).redisSub;

  // Spy on rpush/expire so tests can assert durability writes
  if (pub) {
    jest.spyOn(pub, 'rpush');
    jest.spyOn(pub, 'expire');
  }

  return { service, pub, sub };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('C14 – Draft progress: sequence numbering', () => {
  it('sequence is monotonically increasing per job', () => {
    const { service } = makeService();
    const events: number[] = [];

    service.emit({ jobId: 'job-1', stage: 'researching', status: 'generating', percent: 10, message: 'a' });
    service.emit({ jobId: 'job-1', stage: 'drafting', status: 'generating', percent: 50, message: 'b' });
    service.emit({ jobId: 'job-1', stage: 'reviewing', status: 'generating', percent: 80, message: 'c' });

    const log = (service as any).replayLog.get('job-1') as any[];
    log.forEach((e: any) => events.push(e.sequence));

    expect(events).toHaveLength(3);
    expect(events[0]).toBeLessThan(events[1]);
    expect(events[1]).toBeLessThan(events[2]);
  });

  it('different jobs have independent sequence counters', () => {
    const { service } = makeService();

    service.emit({ jobId: 'job-A', stage: 'queued', status: 'generating', percent: 0, message: 'a' });
    service.emit({ jobId: 'job-B', stage: 'queued', status: 'generating', percent: 0, message: 'a' });
    service.emit({ jobId: 'job-A', stage: 'researching', status: 'generating', percent: 20, message: 'b' });

    const logA = (service as any).replayLog.get('job-A') as any[];
    const logB = (service as any).replayLog.get('job-B') as any[];

    expect(logA).toHaveLength(2);
    expect(logB).toHaveLength(1);

    expect(logA[0].sequence).toBe(1);
    expect(logA[1].sequence).toBe(2);
    expect(logB[0].sequence).toBe(1);
  });
});

describe('C14 – Draft progress: replaySince()', () => {
  it('replaySince(jobId, 0) returns all events', () => {
    const { service } = makeService();

    service.emit({ jobId: 'job-1', stage: 'researching', status: 'generating', percent: 10, message: 'a' });
    service.emit({ jobId: 'job-1', stage: 'drafting', status: 'generating', percent: 50, message: 'b' });

    const events = service.replaySince('job-1', 0);
    expect(events).toHaveLength(2);
  });

  it('replaySince(jobId, 1) skips the first event', () => {
    const { service } = makeService();

    service.emit({ jobId: 'job-1', stage: 'researching', status: 'generating', percent: 10, message: 'a' });
    service.emit({ jobId: 'job-1', stage: 'drafting', status: 'generating', percent: 50, message: 'b' });
    service.emit({ jobId: 'job-1', stage: 'reviewing', status: 'generating', percent: 80, message: 'c' });

    const events = service.replaySince('job-1', 1);
    expect(events).toHaveLength(2);
    expect(events[0].percent).toBe(50);
    expect(events[1].percent).toBe(80);
  });

  it('replaySince(jobId, N) for N >= max returns empty', () => {
    const { service } = makeService();

    service.emit({ jobId: 'job-1', stage: 'queued', status: 'generating', percent: 0, message: 'a' });

    const events = service.replaySince('job-1', 999);
    expect(events).toHaveLength(0);
  });

  it('replaySince for unknown jobId returns empty', () => {
    const { service } = makeService();
    const events = service.replaySince('nonexistent-job', 0);
    expect(events).toHaveLength(0);
  });

  it('events are returned in sequence order', () => {
    const { service } = makeService();

    service.emit({ jobId: 'job-1', stage: 'queued', status: 'generating', percent: 0, message: 'step-1' });
    service.emit({ jobId: 'job-1', stage: 'researching', status: 'generating', percent: 25, message: 'step-2' });
    service.emit({ jobId: 'job-1', stage: 'drafting', status: 'generating', percent: 60, message: 'step-3' });

    const events = service.replaySince('job-1', 0);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].sequence).toBeGreaterThan(events[i - 1].sequence);
    }
  });
});

describe('C14 – Draft progress: deduplication', () => {
  it('duplicate eventId is dropped', () => {
    const { service } = makeService();

    const eventId = 'event-dup-1';
    service.emit({ jobId: 'job-1', stage: 'researching', status: 'generating', percent: 10, message: 'a', eventId });
    service.emit({ jobId: 'job-1', stage: 'researching', status: 'generating', percent: 10, message: 'a', eventId });

    const log = (service as any).replayLog.get('job-1') as any[];
    expect(log).toHaveLength(1);
  });

  it('different eventIds for same stage are both stored', () => {
    const { service } = makeService();

    service.emit({ jobId: 'job-1', stage: 'researching', status: 'generating', percent: 10, message: 'a', eventId: 'ev-1' });
    service.emit({ jobId: 'job-1', stage: 'researching', status: 'generating', percent: 10, message: 'b', eventId: 'ev-2' });

    const log = (service as any).replayLog.get('job-1') as any[];
    expect(log).toHaveLength(2);
  });
});

describe('C14 – Draft progress: durable terminal persistence', () => {
  it('terminal status "ready" is written to Redis durable store', () => {
    const { service, pub } = makeService();

    service.emit({ jobId: 'job-1', stage: 'complete', status: 'ready', percent: 100, message: 'done' });

    expect(pub.rpush).toHaveBeenCalled();
    const call = pub.rpush.mock.calls[0];
    expect(call[0]).toBe('draft-progress:replay:job-1');
    const stored = JSON.parse(call[1]);
    expect(stored.status).toBe('ready');
    expect(stored.jobId).toBe('job-1');
  });

  it('terminal status "failed" is persisted', () => {
    const { service, pub } = makeService();

    service.emit({ jobId: 'job-2', stage: 'error', status: 'failed', percent: 0, message: 'error' });

    expect(pub.rpush).toHaveBeenCalled();
  });

  it('in-progress events are NOT written to durable store', () => {
    const { service, pub } = makeService();

    service.emit({ jobId: 'job-1', stage: 'researching', status: 'generating', percent: 25, message: 'working' });

    expect(pub.rpush).not.toHaveBeenCalled();
  });

  it('replayDurable() reads from Redis list', async () => {
    const { service } = makeService();

    // redisSub is used for lrange reads; seed its store directly
    const sub = (service as any).redisSub;
    const terminal = { jobId: 'job-1', stage: 'complete', status: 'ready', percent: 100, message: 'done', eventId: 'ev-t', sequence: 5, timestamp: '2026-01-01T00:00:00Z' };
    sub._getStore().set('draft-progress:replay:job-1', [JSON.stringify(terminal)]);

    const events = await service.replayDurable('job-1');
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('ready');
  });
});

describe('C14 – Draft progress: subscriber delivery', () => {
  it('emit() delivers to active subscriber', () => {
    const { service } = makeService();
    const received: any[] = [];

    const subject = service.subscribe('job-1');
    subject.subscribe((e) => received.push(e));

    service.emit({ jobId: 'job-1', stage: 'researching', status: 'generating', percent: 10, message: 'working' });

    expect(received).toHaveLength(1);
    expect(received[0].percent).toBe(10);
  });

  it('terminal event completes the subject', () => {
    const { service } = makeService();
    let completed = false;

    const subject = service.subscribe('job-1');
    subject.subscribe({ complete: () => { completed = true; } });

    service.emit({ jobId: 'job-1', stage: 'complete', status: 'ready', percent: 100, message: 'done' });

    expect(completed).toBe(true);
  });
});
