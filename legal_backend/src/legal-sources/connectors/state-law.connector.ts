import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IndiaCodeConnector } from './india-code.connector';
import type { StatuteSectionFetchResult } from './us-code.connector';

export interface StateManifestActEntry {
  actId: string;
  title: string;
  sourceAuthority: 'india-code' | 'state-portal';
  sourceTier?: 'primary' | 'mirror' | 'fallback';
  primaryPdfUrl?: string;
  externalId?: string;
  handleUrl?: string;
  year?: number;
  notes?: string;
}

export interface StateSourcesManifest {
  version: number;
  stateCode: string;
  stateName: string;
  browseHandlePath?: string;
  acts: StateManifestActEntry[];
}

export interface StatePilotConfig {
  stateCode: string;
  stateName: string;
  browseHandlePath: string;
}

export const STATE_LAW_PILOTS: Record<string, StatePilotConfig> = {
  MH: {
    stateCode: 'MH',
    stateName: 'Maharashtra',
    browseHandlePath: '/handle/123456789/2517',
  },
  DL: {
    stateCode: 'DL',
    stateName: 'Delhi',
    browseHandlePath: '/handle/123456789/2493',
  },
  KA: {
    stateCode: 'KA',
    stateName: 'Karnataka',
    browseHandlePath: '/handle/123456789/2485',
  },
  TN: {
    stateCode: 'TN',
    stateName: 'Tamil Nadu',
    browseHandlePath: '/handle/123456789/2502',
  },
  GJ: {
    stateCode: 'GJ',
    stateName: 'Gujarat',
    browseHandlePath: '/handle/123456789/2455',
  },
};

const CORPUS_STATES_DIR = resolve(process.cwd(), 'corpus/in/states');

/** Abstract base for state-law connectors; pilot states share India Code fetch logic. */
export abstract class StateLawConnector {
  abstract readonly stateCode: string;
  abstract readonly stateName: string;

  abstract loadStateManifest(stateCode: string): StateSourcesManifest;
  abstract fetchActSections(stateCode: string, actId: string): Promise<StatuteSectionFetchResult[]>;
}

@Injectable()
export class PilotStateLawConnector extends StateLawConnector {
  private readonly logger = new Logger(PilotStateLawConnector.name);
  readonly stateCode: string;
  readonly stateName: string;
  private readonly browseHandlePath: string;

  constructor(
    config: StatePilotConfig,
    private readonly configService: ConfigService,
    private readonly indiaCode: IndiaCodeConnector,
  ) {
    super();
    this.stateCode = config.stateCode;
    this.stateName = config.stateName;
    this.browseHandlePath = config.browseHandlePath;
  }

  isEnabled(): boolean {
    return this.configService.get<string>('ENABLE_STATE_LAW_CONNECTOR', 'true') === 'true';
  }

  loadStateManifest(stateCode: string): StateSourcesManifest {
    const code = stateCode.toUpperCase();
    const manifestPath = resolve(CORPUS_STATES_DIR, `${code.toLowerCase()}.manifest.json`);
    if (!existsSync(manifestPath)) {
      throw new Error(`State manifest not found: ${manifestPath}`);
    }
    const raw = readFileSync(manifestPath, 'utf8');
    return JSON.parse(raw) as StateSourcesManifest;
  }

  async fetchActSections(stateCode: string, actId: string): Promise<StatuteSectionFetchResult[]> {
    if (!this.isEnabled()) return [];

    const code = stateCode.toUpperCase();
    if (code !== this.stateCode) {
      throw new Error(`Connector ${this.stateCode} cannot fetch acts for ${code}`);
    }

    const manifest = this.loadStateManifest(code);
    const entry = manifest.acts.find((act) => act.actId === actId);
    if (!entry) {
      this.logger.warn(`Act ${actId} not found in ${code} manifest`);
      return [];
    }

    if (entry.externalId && this.indiaCode.isEnabled()) {
      const sections = await this.indiaCode.fetchActSections(entry.externalId);
      if (sections.length > 0) {
        return sections.map((section) => ({
          ...section,
          sourceName: section.sourceName ?? `${this.stateName} (India Code)`,
        }));
      }
    }

    if (entry.primaryPdfUrl && this.indiaCode.isEnabled()) {
      const externalId = await this.indiaCode.resolveBitstreamExternalId(entry.primaryPdfUrl);
      if (externalId) {
        const sections = await this.indiaCode.fetchActSections(externalId);
        if (sections.length > 0) {
          return sections.map((section) => ({
            ...section,
            sourceName: section.sourceName ?? `${this.stateName} (India Code)`,
          }));
        }
      }
    }

    if (entry.handleUrl && this.indiaCode.isEnabled()) {
      const externalId = await this.indiaCode.resolveBitstreamExternalId(entry.handleUrl);
      if (externalId) {
        return this.indiaCode.fetchActSections(externalId);
      }
    }

    this.logger.warn(`No sections fetched for ${code}/${actId}`);
    return [];
  }

  getBrowseHandlePath(): string {
    return this.browseHandlePath;
  }
}

@Injectable()
export class StateLawConnectorRegistry {
  private readonly connectors: Map<string, PilotStateLawConnector>;

  constructor(
    private readonly configService: ConfigService,
    private readonly indiaCode: IndiaCodeConnector,
  ) {
    this.connectors = new Map(
      Object.values(STATE_LAW_PILOTS).map((pilot) => [
        pilot.stateCode,
        new PilotStateLawConnector(pilot, this.configService, this.indiaCode),
      ]),
    );
  }

  getPilotStateCodes(): string[] {
    return [...this.connectors.keys()];
  }

  getConnector(stateCode: string): PilotStateLawConnector | undefined {
    return this.connectors.get(stateCode.toUpperCase());
  }

  loadStateManifest(stateCode: string): StateSourcesManifest {
    const connector = this.getConnector(stateCode);
    if (!connector) {
      throw new Error(
        `Unsupported pilot state "${stateCode}". Supported: ${this.getPilotStateCodes().join(', ')}`,
      );
    }
    return connector.loadStateManifest(stateCode);
  }

  async fetchActSections(stateCode: string, actId: string): Promise<StatuteSectionFetchResult[]> {
    const connector = this.getConnector(stateCode);
    if (!connector) {
      throw new Error(`Unsupported pilot state "${stateCode}"`);
    }
    return connector.fetchActSections(stateCode, actId);
  }
}
