import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  REALTIME_EVENTS,
  type RealtimeEventName,
  type RealtimeEventPayload,
  tenantRoom,
  userRoom,
} from './realtime-events';

@Injectable()
export class RealtimePublisherService {
  private readonly logger = new Logger(RealtimePublisherService.name);
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  publishToTenant(
    tenantId: string,
    event: RealtimeEventName,
    payload: Omit<RealtimeEventPayload, 'tenantId' | 'timestamp'>,
  ) {
    if (!this.server) return;

    const envelope: RealtimeEventPayload = {
      tenantId,
      timestamp: new Date().toISOString(),
      ...payload,
    };

    this.server.to(tenantRoom(tenantId)).emit(event, envelope);
    this.logger.debug(`emit ${event} -> ${tenantRoom(tenantId)}`);
  }

  publishToUser(
    userId: string,
    event: RealtimeEventName,
    payload: Omit<RealtimeEventPayload, 'timestamp'> & { tenantId: string },
  ) {
    if (!this.server) return;

    const envelope: RealtimeEventPayload = {
      timestamp: new Date().toISOString(),
      ...payload,
    };

    this.server.to(userRoom(userId)).emit(event, envelope);
    this.logger.debug(`emit ${event} -> ${userRoom(userId)}`);
  }

  publishDashboardRefresh(tenantId: string, entityId?: string) {
    this.publishToTenant(tenantId, REALTIME_EVENTS.DASHBOARD_METRICS_UPDATED, {
      entityId,
      action: 'refresh',
    });
  }
}
