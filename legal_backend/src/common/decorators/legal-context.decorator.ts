import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { LegalRequestContext } from '../types/legal-request-context';

export const LegalContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): LegalRequestContext | undefined => {
    const request = ctx.switchToHttp().getRequest<{ legalContext?: LegalRequestContext }>();
    return request.legalContext;
  },
);
