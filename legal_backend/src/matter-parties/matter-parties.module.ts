import { Module } from '@nestjs/common';
import { AccessModule } from '@/access/access.module';
import { MatterPartiesController } from './matter-parties.controller';
import { MatterPartiesService } from './matter-parties.service';

@Module({
  imports: [AccessModule],
  controllers: [MatterPartiesController],
  providers: [MatterPartiesService],
  exports: [MatterPartiesService],
})
export class MatterPartiesModule {}
