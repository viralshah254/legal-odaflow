import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface AdminTodoItem {
  id: string;
  templateId: string | null;
  title: string;
  description: string | null;
  category: string;
  completed: boolean;
  completedAt: Date | null;
  sortOrder: number;
  dueDate: string;
}

export interface AdminMeResponse {
  id: string;
  email: string;
  name: string | null;
  userType: string;
  adminProfile: string | null;
  displayTitle: string;
}

@Injectable()
export class AdminTodosService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminMe(userId: string): Promise<AdminMeResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, userType: true, adminProfile: true },
    });
    const displayTitle = user.adminProfile === 'CTO'
      ? 'Co-CEO / CTO'
      : user.adminProfile === 'CFO_CMO'
        ? 'Co-CEO / CFO / CMO'
        : 'Super Admin';
    return { ...user, displayTitle };
  }

  async listSuperAdmins() {
    return this.prisma.user.findMany({
      where: { userType: 'SUPER_ADMIN' },
      select: {
        id: true,
        email: true,
        name: true,
        adminProfile: true,
        isActive: true,
        createdAt: true,
        firstLoginAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getDailyTodos(userId: string, dateStr?: string): Promise<AdminTodoItem[]> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { adminProfile: true },
    });

    const today = dateStr ? new Date(dateStr) : new Date();
    today.setUTCHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();

    if (!user.adminProfile) return [];

    // Load applicable templates for today
    const templates = await this.prisma.adminTodoTemplate.findMany({
      where: {
        adminProfile: user.adminProfile,
        isActive: true,
        OR: [{ dayOfWeek: null }, { dayOfWeek: dayOfWeek }],
      },
      orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }],
    });

    if (templates.length === 0) return [];

    // Materialize completions for today
    const dueDateStr = today.toISOString().split('T')[0];

    const upsertOps = templates.map((t) =>
      this.prisma.adminTodoCompletion.upsert({
        where: {
          userId_templateId_dueDate: {
            userId,
            templateId: t.id,
            dueDate: today,
          },
        },
        create: {
          userId,
          templateId: t.id,
          title: t.title,
          description: t.description,
          category: t.category,
          dueDate: today,
          sortOrder: t.sortOrder,
        },
        update: {},
      }),
    );

    const completions = await this.prisma.$transaction(upsertOps);

    return completions.map((c) => ({
      id: c.id,
      templateId: c.templateId,
      title: c.title,
      description: c.description,
      category: c.category,
      completed: c.completed,
      completedAt: c.completedAt,
      sortOrder: c.sortOrder,
      dueDate: dueDateStr,
    }));
  }

  async toggleTodo(userId: string, todoId: string, completed: boolean): Promise<AdminTodoItem> {
    const completion = await this.prisma.adminTodoCompletion.findFirstOrThrow({
      where: { id: todoId, userId },
    });

    const updated = await this.prisma.adminTodoCompletion.update({
      where: { id: completion.id },
      data: {
        completed,
        completedAt: completed ? new Date() : null,
      },
    });

    return {
      id: updated.id,
      templateId: updated.templateId,
      title: updated.title,
      description: updated.description,
      category: updated.category,
      completed: updated.completed,
      completedAt: updated.completedAt,
      sortOrder: updated.sortOrder,
      dueDate: updated.dueDate.toISOString().split('T')[0],
    };
  }

  async createAdHocTodo(
    userId: string,
    input: { title: string; description?: string; category?: string },
  ): Promise<AdminTodoItem> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const item = await this.prisma.adminTodoCompletion.create({
      data: {
        userId,
        title: input.title,
        description: input.description,
        category: input.category ?? 'ops',
        dueDate: today,
        sortOrder: 999,
      },
    });

    return {
      id: item.id,
      templateId: null,
      title: item.title,
      description: item.description,
      category: item.category,
      completed: item.completed,
      completedAt: item.completedAt,
      sortOrder: item.sortOrder,
      dueDate: today.toISOString().split('T')[0],
    };
  }
}
