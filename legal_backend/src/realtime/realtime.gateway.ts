import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { parseCorsOrigins } from '@/common/utils/cors-origins.util';
import { RealtimeAuthService } from './realtime-auth.service';
import { RealtimePublisherService } from './realtime-publisher.service';
import { PresenceService } from './presence.service';
import { tenantRoom, userRoom } from './realtime-events';
import { MeetingStreamingTranscriptionService } from '@/meetings/meeting-streaming-transcription.service';

interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
    tenantId?: string;
    email?: string;
    userType?: string;
    countryCode?: string | null;
    /** meetingId of an active streaming STT session on this socket, if any */
    streamingMeetingId?: string;
  };
}

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: parseCorsOrigins(),
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly authService: RealtimeAuthService,
    private readonly publisher: RealtimePublisherService,
    private readonly configService: ConfigService,
    private readonly presenceService: PresenceService,
    private readonly streamingTranscription: MeetingStreamingTranscriptionService,
  ) {}

  async afterInit(server: Server) {
    this.publisher.setServer(server);

    this.publisher.registerBridgeHandler((message) => {
      if (message.kind === 'tenant') {
        server.to(tenantRoom(message.tenantId)).emit(message.event, message.envelope);
      } else {
        server.to(userRoom(message.userId)).emit(message.event, message.envelope);
      }
    });

    // Authenticate during the Socket.IO handshake so client.data is populated
    // before any @SubscribeMessage handlers (e.g. meeting-transcribe:start) run.
    server.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          (socket.handshake.auth?.token as string | undefined) ??
          (socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '') as
            | string
            | undefined);
        const tenantId =
          (socket.handshake.auth?.tenantId as string | undefined) ??
          (socket.handshake.query?.tenantId as string | undefined);

        const auth = await this.authService.authenticateHandshake(token, tenantId);
        socket.data.userId = auth.userId;
        socket.data.tenantId = auth.tenantId;
        socket.data.email = auth.email;
        socket.data.userType = auth.userType;
        socket.data.countryCode = auth.countryCode;
        next();
      } catch (error) {
        next(
          error instanceof Error ? error : new Error('Authentication failed'),
        );
      }
    });

    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not set; using in-memory Socket.IO adapter');
      return;
    }

    try {
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      // Namespaced gateways expose the root IO server on `.server`.
      const rootServer =
        (server as unknown as { server?: Server }).server ?? server;
      rootServer.adapter(createAdapter(pubClient, subClient));
      this.logger.log('Socket.IO Redis adapter enabled');
    } catch (error) {
      this.logger.warn(
        `Redis adapter unavailable, using in-memory: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async handleConnection(client: AuthenticatedSocket) {
    const userId = client.data.userId;
    const tenantId = client.data.tenantId;
    if (!userId || !tenantId) {
      client.disconnect(true);
      return;
    }

    this.presenceService.upsert(userId, {
      userType: client.data.userType ?? null,
      countryCode: client.data.countryCode ?? null,
    });

    await client.join(tenantRoom(tenantId));
    await client.join(userRoom(userId));

    client.emit('connected', {
      tenantId,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.debug(
      `Socket disconnected user=${client.data.userId ?? 'unknown'} tenant=${client.data.tenantId ?? 'unknown'}`,
    );
    if (client.data.userId) {
      this.presenceService.remove(client.data.userId);
    }
    // Abort any open streaming session when socket drops
    if (client.data.tenantId && client.data.streamingMeetingId) {
      this.streamingTranscription.abortSession(client.data.tenantId, client.data.streamingMeetingId);
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    if (client.data.userId) {
      this.presenceService.upsert(client.data.userId, {
        userType: client.data.userType ?? null,
        countryCode: client.data.countryCode ?? null,
      });
    }
    return {
      event: 'pong',
      data: {
        tenantId: client.data.tenantId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // ── Live meeting transcription ───────────────────────────────────────────

  /**
   * Start a Deepgram streaming session for a meeting.
   * Emits meeting-transcribe:started (or meeting-transcribe:unavailable if
   * Deepgram is not configured, so the frontend falls back to Web Speech API).
   */
  @SubscribeMessage('meeting-transcribe:start')
  async handleTranscribeStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { meetingId: string },
  ) {
    const tenantId = client.data.tenantId;
    const userId = client.data.userId;
    if (!tenantId || !userId || !body?.meetingId) {
      client.emit('meeting-transcribe:error', { meetingId: body?.meetingId, message: 'Not authenticated.' });
      return;
    }

    if (!this.streamingTranscription.isAvailable()) {
      // Deepgram not configured — tell client to fall back to Web Speech
      client.emit('meeting-transcribe:unavailable', { meetingId: body.meetingId });
      return;
    }

    const started = await this.streamingTranscription.startSession(
      tenantId,
      body.meetingId,
      userId,
      (segment) => {
        client.emit('meeting-transcribe:result', {
          meetingId: body.meetingId,
          text: segment.text,
          startMs: segment.startMs,
          endMs: segment.endMs,
          isFinal: segment.isFinal,
        });
      },
      (message) => {
        client.emit('meeting-transcribe:error', { meetingId: body.meetingId, message });
      },
    );

    if (started) {
      client.data.streamingMeetingId = body.meetingId;
      client.emit('meeting-transcribe:started', { meetingId: body.meetingId });
    } else {
      client.emit('meeting-transcribe:unavailable', { meetingId: body.meetingId });
    }
  }

  /** Forward a binary PCM audio frame to the active Deepgram session. */
  @SubscribeMessage('meeting-transcribe:audio')
  handleTranscribeAudio(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { meetingId: string; chunk: Buffer | string },
  ) {
    const tenantId = client.data.tenantId;
    if (!tenantId || !body?.meetingId || !body?.chunk) return;

    const chunk = typeof body.chunk === 'string'
      ? Buffer.from(body.chunk, 'base64')
      : Buffer.from(body.chunk);

    this.streamingTranscription.sendAudio(tenantId, body.meetingId, chunk);
  }

  /** Close the streaming session, persist the draft transcript, and debit credits. */
  @SubscribeMessage('meeting-transcribe:stop')
  async handleTranscribeStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { meetingId: string },
  ) {
    const tenantId = client.data.tenantId;
    if (!tenantId || !body?.meetingId) return;

    const result = await this.streamingTranscription.stopSession(tenantId, body.meetingId);
    client.data.streamingMeetingId = undefined;
    client.emit('meeting-transcribe:stopped', {
      meetingId: body.meetingId,
      finalText: result.finalText,
      durationMs: result.durationMs,
    });
  }

  // ── End live meeting transcription ───────────────────────────────────────

  @SubscribeMessage('switch-tenant')
  async handleSwitchTenant(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { tenantId?: string },
  ) {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '') as
        | string
        | undefined);

    const auth = await this.authService.authenticateHandshake(
      token,
      body?.tenantId,
    );

    const previousTenant = client.data.tenantId;
    if (previousTenant) {
      await client.leave(tenantRoom(previousTenant));
    }

    client.data.tenantId = auth.tenantId;
    await client.join(tenantRoom(auth.tenantId));

    return {
      event: 'tenant-switched',
      data: { tenantId: auth.tenantId },
    };
  }
}
