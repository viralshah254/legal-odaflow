/**
 * Helpers for separating statutory section text from advocate practice notes.
 */

import { truncateAtSentence } from '../text-truncate';
import {
  isPrimarilyTableOrScheduleText,
  stripEmbeddedSchedulesAndTables,
} from '../section-text-sanitize';
import type { SectionFinderEntry } from './section-finder.types';

const MAX_SECTION_TEXT_DISPLAY = 4000;
const MAX_SUGGEST_TITLE = 120;

export function normalizeSectionText(fullText: string | null | undefined): string | undefined {
  const trimmed = fullText?.trim();
  if (!trimmed) return undefined;

  const cleaned = stripEmbeddedSchedulesAndTables(trimmed);
  if (!cleaned || isPrimarilyTableOrScheduleText(cleaned)) {
    return undefined;
  }

  if (cleaned.length > MAX_SECTION_TEXT_DISPLAY) {
    return truncateAtSentence(cleaned, MAX_SECTION_TEXT_DISPLAY);
  }

  return cleaned;
}

/** True when note is genuine advocate guidance, not a bare-act text dump. */
export function isAdvocatePracticeNote(
  note: string | undefined | null,
  sectionText: string | undefined | null,
): boolean {
  const trimmedNote = note?.trim()
  if (!trimmedNote) return false
  const trimmedSection = sectionText?.trim()
  if (!trimmedSection) return true

  const normalizedNote = trimmedNote.replace(/\s+/g, ' ')
  const normalizedSection = trimmedSection.replace(/\s+/g, ' ')

  if (normalizedSection.startsWith(normalizedNote)) return false
  if (normalizedNote.startsWith(normalizedSection.slice(0, Math.min(120, normalizedSection.length)))) {
    return false
  }
  if (normalizedNote.length >= normalizedSection.length * 0.9) return false

  return true
}

/** Returns advocate practice note when distinct from bare-act text; otherwise undefined. */
export function resolvePracticeNote(
  note: string | undefined | null,
  sectionText: string | undefined | null,
): string | undefined {
  const trimmedNote = note?.trim();
  if (!trimmedNote) return undefined;
  if (!isAdvocatePracticeNote(trimmedNote, sectionText)) return undefined;
  return trimmedNote;
}

export function normalizeSectionTitle(title: string | null | undefined): string {
  const trimmed = title?.trim();
  if (!trimmed) return '';

  const cleaned = stripEmbeddedSchedulesAndTables(trimmed);
  const firstLine = cleaned.split('\n').find((line) => line.trim().length > 0)?.trim() ?? cleaned;
  if (!firstLine || isPrimarilyTableOrScheduleText(firstLine)) {
    return '';
  }

  if (firstLine.length <= 160) {
    return firstLine;
  }

  return `${firstLine.slice(0, 160).trim()}…`;
}

/** Short title for typeahead / popular chips — never return schedule dumps. */
export function truncateSuggestTitle(
  title: string | null | undefined,
  maxLen = MAX_SUGGEST_TITLE,
): string | undefined {
  const normalized = normalizeSectionTitle(title);
  if (!normalized) return undefined;
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen - 1).trim()}…`;
}

function safeEntryTitle(entry: SectionFinderEntry): string {
  const normalized = normalizeSectionTitle(entry.legacyTitle);
  if (normalized) return normalized;
  if (entry.legacyActShort && entry.legacySection) {
    return `${entry.legacyActShort} §${entry.legacySection}`;
  }
  return 'Section';
}

export function sanitizeSectionFinderEntry(entry: SectionFinderEntry): SectionFinderEntry {
  const legacyTitle = safeEntryTitle(entry);
  const newTitle = entry.newTitle
    ? normalizeSectionTitle(entry.newTitle) || entry.newTitle
    : entry.newTitle;
  const sectionText = normalizeSectionText(entry.sectionText);
  const practiceNote = resolvePracticeNote(entry.practiceNote, sectionText);

  return {
    ...entry,
    legacyTitle,
    newTitle,
    sectionText,
    practiceNote,
  };
}
