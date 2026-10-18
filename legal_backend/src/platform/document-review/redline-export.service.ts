/**
 * Converts review redlines into Office.js edit operations for Word tracked changes.
 */

import { Injectable } from '@nestjs/common';
import type {
  DocumentStructure,
  Redline,
  RedlineEditOp,
  RedlineChangeType,
  FindingSeverity,
} from './document-review.types';

@Injectable()
export class RedlineExportService {
  toEditOps(redlines: Redline[], structure?: DocumentStructure): RedlineEditOp[] {
    return redlines.map((r) => this.toEditOp(r, structure));
  }

  toEditOp(redline: Redline, structure?: DocumentStructure): RedlineEditOp {
    const changeType = redline.changeType ?? this.inferChangeType(redline);
    const anchorText =
      redline.anchorText ??
      this.buildAnchorText(redline.originalText, structure?.rawText);

    return {
      id: redline.id,
      changeType,
      anchorText,
      originalText: redline.originalText,
      proposedText: redline.proposedText,
      rationale: redline.reason,
      severity: (redline.severity ?? redline.riskLevel) as FindingSeverity,
      sectionRef: redline.sectionRef,
      paragraphIndex: redline.paragraphIndex ?? this.findParagraphIndex(structure, anchorText),
      addComment: true,
    };
  }

  private inferChangeType(redline: Redline): RedlineChangeType {
    if (!redline.originalText?.trim()) return 'insert';
    if (!redline.proposedText?.trim()) return 'delete';
    return 'replace';
  }

  private buildAnchorText(originalText: string, rawText?: string): string {
    const trimmed = originalText.trim();
    if (!trimmed) return '';

    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length <= 8) return trimmed.slice(0, 120);

    const snippet = words.slice(0, 8).join(' ');
    if (rawText && rawText.includes(snippet)) return snippet;

    return trimmed.slice(0, 80);
  }

  private findParagraphIndex(structure: DocumentStructure | undefined, anchor: string): number | undefined {
    if (!structure?.rawText || !anchor) return undefined;
    const paragraphs = structure.rawText.split(/\n\s*\n/);
    const idx = paragraphs.findIndex((p) => p.includes(anchor));
    return idx >= 0 ? idx : undefined;
  }
}
