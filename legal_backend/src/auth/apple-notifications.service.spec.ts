import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { AppleNotificationsService } from './apple-notifications.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('AppleNotificationsService', () => {
  let service: AppleNotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppleNotificationsService,
        {
          provide: ConfigService,
          useValue: {
            get: (_key: string, defaultValue?: string) => defaultValue,
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
            refreshToken: { deleteMany: jest.fn() },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AppleNotificationsService);
  });

  it('rejects missing payload', async () => {
    await expect(service.handleNotification(undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
