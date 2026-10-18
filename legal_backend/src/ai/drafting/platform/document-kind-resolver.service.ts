import { Injectable, NotFoundException } from '@nestjs/common';
import type { DraftTypeAdapter } from '../contracts/draft-type-adapter';
import { RegularBailAdapter } from './adapters/regular-bail.adapter';
import { AnticipatoryBailAdapter } from './adapters/anticipatory-bail.adapter';
import { LegalNoticeAdapter } from './adapters/legal-notice.adapter';
import { ContractDraftAdapter } from './adapters/contract-draft.adapter';
import { ResearchMemoAdapter } from './adapters/research-memo.adapter';
import { ConsumerComplaintAdapter } from './adapters/consumer-complaint.adapter';
import { GenericDraftAdapter } from './adapters/generic-draft.adapter';
import { DraftPlaybookRegistryService } from './draft-playbook-registry.service';

@Injectable()
export class DocumentKindResolver {
  private readonly adapters: DraftTypeAdapter[];

  constructor(
    regularBail: RegularBailAdapter,
    anticipatoryBail: AnticipatoryBailAdapter,
    legalNotice: LegalNoticeAdapter,
    contractDraft: ContractDraftAdapter,
    researchMemo: ResearchMemoAdapter,
    consumerComplaint: ConsumerComplaintAdapter,
    private readonly genericDraft: GenericDraftAdapter,
    private readonly playbooks: DraftPlaybookRegistryService,
  ) {
    this.adapters = [
      regularBail,
      anticipatoryBail,
      legalNotice,
      contractDraft,
      researchMemo,
      consumerComplaint,
    ];
  }

  resolveKind(documentKind: string): string {
    return this.playbooks.resolveKind(documentKind);
  }

  getAdapter(documentKind: string): DraftTypeAdapter {
    const kind = this.resolveKind(documentKind);
    const adapter = this.adapters.find(
      (a) =>
        a.documentKind === kind ||
        a.documentKind === documentKind ||
        a.aliases?.includes(kind) ||
        a.aliases?.includes(documentKind),
    );
    if (!adapter) {
      if (this.playbooks.tryGetPlaybook(documentKind)) return this.genericDraft;
      throw new NotFoundException(`No DraftTypeAdapter for documentKind=${documentKind}`);
    }
    return adapter;
  }

  listAdapters(): string[] {
    return this.adapters.map((a) => a.documentKind);
  }
}
