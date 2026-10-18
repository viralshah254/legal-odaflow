import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { DEFAULT_AUTO_MODEL } from '@/ai/model-costs.config';
import type { SectionFinderEntry } from './section-finder.types';

export interface TranslationFields {
  legacyTitle?: string;
  changeSummary?: string;
  practiceNote?: string;
  bailPosture?: string;
  punishment?: string;
  newTitle?: string;
}

@Injectable()
export class SectionFinderTranslationService {
  private readonly logger = new Logger(SectionFinderTranslationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly llm: LlmCompletionService | null,
  ) {}

  isEnglishLocale(locale?: string): boolean {
    if (!locale) return true;
    const normalized = locale.toLowerCase().split('-')[0];
    return normalized === 'en';
  }

  hashSourceText(fields: TranslationFields): string {
    const payload = JSON.stringify({
      legacyTitle: fields.legacyTitle ?? '',
      changeSummary: fields.changeSummary ?? '',
      practiceNote: fields.practiceNote ?? '',
      bailPosture: fields.bailPosture ?? '',
      punishment: fields.punishment ?? '',
      newTitle: fields.newTitle ?? '',
    });
    return createHash('sha256').update(payload).digest('hex');
  }

  async localizeEntry(
    entry: SectionFinderEntry,
    locale?: string,
    legalAuthorityId?: string,
  ): Promise<SectionFinderEntry> {
    if (this.isEnglishLocale(locale) || !legalAuthorityId) {
      return entry;
    }

    const localeCode = locale!.toLowerCase().split('-')[0];
    const sourceFields: TranslationFields = {
      legacyTitle: entry.legacyTitle,
      changeSummary: entry.changeSummary,
      practiceNote: entry.practiceNote,
      bailPosture: entry.bailPosture,
      punishment: entry.punishment,
      newTitle: entry.newTitle,
    };
    const sourceTextHash = this.hashSourceText(sourceFields);

    const cached = await this.prisma.legalAuthorityTranslation.findUnique({
      where: {
        legalAuthorityId_locale: {
          legalAuthorityId,
          locale: localeCode,
        },
      },
    });

    if (cached && cached.sourceTextHash === sourceTextHash) {
      return this.applyTranslation(entry, cached);
    }

    const translated = await this.translateFields(sourceFields, localeCode);
    if (!translated) return entry;

    const saved = await this.prisma.legalAuthorityTranslation.upsert({
      where: {
        legalAuthorityId_locale: {
          legalAuthorityId,
          locale: localeCode,
        },
      },
      create: {
        legalAuthorityId,
        locale: localeCode,
        title: translated.legacyTitle ?? entry.legacyTitle,
        summary: translated.changeSummary ?? entry.changeSummary,
        changeSummary: translated.changeSummary ?? entry.changeSummary,
        practiceNote: translated.practiceNote ?? entry.practiceNote ?? null,
        bailPosture: translated.bailPosture ?? entry.bailPosture,
        punishment: translated.punishment ?? entry.punishment,
        fullText: null,
        sourceTextHash,
        translatedBy: 'ai',
      },
      update: {
        title: translated.legacyTitle ?? entry.legacyTitle,
        summary: translated.changeSummary ?? entry.changeSummary,
        changeSummary: translated.changeSummary ?? entry.changeSummary,
        practiceNote: translated.practiceNote ?? entry.practiceNote ?? null,
        bailPosture: translated.bailPosture ?? entry.bailPosture,
        punishment: translated.punishment ?? entry.punishment,
        sourceTextHash,
        translatedBy: 'ai',
      },
    });

    return this.applyTranslation(entry, saved);
  }

  private applyTranslation(
    entry: SectionFinderEntry,
    translation: {
      title: string;
      changeSummary?: string | null;
      practiceNote?: string | null;
      bailPosture?: string | null;
      punishment?: string | null;
    },
  ): SectionFinderEntry {
    return {
      ...entry,
      legacyTitle: translation.title || entry.legacyTitle,
      changeSummary: translation.changeSummary ?? entry.changeSummary,
      practiceNote: translation.practiceNote ?? entry.practiceNote,
      bailPosture: translation.bailPosture ?? entry.bailPosture,
      punishment: translation.punishment ?? entry.punishment,
    };
  }

  private async translateFields(
    fields: TranslationFields,
    locale: string,
  ): Promise<TranslationFields | null> {
    if (!this.llm) return null;

    const systemPrompt =
      'You translate Indian legal statute section metadata accurately. ' +
      'Output ONLY valid JSON with the same keys as the input. ' +
      'Preserve section numbers, act acronyms (IPC, BNS, CGST, etc.), and legal terms. ' +
      'Do not add explanations.';

    const userPrompt = JSON.stringify({
      targetLocale: locale,
      fields,
    });

    try {
      const result = await this.llm.complete({
        modelName: DEFAULT_AUTO_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        maxTokens: 1200,
      });

      const parsed = JSON.parse(
        result.content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim(),
      ) as { fields?: TranslationFields } & TranslationFields;

      return parsed.fields ?? parsed;
    } catch (err) {
      this.logger.warn(
        `Translation failed for locale ${locale}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
