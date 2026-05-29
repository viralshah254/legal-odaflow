import {
  Body,
  Controller,
  Delete,
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
import {
  CreateMatterArgumentDto,
  CreateMatterFactDto,
  CreateMatterIssueDto,
  CreateMatterStrategyMemoDto,
  UpdateMatterArgumentDto,
  UpdateMatterFactDto,
  UpdateMatterIssueDto,
  UpdateMatterStrategyMemoDto,
} from './dto/matter-intelligence.dto';
import { MatterIntelligenceService } from './matter-intelligence.service';

@Controller('matters/:matterId/facts')
@UseGuards(TenantGuard)
export class MatterFactsController {
  constructor(private readonly service: MatterIntelligenceService) {}

  @Post()
  create(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateMatterFactDto,
  ) {
    return this.service.createFact(tenantId, matterId, user.id, user.tenantRole, dto);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.findAllFacts(tenantId, matterId, user.id, user.tenantRole);
  }

  @Get(':factId')
  findOne(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('factId') factId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.findOneFact(tenantId, matterId, factId, user.id, user.tenantRole);
  }

  @Patch(':factId')
  update(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('factId') factId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateMatterFactDto,
  ) {
    return this.service.updateFact(tenantId, matterId, factId, user.id, user.tenantRole, dto);
  }

  @Delete(':factId')
  remove(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('factId') factId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.removeFact(tenantId, matterId, factId, user.id, user.tenantRole);
  }
}

@Controller('matters/:matterId/issues')
@UseGuards(TenantGuard)
export class MatterIssuesController {
  constructor(private readonly service: MatterIntelligenceService) {}

  @Post()
  create(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateMatterIssueDto,
  ) {
    return this.service.createIssue(tenantId, matterId, user.id, user.tenantRole, dto);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.findAllIssues(tenantId, matterId, user.id, user.tenantRole);
  }

  @Get(':issueId')
  findOne(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('issueId') issueId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.findOneIssue(tenantId, matterId, issueId, user.id, user.tenantRole);
  }

  @Patch(':issueId')
  update(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('issueId') issueId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateMatterIssueDto,
  ) {
    return this.service.updateIssue(tenantId, matterId, issueId, user.id, user.tenantRole, dto);
  }

  @Delete(':issueId')
  remove(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('issueId') issueId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.removeIssue(tenantId, matterId, issueId, user.id, user.tenantRole);
  }
}

@Controller('matters/:matterId/arguments')
@UseGuards(TenantGuard)
export class MatterArgumentsController {
  constructor(private readonly service: MatterIntelligenceService) {}

  @Post()
  create(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateMatterArgumentDto,
  ) {
    return this.service.createArgument(tenantId, matterId, user.id, user.tenantRole, dto);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.findAllArguments(tenantId, matterId, user.id, user.tenantRole);
  }

  @Get(':argumentId')
  findOne(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('argumentId') argumentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.findOneArgument(
      tenantId,
      matterId,
      argumentId,
      user.id,
      user.tenantRole,
    );
  }

  @Patch(':argumentId')
  update(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('argumentId') argumentId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateMatterArgumentDto,
  ) {
    return this.service.updateArgument(
      tenantId,
      matterId,
      argumentId,
      user.id,
      user.tenantRole,
      dto,
    );
  }

  @Delete(':argumentId')
  remove(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('argumentId') argumentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.removeArgument(
      tenantId,
      matterId,
      argumentId,
      user.id,
      user.tenantRole,
    );
  }
}

@Controller('matters/:matterId/strategy-memos')
@UseGuards(TenantGuard)
export class MatterStrategyMemosController {
  constructor(private readonly service: MatterIntelligenceService) {}

  @Post()
  create(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateMatterStrategyMemoDto,
  ) {
    return this.service.createStrategyMemo(tenantId, matterId, user.id, user.tenantRole, dto);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.findAllStrategyMemos(tenantId, matterId, user.id, user.tenantRole);
  }

  @Get(':memoId')
  findOne(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('memoId') memoId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.findOneStrategyMemo(
      tenantId,
      matterId,
      memoId,
      user.id,
      user.tenantRole,
    );
  }

  @Patch(':memoId')
  update(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('memoId') memoId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateMatterStrategyMemoDto,
  ) {
    return this.service.updateStrategyMemo(
      tenantId,
      matterId,
      memoId,
      user.id,
      user.tenantRole,
      dto,
    );
  }

  @Delete(':memoId')
  remove(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('memoId') memoId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.removeStrategyMemo(
      tenantId,
      matterId,
      memoId,
      user.id,
      user.tenantRole,
    );
  }
}
