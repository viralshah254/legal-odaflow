import {
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
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
import { RealtimeAuthService } from './realtime-auth.service';
import { RealtimePublisherService } from './realtime-publisher.service';
import { tenantRoom, userRoom } from './realtime-events';

interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
    tenantId?: string;
    email?: string;
  };
}

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: true,
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
  ) {}

  async afterInit(server: Server) {
    this.publisher.setServer(server);

    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not set; using in-memory Socket.IO adapter');
      return;
    }

    try {
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      server.adapter(createAdapter(pubClient, subClient));
      this.logger.log('Socket.IO Redis adapter enabled');
    } catch (error) {
      this.logger.warn(
        `Redis adapter unavailable, using in-memory: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '') as
          | string
          | undefined);
      const tenantId =
        (client.handshake.auth?.tenantId as string | undefined) ??
        (client.handshake.query?.tenantId as string | undefined);

      const auth = await this.authService.authenticateHandshake(token, tenantId);
      client.data.userId = auth.userId;
      client.data.tenantId = auth.tenantId;
      client.data.email = auth.email;

      await client.join(tenantRoom(auth.tenantId));
      await client.join(userRoom(auth.userId));

      client.emit('connected', {
        tenantId: auth.tenantId,
        userId: auth.userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn(
        `Socket connection rejected: ${error instanceof Error ? error.message : error}`,
      );
      client.emit('error', {
        message:
          error instanceof UnauthorizedException
            ? error.message
            : 'Authentication failed',
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.debug(
      `Socket disconnected user=${client.data.userId ?? 'unknown'} tenant=${client.data.tenantId ?? 'unknown'}`,
    );
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    return {
      event: 'pong',
      data: {
        tenantId: client.data.tenantId,
        timestamp: new Date().toISOString(),
      },
    };
  }

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
