import { SetMetadata } from '@nestjs/common';
import type { AuditCategory } from './audit-event.service';

export const AUDIT_ACTION_KEY = 'audit_action';

export interface AuditActionMeta {
  category: AuditCategory;
  action: string;
}

/**
 * Decorator for controllers/methods to automatically record structured audit events.
 * Pair with AuditActionInterceptor to activate.
 *
 * @example
 * \@AuditAction('matter_access', 'matter.viewed')
 * \@Get(':id')
 * getMatter(@Param('id') id: string) { ... }
 */
export const AuditAction = (category: AuditCategory, action: string) =>
  SetMetadata<string, AuditActionMeta>(AUDIT_ACTION_KEY, { category, action });
