import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BareActLookupService } from '@/legal-search/bare-act-lookup.service';
import { findStatuteById, findStatuteByManifestActId } from '@/legal-search/statute-registry';
import type { SectionFinderEntry } from './section-finder.types';
import { normalizeSectionText, resolvePracticeNote } from './section-finder-text';

export type StatuteSectionProfileRow = Awaited<
  ReturnType<PrismaService['statuteSectionProfile']['findMany']>
>[number];

@Injectable()
export class SectionFinderProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bareActLookup: BareActLookupService,
  ) {}

  async findProfile(
    countryCode: string,
    actId: string,
    sectionNumber: string,
  ) {
    const code = countryCode.toUpperCase();
    const normalizedSection = sectionNumber.toUpperCase();
    return this.prisma.statuteSectionProfile.findUnique({
      where: {
        countryCode_actId_sectionNumber: {
          countryCode: code,
          actId,
          sectionNumber: normalizedSection,
        },
      },
    });
  }

  async findProfileByLegacyKey(
    countryCode: string,
    legacyActId: string,
    legacySection: string,
  ) {
    const code = countryCode.toUpperCase();
    const normalizedSection = legacySection.toUpperCase();
    return this.prisma.statuteSectionProfile.findFirst({
      where: {
        countryCode: code,
        legacyActId,
        sectionNumber: normalizedSection,
      },
    });
  }

  async findProfileByNewAct(
    countryCode: string,
    newActId: string,
    newSection: string,
  ) {
    const code = countryCode.toUpperCase();
    const normalizedSection = newSection.toUpperCase();
    return this.prisma.statuteSectionProfile.findFirst({
      where: {
        countryCode: code,
        newActId,
        newSection: normalizedSection,
      },
    });
  }

  profileToEntry(
    profile: NonNullable<Awaited<ReturnType<SectionFinderProfileService['findProfile']>>>,
    matchSource: SectionFinderEntry['matchSource'] = 'curated',
    legalAuthorityId?: string,
  ): SectionFinderEntry {
    return {
      id: `${profile.legacyActShort.replace(/\s+/g, '_').toUpperCase()}-${profile.sectionNumber}`,
      legacyActId: profile.legacyActId as SectionFinderEntry['legacyActId'],
      legacyActShort: profile.legacyActShort,
      legacyActFull: profile.legacyActFull,
      legacySection: profile.sectionNumber,
      legacyTitle: profile.legacyTitle,
      newActId: profile.newActId as SectionFinderEntry['newActId'],
      newActShort: profile.newActShort,
      newActFull: profile.newActFull,
      newSection: profile.newSection,
      newTitle: profile.newTitle,
      changeType: profile.changeType as SectionFinderEntry['changeType'],
      changeSummary: profile.changeSummary,
      punishment: profile.punishment,
      isBailable: profile.isBailable,
      isCognizable: profile.isCognizable,
      isCompoundable: profile.isCompoundable,
      trialCourt: profile.trialCourt as SectionFinderEntry['trialCourt'],
      trialCourtLabel: profile.trialCourtLabel,
      bailPosture: profile.bailPosture,
      practiceNote: profile.practiceNote ?? undefined,
      sourceRef: profile.sourceRef,
      transitionDate: '2024-07-01',
      matchSource,
      tier: profile.tier as SectionFinderEntry['tier'],
      isInForce: profile.isInForce,
      legalAuthorityId: legalAuthorityId ?? profile.legalAuthorityId ?? undefined,
    };
  }

  async upsertFromCuratedEntry(
    countryCode: string,
    entry: SectionFinderEntry,
    actIdOverride?: string,
  ): Promise<void> {
    const code = countryCode.toUpperCase();
    const actId =
      actIdOverride ??
      (entry.legacyActId !== 'other' ? entry.legacyActId : this.resolveActIdFromEntry(entry));
    const sectionNumber = entry.legacySection.toUpperCase();
    const legalAuthorityId = this.bareActLookup.buildSectionId(code, actId, sectionNumber);

    const authorityExists = await this.prisma.legalAuthority.findUnique({
      where: { id: legalAuthorityId },
      select: { id: true },
    });

    await this.prisma.statuteSectionProfile.upsert({
      where: {
        countryCode_actId_sectionNumber: {
          countryCode: code,
          actId,
          sectionNumber,
        },
      },
      create: {
        countryCode: code,
        actId,
        sectionNumber,
        legacyActId: entry.legacyActId,
        legacyActShort: entry.legacyActShort,
        legacyActFull: entry.legacyActFull,
        legacyTitle: entry.legacyTitle,
        newActId: entry.newActId,
        newActShort: entry.newActShort,
        newActFull: entry.newActFull,
        newSection: entry.newSection,
        newTitle: entry.newTitle,
        changeType: entry.changeType,
        changeSummary: entry.changeSummary,
        punishment: entry.punishment,
        isBailable: entry.isBailable,
        isCognizable: entry.isCognizable,
        isCompoundable: entry.isCompoundable,
        trialCourt: entry.trialCourt,
        trialCourtLabel: entry.trialCourtLabel,
        bailPosture: entry.bailPosture,
        practiceNote: entry.practiceNote ?? null,
        sourceRef: entry.sourceRef,
        tier: entry.tier ?? 'crosswalk',
        isInForce: entry.isInForce ?? true,
        legalAuthorityId: authorityExists ? legalAuthorityId : null,
      },
      update: {
        legacyActId: entry.legacyActId,
        legacyActShort: entry.legacyActShort,
        legacyActFull: entry.legacyActFull,
        legacyTitle: entry.legacyTitle,
        newActId: entry.newActId,
        newActShort: entry.newActShort,
        newActFull: entry.newActFull,
        newSection: entry.newSection,
        newTitle: entry.newTitle,
        changeType: entry.changeType,
        changeSummary: entry.changeSummary,
        punishment: entry.punishment,
        isBailable: entry.isBailable,
        isCognizable: entry.isCognizable,
        isCompoundable: entry.isCompoundable,
        trialCourt: entry.trialCourt,
        trialCourtLabel: entry.trialCourtLabel,
        bailPosture: entry.bailPosture,
        practiceNote: entry.practiceNote ?? null,
        sourceRef: entry.sourceRef,
        tier: entry.tier ?? 'crosswalk',
        isInForce: entry.isInForce ?? true,
        legalAuthorityId: authorityExists ? legalAuthorityId : null,
      },
    });
  }

  private resolveActIdFromEntry(entry: SectionFinderEntry): string {
    const idPrefix = entry.id.split('-')[0]?.toLowerCase();
    if (idPrefix === 'income_tax') return 'income-tax';
    if (idPrefix === 'gst_act') return 'gst-act';
    if (idPrefix === 'customs_act') return 'customs-act';
    const statute = findStatuteById(entry.legacyActShort.toLowerCase().replace(/\s+/g, '-'));
    if (statute) return statute.id;
    return entry.legacyActId !== 'other' ? entry.legacyActId : 'other';
  }

  mergeProfileWithAuthority(
    profile: NonNullable<Awaited<ReturnType<SectionFinderProfileService['findProfile']>>>,
    authority: {
      id: string;
      title: string;
      summary?: string | null;
      fullText?: string | null;
      sourceName?: string | null;
    },
    matchSource: SectionFinderEntry['matchSource'],
  ): SectionFinderEntry {
    const entry = this.profileToEntry(profile, matchSource, authority.id);
    if (!entry.legacyTitle || entry.legacyTitle === profile.legacyTitle) {
      entry.legacyTitle =
        authority.title.replace(/^Section\s+\S+\s+/i, '').trim() || entry.legacyTitle;
    }
    entry.sectionText =
      entry.sectionText ?? normalizeSectionText(authority.fullText ?? authority.summary);
    if (authority.summary && !entry.practiceNote) {
      entry.practiceNote = resolvePracticeNote(authority.summary, entry.sectionText);
    }
    if (authority.sourceName) {
      entry.sourceRef = authority.sourceName;
    }
    return entry;
  }

  resolveRegistryActId(manifestActId: string): string | null {
    const statute =
      findStatuteByManifestActId(manifestActId, 'IN') ?? findStatuteById(manifestActId);
    return statute?.countryCode === 'IN' ? statute.id : null;
  }

  async suggestProfiles(q: string, countryCode: string, limit = 10) {
    const code = countryCode.toUpperCase();
    const token = q.trim();
    if (!token) return [];

    const upper = token.toUpperCase();
    const lower = token.toLowerCase();

    return this.prisma.statuteSectionProfile.findMany({
      where: {
        countryCode: code,
        OR: [
          { sectionNumber: { startsWith: upper, mode: 'insensitive' } },
          { newSection: { startsWith: upper, mode: 'insensitive' } },
          { legacyActShort: { contains: token, mode: 'insensitive' } },
          { legacyTitle: { contains: lower, mode: 'insensitive' } },
          { newTitle: { contains: lower, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ legacyActShort: 'asc' }, { sectionNumber: 'asc' }],
      take: limit,
    });
  }
}
