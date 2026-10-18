import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { CreateMatterNoteDto } from './dto/create-matter-note.dto';
import { MatterNotesService } from './matter-notes.service';

@Controller('matters/:matterId/notes')
@UseGuards(TenantGuard)
export class MatterNotesController {
  constructor(private readonly matterNotesService: MatterNotesService) {}

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.matterNotesService.findAll(
      tenantId,
      matterId,
      user.id,
      user.tenantRole,
    );
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateMatterNoteDto,
  ) {
    return this.matterNotesService.create(
      tenantId,
      matterId,
      user.id,
      user.tenantRole,
      dto,
    );
  }
}
