import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class WorkspaceExportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a markdown export of the workspace:
   *  - All canvas notes (chronological order)
   *  - Linked excerpts (with doc name + page ref)
   * Returns a plain text/markdown string.
   */
  async exportMarkdown(tenantId: string, workspaceId: string): Promise<string> {
    const workspace = await this.prisma.smartWorkspace.findFirst({
      where: { id: workspaceId, tenantId },
      include: {
        workspaceDocs: {
          include: { document: { select: { id: true, fileName: true } } },
          orderBy: { orderIndex: 'asc' },
        },
        canvasNodes: { orderBy: { createdAt: 'asc' } },
        annotations: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const docNameMap = new Map(workspace.workspaceDocs.map((d) => [d.documentId, d.document.fileName]));

    const lines: string[] = [
      `# ${workspace.title}`,
      `*Exported from Umbrella Smart Research Workspace*`,
      ``,
      `---`,
      ``,
    ]

    // Section 1: Source documents
    lines.push(`## Source Documents`)
    for (const wd of workspace.workspaceDocs) {
      lines.push(`- **${wd.document.fileName}**`)
    }
    lines.push(``)

    // Section 2: Canvas notes & cards
    lines.push(`## Research Notes`)
    for (const node of workspace.canvasNodes) {
      const content = node.content as Record<string, unknown>
      switch (node.type) {
        case 'note':
          lines.push(`### Note`)
          lines.push(String(content.text ?? ''))
          break
        case 'excerpt_card': {
          const docName = docNameMap.get(String(content.documentId ?? '')) ?? 'Unknown document'
          lines.push(`### Excerpt — *${docName}*${content.page ? ` (p. ${content.page})` : ''}`)
          lines.push(`> ${String(content.quote ?? '')}`)
          break
        }
        case 'timeline': {
          lines.push(`### Timeline`)
          const events = (content.events as Array<{ date: string; text: string }>) ?? []
          for (const ev of events) {
            lines.push(`- **${ev.date}** — ${ev.text}`)
          }
          break
        }
        case 'research_result':
          lines.push(`### Research: ${String(content.title ?? '')}`)
          lines.push(String(content.summary ?? ''))
          if (content.citation) lines.push(`*Citation: ${String(content.citation)}*`)
          break
      }
      lines.push(``)
    }

    // Section 3: All highlights
    if (workspace.annotations.length > 0) {
      lines.push(`## Highlights & Annotations`)
      for (const ann of workspace.annotations) {
        const anchor = ann.anchor as { quote?: string; page?: number }
        const docName = docNameMap.get(ann.documentId) ?? 'Unknown document'
        lines.push(
          `- [${ann.type.toUpperCase()}] *${docName}*${anchor.page ? ` p.${anchor.page}` : ''}: "${anchor.quote ?? ''}"`,
        )
        const content = ann.content as { text?: string } | null
        if (content?.text) lines.push(`  → ${content.text}`)
      }
    }

    return lines.join('\n')
  }
}
