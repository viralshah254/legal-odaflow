import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { StorageModule } from '@/storage/storage.module';
import { AiModule } from '@/ai/ai.module';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { MeetingAccessService } from './meeting-access.service';

@Module({
  imports: [
    StorageModule,
    MulterModule.register({ dest: '/tmp' }),
    AiModule,
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService, MeetingAccessService],
  exports: [MeetingsService, MeetingAccessService],
})
export class MeetingsModule {}
