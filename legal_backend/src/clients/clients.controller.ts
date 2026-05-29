import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
@UseGuards(TenantGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateClientDto) {
    return this.clientsService.create(tenantId, dto);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
  ) {
    return this.clientsService.findAll(tenantId, user.id, user.tenantRole, search);
  }

  @Get(':clientId')
  findOne(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('clientId') clientId: string,
  ) {
    return this.clientsService.findOne(tenantId, clientId, user.id, user.tenantRole);
  }

  @Patch(':clientId')
  update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('clientId') clientId: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(
      tenantId,
      clientId,
      user.id,
      user.tenantRole,
      dto,
    );
  }

  @Delete(':clientId')
  remove(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('clientId') clientId: string,
  ) {
    return this.clientsService.remove(tenantId, clientId, user.id, user.tenantRole);
  }
}
