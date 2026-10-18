import { BadRequestException, Injectable } from '@nestjs/common';
import { KenyaSourcePolicyService } from '../kenya-source-policy.service';
import type { KenyaExtendedCollection } from '../kenya-extended-corpus.service';

export interface KenyaOfficialDocumentLink {
  collection: KenyaExtendedCollection;
  title: string;
  sourceUrl: string;
  metadata: Record<string, string>;
}

const COLLECTIONS: Record<
  KenyaExtendedCollection,
  { policyKey: string; allowedHosts: string[]; defaultUrl: string }
> = {
  BILLS: {
    policyKey: 'KENYA_PARLIAMENT',
    allowedHosts: ['www.parliament.go.ke', 'parliament.go.ke'],
    defaultUrl: 'https://www.parliament.go.ke/the-national-assembly/house-business/bills',
  },
  COUNTY_LAW: {
    policyKey: 'KENYA_COUNTY_LAW',
    allowedHosts: ['new.kenyalaw.org'],
    defaultUrl: 'https://new.kenyalaw.org/legislation/county/',
  },
  TREATIES: {
    policyKey: 'KENYA_TREATIES',
    allowedHosts: ['new.kenyalaw.org'],
    defaultUrl: 'https://new.kenyalaw.org/treaties/',
  },
  EAC_LAW: {
    policyKey: 'EAC_LAW',
    allowedHosts: ['www.eac.int', 'eac.int', 'www.eacj.org', 'eacj.org'],
    defaultUrl: 'https://www.eac.int/documents/category/acts-of-the-community',
  },
  REGULATOR: {
    policyKey: 'KENYA_REGULATORS',
    allowedHosts: [],
    defaultUrl: 'https://www.go.ke',
  },
};

@Injectable()
export class KenyaOfficialCollectionsConnector {
  constructor(private readonly policies: KenyaSourcePolicyService) {}

  async discover(
    collection: KenyaExtendedCollection,
    inputUrl?: string,
    options: { production?: boolean } = {},
  ): Promise<KenyaOfficialDocumentLink[]> {
    const profile = COLLECTIONS[collection];
    const url = this.validateUrl(profile, inputUrl ?? profile.defaultUrl);
    await this.policies.assertFetchAllowed(profile.policyKey, options);
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'UmbrellaLegalCorpus/1.0 (+source-compliance)',
      },
      signal: AbortSignal.timeout(60_000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`${profile.policyKey} returned ${response.status}`);
    return parseCollectionLinks(collection, await response.text(), url.toString(), profile.allowedHosts);
  }

  private validateUrl(
    profile: (typeof COLLECTIONS)[KenyaExtendedCollection],
    value: string,
  ): URL {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      profile.allowedHosts.length === 0 ||
      !profile.allowedHosts.includes(url.hostname)
    ) {
      throw new BadRequestException(`Source URL is not allowlisted: ${value}`);
    }
    return url;
  }
}

export function parseCollectionLinks(
  collection: KenyaExtendedCollection,
  html: string,
  baseUrl: string,
  allowedHosts: string[],
): KenyaOfficialDocumentLink[] {
  const results: KenyaOfficialDocumentLink[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!isLikelyCollectionDocument(collection, title, match[1])) continue;
    const url = new URL(match[1], baseUrl);
    if (url.protocol !== 'https:' || !allowedHosts.includes(url.hostname)) continue;
    const sourceUrl = url.toString();
    if (seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    results.push({
      collection,
      title,
      sourceUrl,
      metadata: collection === 'BILLS' ? parseBillMetadata(title) : {},
    });
  }
  return results;
}

function isLikelyCollectionDocument(
  collection: KenyaExtendedCollection,
  title: string,
  href: string,
): boolean {
  const value = `${title} ${href}`;
  switch (collection) {
    case 'BILLS':
      return /\bbill\b/i.test(value);
    case 'COUNTY_LAW':
      return /\bcounty\b|\bfinance act\b|\bby-?law\b/i.test(value);
    case 'TREATIES':
      return /\btreaty\b|\bprotocol\b|\bconvention\b|\bagreement\b/i.test(value);
    case 'EAC_LAW':
      return /\bEAC\b|\bcommunity\b|\bEACJ\b|\bact\b/i.test(value);
    case 'REGULATOR':
      return /\bcircular\b|\bdirection\b|\bguideline\b|\bnotice\b/i.test(value);
  }
}

function parseBillMetadata(title: string): Record<string, string> {
  const stage = title.match(
    /\b(first reading|second reading|third reading|committee stage|assented)\b/i,
  )?.[1];
  const chamber = title.match(/\b(National Assembly|Senate)\b/i)?.[1];
  return {
    ...(stage ? { parliamentaryStage: stage } : {}),
    ...(chamber ? { chamber } : {}),
  };
}
