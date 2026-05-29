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
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(TenantGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(tenantId, dto);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('matterId') matterId?: string,
    @Query('status') status?: string,
  ) {
    return this.tasksService.findAll(tenantId, matterId, status);
  }

  @Get(':taskId')
  findOne(@TenantId() tenantId: string, @Param('taskId') taskId: string) {
    return this.tasksService.findOne(tenantId, taskId);
  }

  @Patch(':taskId')
  update(
    @TenantId() tenantId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(tenantId, taskId, dto);
  }

  @Delete(':taskId')
  remove(@TenantId() tenantId: string, @Param('taskId') taskId: string) {
    return this.tasksService.remove(tenantId, taskId);
  }
}
