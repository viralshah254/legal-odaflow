import { Injectable } from '@nestjs/common';

export interface LegalChunk {
  text: string;
  type: 'section' | 'sub_section' | 'paragraph' | 'preamble' | 'schedule' | 'provision' | 'para_group';
  /** Structural label, e.g. "Section 5", "Explanation", "Proviso", "Schedule II" */
  label?: string;
  /** Character offset in the original text */
  startOffset: number;
  endOffset: number;
}

/**
 * Legal-aware text chunker that splits documents along structural boundaries
 * rather than fixed character counts.
 *
 * Priority order for split points:
 *  1. Act sections / articles / clauses (e.g. "Section 5.", "Article 3.")
 *  2. Sub-sections / sub-clauses (e.g. "(1)", "(a)")
 *  3. Schedules / Appendices
 *  4. Preamble / Whereas clauses
 *  5. Blank-line paragraph boundaries
 *  6. Hard-cap at MAX_CHUNK_CHARS with sentence-boundary fallback
 */
@Injectable()
export class LegalAwareChunkerService {
  private static readonly MAX_CHUNK_CHARS = 2000;
  private static readonly MIN_CHUNK_CHARS = 150;

  // Patterns that indicate a new structural unit begins on this line
  private static readonly SECTION_PATTERNS = [
    /^(SECTION|Section|SEC\.|Sec\.)\s+\d+[A-Z]?\s*[\.\-]/,
    /^(Article|ARTICLE)\s+\d+/,
    /^(Chapter|CHAPTER)\s+[IVXLCDM\d]+/i,
    /^(Part|PART)\s+[IVXLCDM\d]+/i,
    /^(Schedule|SCHEDULE|Appendix|APPENDIX)\s+[IVXLCDM\d\w]*/i,
    /^\d+\.\s+[A-Z]/,                     // "5. Short title and commencement."
    /^[A-Z][A-Z ]{4,}\s*[\.\:]?\s*$/,    // ALL-CAPS section headings
  ];

  private static readonly SUB_SECTION_PATTERNS = [
    /^\(\d+\)\s+/,      // "(1) ..."
    /^\([a-z]\)\s+/,    // "(a) ..."
    /^\([ivxl]+\)\s+/i, // "(i) ..."
    /^Proviso[\s\.\:]/i,
    /^Explanation[\s\.\:]/i,
    /^PROVIDED\s/,
    /^WHEREAS[\s\,]/,
  ];

  /**
   * Chunk the given text using legal structure as split boundaries.
   * Falls back to paragraph-level or character-level if no structure is detected.
   */
  chunk(text: string, documentType?: string): LegalChunk[] {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');

    const blocks = this.groupIntoBlocks(lines);
    const chunks: LegalChunk[] = [];
    let charOffset = 0;

    for (const block of blocks) {
      const blockText = block.lines.join('\n');
      const blockStart = charOffset;
      charOffset += blockText.length + 1; // +1 for the newline between blocks

      if (blockText.length <= LegalAwareChunkerService.MAX_CHUNK_CHARS) {
        if (blockText.trim().length >= LegalAwareChunkerService.MIN_CHUNK_CHARS) {
          chunks.push({
            text: blockText.trim(),
            type: block.type,
            label: block.label,
            startOffset: blockStart,
            endOffset: blockStart + blockText.length,
          });
        }
      } else {
        // Block too large — split at sentence boundaries
        const subChunks = this.splitAtSentences(blockText, block.type, block.label, blockStart);
        chunks.push(...subChunks);
      }
    }

    // Merge tiny consecutive chunks that are below MIN_CHUNK_CHARS
    return this.mergeTinyChunks(chunks);
  }

