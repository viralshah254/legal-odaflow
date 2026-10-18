import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '@/prisma/prisma.module';
import { DraftingSessionModule } from '@/drafting-session/drafting-session.module';
import { AiModule } from '@/ai/ai.module';
import { UserDraftStyleService } from './user-draft-style.service';
import { UserDraftStyleController } from './user-draft-style.controller';

@Module({
  imports: [
    PrismaModule,
    DraftingSessionModule,
    AiModule,
    MulterModule.register({ storage: undefined }), // memory storage (buffers)
  ],
  controllers: [UserDraftStyleController],
  providers: [UserDraftStyleService],
  exports: [UserDraftStyleService],
})
export class UserDraftStyleModule {}
