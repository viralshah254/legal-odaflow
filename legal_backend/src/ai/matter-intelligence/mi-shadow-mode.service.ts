import { Injectable, Logger } from '@nestjs/common';
import { resolveDocumentKind } from '@/config/templates/document-kinds';
import type { MatterProfile } from './matter-intelligence.types';

@Injectable()
export class MiShadowModeService {
  private readonly logger = new Logger(MiShadowModeService.name);

  /** Log divergence between legacy resolveDocumentKind and MI profile (P18). */
  compareDocumentKind(
    facts: string,
    miProfile: MatterProfile,
    consumer: string,
  ): void {
    const legacy = resolveDocumentKind(undefined, facts);
    const miKind = miProfile.documentKind;
    if (legacy !== miKind && miKind) {
      this.logger.warn(
        JSON.stringify({
          event: 'mi_shadow_divergence',
          consumer,
          legacy,
          miKind,
          practiceArea: miProfile.practiceArea,
          nature: miProfile.nature,
        }),
      );
    }
  }
}
