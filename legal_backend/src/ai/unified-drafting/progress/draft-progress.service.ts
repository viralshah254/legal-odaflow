import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { Subject } from 'rxjs';
import type { DraftProgressEvent } from '../contracts/draft-progress-event';

interface JobChannel {
  subject: Subject<DraftProgressEvent>;
  subscribers: number;
}

/**
 * Draft progress: in-process subjects plus Redis pub/sub for API/worker split.
 */
@Injectable()
export class DraftProgressService implements OnModuleDestroy {
  private readonly logger = new Logger(DraftProgressService.name);
  private readonly channels = new Map<string, JobChannel>();
  private readonly sequenceByJob = new Map<string, number>();
  private readonly recentEventIds = new Map<string, Set<string>>();
  private redisPub: Redis | null = null;
  private redisSub: Redis | null = null;
  private readonly redisChannelPrefix = 'draft-progress:';

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    try {
      this.redisPub = new Redis(url, { maxRetriesPerRequest: 3 });
      this.redisSub = new Redis(url, { maxRetriesPerRequest: 3 });
      this.redisSub.on('pmessage', (_pattern, channel, message) => {
        if (!channel.startsWith(this.redisChannelPrefix)) return;
        const jobId = channel.slice(this.redisChannelPrefix.length);
        try {
          const event = JSON.parse(message) as DraftProgressEvent;
          this.deliverLocal(jobId, event);
        } catch {
          this.logger.warn(`Invalid progress payload on ${channel}`);
        }
      });
      this.redisSub.psubscribe(`${this.redisChannelPrefix}*`).catch(() => {
        this.logger.warn('Redis progress subscribe unavailable — local-only mode');
      });
    } catch {
      this.logger.warn('Redis progress transport unavailable — local-only mode');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redisPub?.quit();
    await this.redisSub?.quit();
  }

  emit(partial: Omit<DraftProgressEvent, 'eventId' | 'sequence' | 'timestamp'> & Partial<Pick<DraftProgressEvent, 'eventId' | 'sequence' | 'timestamp'>>): void {
    const sequence = partial.sequence ?? (this.sequenceByJob.get(partial.jobId) ?? 0) + 1;
    this.sequenceByJob.set(partial.jobId, sequence);
    const event: DraftProgressEvent = {
      ...partial,
      eventId: partial.eventId ?? randomUUID(),
      sequence,
      timestamp: partial.timestamp ?? new Date().toISOString(),
    };
    const seen = this.recentEventIds.get(event.jobId) ?? new Set<string>();
    if (seen.has(event.eventId)) return;
    seen.add(event.eventId);
    if (seen.size > 200) {
      const oldest = seen.values().next().value;
      if (oldest) seen.delete(oldest);
    }
    this.recentEventIds.set(event.jobId, seen);
    this.deliverLocal(event.jobId, event);
    const payload = JSON.stringify(event);
    this.redisPub
      ?.publish(`${this.redisChannelPrefix}${event.jobId}`, payload)
      .catch((err) => this.logger.debug(`Redis publish failed: ${String(err)}`));
    if (['ready', 'failed', 'cancelled', 'blocked'].includes(event.status)) {
      this.persistTerminal(event);
    }
  }

  subscribe(jobId: string): Subject<DraftProgressEvent> {
    let channel = this.channels.get(jobId);
    if (!channel || channel.subject.closed) {
      channel = { subject: new Subject<DraftProgressEvent>(), subscribers: 0 };
      this.channels.set(jobId, channel);
    }
    channel.subscribers += 1;
    return channel.subject;
  }

  /** Disconnect one SSE client without closing other subscribers. */
  releaseSubscriber(jobId: string): void {
    const channel = this.channels.get(jobId);
    if (!channel) return;
    channel.subscribers = Math.max(0, channel.subscribers - 1);
    if (channel.subscribers === 0 && channel.subject.closed) {
      this.channels.delete(jobId);
    }
  }

  private deliverLocal(jobId: string, event: DraftProgressEvent): void {
    const channel = this.channels.get(jobId);
    if (channel && !channel.subject.closed) {
      channel.subject.next(event);
    }
    if (['ready', 'failed', 'cancelled', 'blocked'].includes(event.status)) {
      channel?.subject.complete();
      if (channel && channel.subscribers === 0) {
        this.channels.delete(jobId);
      }
    }
  }

  private persistTerminal(_event: DraftProgressEvent): void {
    // Durable replay is served via DraftJob status + stageResults polling (U18).
  }
}
