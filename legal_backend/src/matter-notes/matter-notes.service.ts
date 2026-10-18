import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatterAccessService } from '@/access/matter-access.service';
import { PrismaService } from '@/prisma/prisma.service';
import { EncryptionService } from '@/security/encryption.service';
import { CreateMatterNoteDto } from './dto/create-matter-note.dto';

type MatterNoteWithAuthor = {
  id: string;
  tenantId: string;
  matterId: string;
  body: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string | null; email: string };
};

@Injectable()
export class MatterNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
    private readonly encryption: EncryptionService,
  ) {}

  async findAll(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    await this.ensureMatterReadable(tenantId, matterId, userId, role);

    const notes = await this.prisma.matterNote.findMany({
      where: { tenantId, matterId },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return notes.map((note: MatterNoteWithAuthor) => this.formatNote(note));
  }

  async create(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
    dto: CreateMatterNoteDto,
  ) {
    await this.ensureMatterReadable(tenantId, matterId, userId, role);

    const plaintextBody = dto.body.trim();
    const note = await this.prisma.matterNote.create({
      data: {
        tenantId,
        matterId,
        body: this.encryption.encryptStringForStorage(
          plaintextBody,
          this.noteAad(tenantId, matterId),
        ),
        authorId: userId,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    const authorName = note.author.name ?? note.author.email.split('@')[0];
    await this.prisma.timelineEvent.create({
      data: {
        tenantId,
        matterId,
        eventType: 'NOTE_ADDED',
        title: 'Note added',
        description: plaintextBody,
        metadata: {
          userId,
          userName: authorName,
          noteId: note.id,
        },
        occurredAt: note.createdAt,
      },
    });

    return this.formatNote(note);
  }

  private formatNote(note: MatterNoteWithAuthor) {
    return {
      id: note.id,
      matterId: note.matterId,
      body:
        this.encryption.decryptStringFromStorage(
          note.body,
          this.noteAad(note.tenantId, note.matterId),
        ) ?? '',
      authorId: note.authorId,
      authorName: note.author.name ?? note.author.email.split('@')[0],
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  }

  private noteAad(tenantId: string, matterId: string) {
    return `matter-note:${tenantId}:${matterId}`;
  }

  private async ensureMatterReadable(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });

    if (!matter) {
      throw new NotFoundException('Matter not found');
    }

    if (this.matterAccess.hasFullAccess(role)) {
      return;
    }

    const access = await this.prisma.matterAccess.findUnique({
      where: { matterId_userId: { matterId, userId } },
    });

    if (!access) {
      throw new ForbiddenException('Matter access denied');
    }
  }
}
