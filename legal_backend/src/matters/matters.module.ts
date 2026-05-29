import { Module, forwardRef } from '@nestjs/common';
import { AutomationsModule } from '@/automations/automations.module';
import { MattersController } from './matters.controller';
import { MattersService } from './matters.service';

@Module({
  imports: [forwardRef(() => AutomationsModule)],
  controllers: [MattersController],
  providers: [MattersService],
  exports: [MattersService],
})
export class MattersModule {}
