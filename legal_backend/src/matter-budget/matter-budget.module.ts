import { Module } from '@nestjs/common';
import { MatterBudgetController } from './matter-budget.controller';
import { MatterBudgetService } from './matter-budget.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [PrismaModule, AlertsModule],
  controllers: [MatterBudgetController],
  providers: [MatterBudgetService],
  exports: [MatterBudgetService],
})
export class MatterBudgetModule {}
