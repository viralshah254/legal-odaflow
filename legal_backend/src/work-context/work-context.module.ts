import { Module } from '@nestjs/common';
import { ClientsModule } from '@/clients/clients.module';
import { MattersModule } from '@/matters/matters.module';
import { WorkContextController } from './work-context.controller';
import { WorkContextService } from './work-context.service';

@Module({
  imports: [ClientsModule, MattersModule],
  controllers: [WorkContextController],
  providers: [WorkContextService],
  exports: [WorkContextService],
})
export class WorkContextModule {}
