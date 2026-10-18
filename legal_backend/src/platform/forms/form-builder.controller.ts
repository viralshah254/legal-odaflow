import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FormBuilderService, CreateFormDto } from './form-builder.service';

@Controller()
export class FormBuilderController {
  constructor(private readonly svc: FormBuilderService) {}

  @Post('forms')
  createForm(
    @Body() body: CreateFormDto & { tenantId?: string },
  ) {
    const { tenantId, ...dto } = body;
    return this.svc.createForm(tenantId ?? null, dto);
  }

  @Get('forms')
  listForms(
    @Query('tenantId') tenantId?: string,
    @Query('jurisdiction') jurisdiction?: string,
    @Query('documentType') documentType?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.listForms(tenantId, { jurisdiction, documentType, status });
  }

  @Get('forms/:id')
  getForm(
    @Param('id') id: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.svc.getForm(id, tenantId);
  }

  @Post('forms/:id/submissions')
  startSubmission(
    @Param('id') formId: string,
    @Body() body: { tenantId: string; userId: string; matterId?: string },
  ) {
    return this.svc.startSubmission(formId, body.tenantId, body.userId, body.matterId);
  }

  @Get('forms/:id/submissions')
  listSubmissionsForForm(
    @Param('id') formId: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.svc['prisma'].formSubmission.findMany({
      where: { formId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Patch('submissions/:id')
  updateAnswers(
    @Param('id') id: string,
    @Body() body: { tenantId: string; answers: Record<string, unknown> },
  ) {
    return this.svc.updateAnswers(id, body.tenantId, body.answers);
  }

  @Post('submissions/:id/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @Param('id') id: string,
    @Body() body: { tenantId: string },
  ) {
    return this.svc.completeSubmission(id, body.tenantId);
  }

  @Get('submissions/:id')
  getSubmission(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.svc.getSubmission(id, tenantId);
  }
}
