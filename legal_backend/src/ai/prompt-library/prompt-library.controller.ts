import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { PromptLibraryService } from './prompt-library.service';

@Controller('ai/prompt-library')
@UseGuards(TenantGuard)
export class PromptLibraryController {
  constructor(private readonly promptLibrary: PromptLibraryService) {}

  @Get()
  list(@TenantId() tenantId: string, @Query('category') category?: string) {
    return this.promptLibrary.list(tenantId, category);
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @Body()
    body: {
      title: string;
      description?: string;
      promptText: string;
      category?: string;
      deliverableType?: string;
    },
  ) {
    return this.promptLibrary.create(tenantId, body);
  }
}