  /**
   * Convenience method returning plain text strings (compatible with old API).
   */
  chunkToStrings(text: string, documentType?: string): string[] {
    return this.chunk(text, documentType).map((c) => c.text);
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private groupIntoBlocks(
    lines: string[],
  ): Array<{ lines: string[]; type: LegalChunk['type']; label?: string }> {
    const blocks: Array<{ lines: string[]; type: LegalChunk['type']; label?: string }> = [];
    let current: string[] = [];
    let currentType: LegalChunk['type'] = 'paragraph';
    let currentLabel: string | undefined;

    const flush = () => {
      if (current.length > 0) {
        blocks.push({ lines: current, type: currentType, label: currentLabel });
        current = [];
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();

      // Blank line → paragraph boundary
      if (trimmed === '') {
        flush();
        currentType = 'paragraph';
        currentLabel = undefined;
        continue;
      }

      // Check for section-level header
      const sectionMatch = LegalAwareChunkerService.SECTION_PATTERNS.find((p) => p.test(trimmed));
      if (sectionMatch) {
        flush();
        currentType = this.classifySection(trimmed);
        currentLabel = trimmed.length <= 80 ? trimmed : trimmed.slice(0, 80);
        current.push(line);
        continue;
      }

      // Check for sub-section boundary
      const subMatch = LegalAwareChunkerService.SUB_SECTION_PATTERNS.find((p) => p.test(trimmed));
      if (subMatch && current.length > 0) {
        // Flush only if preceding block was a different sub-section
        const prevBlock = blocks[blocks.length - 1];
        if (prevBlock && prevBlock.type === 'sub_section') {
          flush();
          currentType = 'sub_section';
        } else {
          // Accumulate into current block unless it's already large
          const currentSize = current.join('\n').length;
          if (currentSize > LegalAwareChunkerService.MAX_CHUNK_CHARS) {
            flush();
            currentType = 'sub_section';
          }
        }
      }

      current.push(line);
    }

    flush();
    return blocks;
  }

  private classifySection(heading: string): LegalChunk['type'] {
    const upper = heading.toUpperCase();
    if (/SCHEDULE|APPENDIX/.test(upper)) return 'schedule';
    if (/WHEREAS|PREAMBLE/.test(upper)) return 'preamble';
    if (/SECTION|ARTICLE|CLAUSE/.test(upper)) return 'section';
    return 'provision';
  }

  private splitAtSentences(
    text: string,
    type: LegalChunk['type'],
    label: string | undefined,
    baseOffset: number,
  ): LegalChunk[] {
    // Split at ". " or ".\n" boundaries, keeping the period
    const sentenceRegex = /(?<=[.!?])\s+/g;
    const sentences = text.split(sentenceRegex);
    const chunks: LegalChunk[] = [];
    let buffer = '';
    let bufferStart = baseOffset;

    for (const sentence of sentences) {
      if ((buffer + sentence).length > LegalAwareChunkerService.MAX_CHUNK_CHARS && buffer.length > 0) {
        if (buffer.trim().length >= LegalAwareChunkerService.MIN_CHUNK_CHARS) {
          chunks.push({
            text: buffer.trim(),
            type,
            label,
            startOffset: bufferStart,
            endOffset: bufferStart + buffer.length,
          });
        }
        bufferStart = bufferStart + buffer.length;
        buffer = sentence + ' ';
      } else {
        buffer += sentence + ' ';
      }
    }

    if (buffer.trim().length >= LegalAwareChunkerService.MIN_CHUNK_CHARS) {
      chunks.push({
        text: buffer.trim(),
        type,
        label,
        startOffset: bufferStart,
        endOffset: bufferStart + buffer.length,
      });
    }

    return chunks;
  }

  private mergeTinyChunks(chunks: LegalChunk[]): LegalChunk[] {
    const merged: LegalChunk[] = [];
    let pending: LegalChunk | undefined;

    for (const chunk of chunks) {
      if (!pending) {
        pending = chunk;
        continue;
      }

      if (pending.text.length < LegalAwareChunkerService.MIN_CHUNK_CHARS) {
        // Merge pending into current
        pending = {
          text: pending.text + '\n' + chunk.text,
          type: pending.type,
          label: pending.label,
          startOffset: pending.startOffset,
          endOffset: chunk.endOffset,
        };
      } else {
        merged.push(pending);
        pending = chunk;
      }
    }

    if (pending) merged.push(pending);
    return merged;
  }
}
