import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '@/auth/auth.module';
import { StorageModule } from '@/storage/storage.module';
import { AiModule } from '@/ai/ai.module';
import { MeetingsController } from './meetings.controller';
import { AudioTranscodeService } from './audio-transcode.service';
import { MeetingsService } from './meetings.service';
import { MeetingAccessService } from './meeting-access.service';
import { MeetingStreamingTranscriptionService } from './meeting-streaming-transcription.service';

@Module({
  imports: [
    AuthModule,
    StorageModule,
    MulterModule.register({ dest: '/tmp' }),
    AiModule,
  ],
  controllers: [MeetingsController],
  providers: [
    MeetingsService,
    MeetingAccessService,
    AudioTranscodeService,
    MeetingStreamingTranscriptionService,
  ],
  exports: [
    MeetingsService,
    MeetingAccessService,
    MeetingStreamingTranscriptionService,
  ],
})
export class MeetingsModule {}
