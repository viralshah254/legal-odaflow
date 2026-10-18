import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { SuggestedTimeService } from '@/series-a/suggested-time.service';
import { BillingNarrativeService } from './billing-narrative.service';
import { EmailContextService } from './email-context.service';
import { OfficeService } from './office.service';

@Controller('ai/office')
@UseGuards(TenantGuard)
export class OfficeController {
  constructor(
    private readonly officeService: OfficeService,
    private readonly emailContext: EmailContextService,
    private readonly billingNarrativeService: BillingNarrativeService,
    private readonly suggestedTime: SuggestedTimeService,
  ) {}

  /** POST /ai/office/draft-amendments — Word: document-grounded clause amendments */
  @Post('draft-amendments')
  draftAmendments(
    @TenantId() tenantId: string,
    @Body()
    body: {
      documentText: string;
      instruction: string;
      matterId?: string;
      countryCode?: string;
    },
  ) {
    return this.officeService.draftAmendments({
      tenantId,
      documentText: body.documentText,
      instruction: body.instruction,
      matterId: body.matterId,
      countryCode: body.countryCode,
    });
  }

  /** POST /ai/office/email-context — Outlook: analyze thread + suggested actions */
  @Post('email-context')
  analyzeEmail(
    @TenantId() tenantId: string,
    @Body()
    body: {
      subject: string;
      body: string;
      threadItems?: Array<{ subject?: string; body?: string; from?: string }>;
      matterId?: string;
    },
  ) {
    return this.emailContext.analyzeEmail({
      tenantId,
      subject: body.subject,
      body: body.body,
      threadItems: body.threadItems,
      matterId: body.matterId,
    });
  }

  /** POST /ai/office/email-summarize */
  @Post('email-summarize')
  summarizeEmail(
    @TenantId() tenantId: string,
    @Body()
    body: {
      subject: string;
      body: string;
      threadItems?: Array<{ subject?: string; body?: string; from?: string }>;
    },
  ) {
    return this.emailContext.summarizeThread({
      tenantId,
      subject: body.subject,
      body: body.body,
      threadItems: body.threadItems,
    });
  }

  /** POST /ai/office/email-narratives — Outlook: billable time suggestions from email */
  @Post('email-narratives')
  async emailNarratives(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      subject: string;
      body: string;
      threadItems?: Array<{ subject?: string; body?: string; from?: string }>;
      matterId?: string;
      saveSuggestions?: boolean;
    },
  ) {
    const { narratives } = await this.emailContext.generateNarratives({
      tenantId,
      subject: body.subject,
      body: body.body,
      threadItems: body.threadItems,
      matterId: body.matterId,
    });

    const saved: string[] = [];
    if (body.saveSuggestions) {
      for (const n of narratives) {
        const row = await this.suggestedTime.suggest(tenantId, user.id, {
          matterId: body.matterId,
          source: 'OUTLOOK_NARRATIVE',
          minutes: n.minutes,
          narrative: n.narrative,
          metadata: { activityType: n.activityType, emailSubject: body.subject },
        });
        saved.push(row.id);
      }
    }

    return { narratives, savedSuggestionIds: saved };
  }

  /** POST /ai/office/billing-narrative — matter invoice narrative from activities */
  @Post('billing-narrative')
  billingNarrative(
    @TenantId() tenantId: string,
    @Body() body: { matterId: string },
  ) {
    return this.billingNarrativeService.generateForMatter(tenantId, body.matterId);
  }
}

/** Separate controller for copilot paths used by Outlook add-in */
@Controller('ai/copilot')
@UseGuards(TenantGuard)
export class CopilotOfficeController {
  constructor(private readonly emailContext: EmailContextService) {}

  @Post('extract-email')
  extractEmail(
    @Body() body: { emailBody: string; emailSubject: string },
  ) {
    return this.emailContext.extractEmailData(body.emailBody, body.emailSubject);
  }

  @Post('draft-reply')
  draftReply(
    @TenantId() tenantId: string,
    @Body()
    body: {
      emailBody: string;
      emailSubject: string;
      instruction?: string;
      matterId?: string;
      tone?: string;
    },
  ) {
    return this.emailContext.draftReply({
      tenantId,
      emailBody: body.emailBody,
      emailSubject: body.emailSubject,
      instruction: body.instruction,
      matterId: body.matterId,
      tone: body.tone,
    });
  }
}
