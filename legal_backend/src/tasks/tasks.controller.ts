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
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AddTaskCommentDto } from './dto/add-comment.dto';
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
    @CurrentUser() user: RequestUser,
    @Query('matterId') matterId?: string,
    @Query('status') status?: string,
    @Query('all') all?: string,
  ) {
    // Partners/admins can pass ?all=1 to see all tasks, otherwise scoped to self
    const userId = all === '1' ? undefined : user.id;
    return this.tasksService.findAll(tenantId, matterId, status, userId);
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

  @Post(':taskId/comments')
  addComment(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('taskId') taskId: string,
    @Body() dto: AddTaskCommentDto,
  ) {
    return this.tasksService.addComment(tenantId, taskId, user.id, dto);
  }
}
