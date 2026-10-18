import { BadRequestException, Injectable } from '@nestjs/common';
import { LegalCorpusRegistryService } from './legal-corpus-registry.service';
import { KenyaSourcePolicyService } from './kenya-source-policy.service';
import {
  authorityLevelForKenyaDocument,
  type KenyaDocumentType,
  type KenyaProvisionInput,
} from './kenya-corpus.types';

export type KenyaExtendedCollection =
  | 'BILLS'
  | 'COUNTY_LAW'
  | 'TREATIES'
  | 'EAC_LAW'
  | 'REGULATOR';

const COLLECTION_POLICY: Record<
  KenyaExtendedCollection,
  { sourcePolicyKey: string; documentType: KenyaDocumentType }
> = {
  BILLS: { sourcePolicyKey: 'KENYA_PARLIAMENT', documentType: 'BILL' },
  COUNTY_LAW: { sourcePolicyKey: 'KENYA_COUNTY_LAW', documentType: 'COUNTY_ACT' },
  TREATIES: { sourcePolicyKey: 'KENYA_TREATIES', documentType: 'TREATY' },
  EAC_LAW: { sourcePolicyKey: 'EAC_LAW', documentType: 'EAC_INSTRUMENT' },
  REGULATOR: {
    sourcePolicyKey: 'KENYA_REGULATORS',
    documentType: 'REGULATOR_MATERIAL',
  },
};

@Injectable()
export class KenyaExtendedCorpusService {
  constructor(
    private readonly registry: LegalCorpusRegistryService,
    private readonly sourcePolicies: KenyaSourcePolicyService,
  ) {}

  async ingestText(input: {
    collection: KenyaExtendedCollection;
    workUri: string;
    expressionUri: string;
    expressionDate?: Date;
    title: string;
    sourceUrl: string;
    sourceName: string;
    text: string;
    provisions?: KenyaProvisionInput[];
    originalContent?: Buffer;
    originalMediaType?: string;
    countyCode?: string;
    parliamentaryStage?: string;
    chamber?: string;
    enactmentWorkUri?: string;
    treatyApplicability?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (input.collection === 'COUNTY_LAW' && !input.countyCode) {
      throw new BadRequestException('County legislation requires a countyCode');
    }
    if (input.collection === 'BILLS' && !input.parliamentaryStage) {
      throw new BadRequestException('Bills require parliamentaryStage metadata');
    }

    await this.sourcePolicies.seedDefaults();
    const mapping = COLLECTION_POLICY[input.collection];
    const authorityLevel = authorityLevelForKenyaDocument(mapping.documentType);
    const text = input.text.trim();
    if (!text) throw new BadRequestException('Corpus text cannot be empty');

    return this.registry.ingestKenyaExpression({
      workUri: input.workUri,
      expressionUri: input.expressionUri,
      expressionDate: input.expressionDate,
      title: input.title,
      documentType: mapping.documentType,
      authorityLevel,
      status: mapping.documentType === 'BILL' ? 'PROSPECTIVE' : 'UNKNOWN',
      officialSource: true,
      sourceUrl: input.sourceUrl,
      sourceName: input.sourceName,
      sourcePolicyKey: mapping.sourcePolicyKey,
      parserVersion: 'ke-extended-corpus-v1',
      extractionMethod: input.originalMediaType?.includes('xml') ? 'XML' : 'HTML',
      originalContent: input.originalContent,
      originalMediaType: input.originalMediaType,
      normalizedText: text,
      searchText: text,
      citationSafeText: text,
      provisions:
        input.provisions ??
        [
          {
            provisionKey: 'document:body',
            provisionType: 'DOCUMENT',
            ordinal: 0,
            text,
            citationSafeText: text,
          },
        ],
      metadata: {
        ...input.metadata,
        collection: input.collection,
        countyCode: input.countyCode,
        parliamentaryStage: input.parliamentaryStage,
        chamber: input.chamber,
        enactmentWorkUri: input.enactmentWorkUri,
        treatyApplicability: input.treatyApplicability,
        cannotSatisfyStatutoryAuthority: authorityLevel !== 'OFFICIAL_PRIMARY',
      },
    });
  }
}
