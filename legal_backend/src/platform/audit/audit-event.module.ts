import { Module } from '@nestjs/common';
import { AuditEventService } from './audit-event.service';
import { AuditActionInterceptor } from './audit-action.interceptor';

@Module({
  providers: [AuditEventService, AuditActionInterceptor],
  exports: [AuditEventService, AuditActionInterceptor],
})
export class AuditEventModule {}
