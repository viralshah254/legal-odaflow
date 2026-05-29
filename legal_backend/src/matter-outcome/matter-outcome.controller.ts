import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { UpdateOutcomeAnalysisDto } from './dto/outcome-analysis.dto';
import { MatterOutcomeService } from './matter-outcome.service';

@Controller('matters/:matterId/outcome-analysis')
@UseGuards(TenantGuard)
export class MatterOutcomeController {
  constructor(private readonly matterOutcomeService: MatterOutcomeService) {}

  @Post('generate')
  generate(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.matterOutcomeService.generate(
      tenantId,
      matterId,
      user.id,
      user.tenantRole,
    );
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.matterOutcomeService.findAll(
      tenantId,
      matterId,
      user.id,
      user.tenantRole,
    );
  }

  @Get(':id')
  findOne(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.matterOutcomeService.findOne(
      tenantId,
      matterId,
      id,
      user.id,
      user.tenantRole,
    );
  }

  @Patch(':id')
  update(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateOutcomeAnalysisDto,
  ) {
    return this.matterOutcomeService.update(
      tenantId,
      matterId,
      id,
      user.id,
      user.tenantRole,
      dto,
    );
  }
}
