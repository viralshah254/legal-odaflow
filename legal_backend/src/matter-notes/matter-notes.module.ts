import { Module } from '@nestjs/common';
import { MatterNotesController } from './matter-notes.controller';
import { MatterNotesService } from './matter-notes.service';

@Module({
  controllers: [MatterNotesController],
  providers: [MatterNotesService],
  exports: [MatterNotesService],
})
export class MatterNotesModule {}
