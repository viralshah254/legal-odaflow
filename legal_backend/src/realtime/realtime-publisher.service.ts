import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';
import { Server } from 'socket.io';
import {
  REALTIME_EVENTS,
  type RealtimeEventName,
  type RealtimeEventPayload,
  tenantRoom,
  userRoom,
} from './realtime-events';

/** Redis channel for worker → API Socket.IO forwarding. */
export const REALTIME_BRIDGE_CHANNEL = 'legal:realtime:bridge';

type RealtimeBridgeMessage =
  | {
      kind: 'tenant';
      tenantId: string;
      event: RealtimeEventName;
      envelope: RealtimeEventPayload;
    }
  | {
      kind: 'user';
      userId: string;
      event: RealtimeEventName;
      envelope: RealtimeEventPayload;
    };

type RealtimeBridgeHandler = (message: RealtimeBridgeMessage) => void;

@Injectable()
export class RealtimePublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimePublisherService.name);
  private server: Server | null = null;
  private redisPub: RedisClientType | null = null;
  private redisSub: RedisClientType | null = null;
  private bridgeHandler: RealtimeBridgeHandler | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) return;

    try {
      this.redisPub = createClient({ url: redisUrl });
      this.redisSub = createClient({ url: redisUrl });
      await Promise.all([this.redisPub.connect(), this.redisSub.connect()]);

      await this.redisSub.subscribe(REALTIME_BRIDGE_CHANNEL, (raw) => {
        try {
          const message = JSON.parse(raw) as RealtimeBridgeMessage;
          this.bridgeHandler?.(message);
        } catch (error) {
          this.logger.warn(
            `Invalid realtime bridge message: ${error instanceof Error ? error.message : error}`,
          );
        }
      });

      this.logger.log('Realtime Redis bridge enabled');
    } catch (error) {
      this.logger.warn(
        `Realtime Redis bridge unavailable: ${error instanceof Error ? error.message : error}`,
      );
      this.redisPub = null;
      this.redisSub = null;
    }
  }

  async onModuleDestroy() {
    await Promise.all([
      this.redisPub?.quit().catch(() => undefined),
      this.redisSub?.quit().catch(() => undefined),
    ]);
    this.redisPub = null;
    this.redisSub = null;
  }

  setServer(server: Server) {
    this.server = server;
  }

  /** API gateway registers a handler to forward worker events to Socket.IO. */
  registerBridgeHandler(handler: RealtimeBridgeHandler) {
    this.bridgeHandler = handler;
  }

  publishToTenant(
    tenantId: string,
    event: RealtimeEventName,
    payload: Omit<RealtimeEventPayload, 'tenantId' | 'timestamp'>,
  ) {
    const envelope: RealtimeEventPayload = {
      tenantId,
      timestamp: new Date().toISOString(),
      ...payload,
    };

    if (this.server) {
      this.server.to(tenantRoom(tenantId)).emit(event, envelope);
      this.logger.debug(`emit ${event} -> ${tenantRoom(tenantId)}`);
      return;
    }

    void this.publishBridge({
      kind: 'tenant',
      tenantId,
      event,
      envelope,
    });
  }

  publishToUser(
    userId: string,
    event: RealtimeEventName,
    payload: Omit<RealtimeEventPayload, 'timestamp'> & { tenantId: string },
  ) {
    const envelope: RealtimeEventPayload = {
      timestamp: new Date().toISOString(),
      ...payload,
    };

    if (this.server) {
      this.server.to(userRoom(userId)).emit(event, envelope);
      this.logger.debug(`emit ${event} -> ${userRoom(userId)}`);
      return;
    }

    void this.publishBridge({
      kind: 'user',
      userId,
      event,
      envelope,
    });
  }

  publishDashboardRefresh(tenantId: string, entityId?: string) {
    this.publishToTenant(tenantId, REALTIME_EVENTS.DASHBOARD_METRICS_UPDATED, {
      entityId,
      action: 'refresh',
    });
  }

  private async publishBridge(message: RealtimeBridgeMessage) {
    if (!this.redisPub?.isReady) {
      this.logger.warn(
        `Dropped realtime event ${message.event} (no Socket.IO server or Redis bridge)`,
      );
      return;
    }

    await this.redisPub.publish(REALTIME_BRIDGE_CHANNEL, JSON.stringify(message));
    this.logger.debug(
      `bridge ${message.event} -> ${message.kind === 'tenant' ? tenantRoom(message.tenantId) : userRoom(message.userId)}`,
    );
  }
}
