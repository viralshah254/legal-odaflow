import { LegalEvidencePackService } from './legal-evidence-pack.service';

describe('LegalEvidencePackService current-law metadata', () => {
  const service = new LegalEvidencePackService();

  it('sets effectiveDate for BNS and marks IPC superseded post-reform', () => {
    const pack = service.buildFromAuthorities({
      jurisdiction: 'IN',
      lawAsOfDate: '2025-01-01',
      authorities: [
        {
          id: 'bns-101',
          title: 'BNS Section 101',
          citation: 'BNS s.101',
          sourceTier: 'primary',
          summary: 'Murder provision.',
        },
        {
          id: 'ipc-300',
          title: 'IPC Section 300',
          citation: 'IPC s.300',
          sourceTier: 'primary',
          summary: 'Murder definition (legacy).',
        },
      ],
    });

    const bns = pack.statutes.find((s) => /bns/i.test(s.heading ?? '') || /bns/i.test(s.actId));
    const ipc = pack.statutes.find((s) => /ipc/i.test(s.heading ?? '') || /ipc/i.test(s.actId));
    expect(bns?.effectiveDate).toBe('2024-07-01');
    expect(bns?.superseded).toBe(false);
    expect(bns?.registryStatus).toBe('active');
    expect(bns?.versionSourceUrl).toMatch(/^https?:\/\//);
    expect(ipc?.superseded).toBe(true);
    expect(ipc?.successorActId).toBe('BNS');
  });

  it('evaluates predecessor currency against the requested historical date', () => {
    const pack = service.buildFromAuthorities({
      jurisdiction: 'IN',
      lawAsOfDate: '2023-12-31',
      authorities: [
        {
          id: 'ipc-300',
          title: 'IPC Section 300',
          citation: 'IPC s.300',
          sourceTier: 'primary',
          summary: 'Murder definition.',
        },
      ],
    });

    expect(pack.statutes[0]).toEqual(
      expect.objectContaining({
        effectiveFrom: '1860-10-06',
        effectiveTo: '2024-06-30',
        superseded: false,
        registryStatus: 'superseded',
      }),
    );
  });

  it('deduplicates aliases by normalized citation and prefers official provenance', () => {
    const pack = service.buildFromAuthorities({
      jurisdiction: 'IN',
      authorities: [
        {
          id: 'ik-123',
          title: 'Citizen v State',
          citation: '(2024) 3 SCR 627',
          sourceTier: 'case_law',
          sourceName: 'Indian Kanoon',
          sourceUrl: 'https://indiankanoon.org/doc/123/',
          summary: 'Aggregator summary.',
          court: 'Supreme Court of India',
          decisionDate: '2024-03-01',
        },
        {
          id: 'escr-2024-3-627',
          title: 'Citizen versus State',
          citation: '(2024) 3 SCR 627',
          neutralCitation: '2024 INSC 199',
          sourceTier: 'case_law',
          sourceName: 'e-SCR',
          sourceUrl: 'https://scr.sci.gov.in/judgment',
          fullText: 'Official judgment text supporting the proposition.',
          court: 'Supreme Court of India',
          decisionDate: '2024-03-01',
          paragraph: '21',
        },
      ],
    });

    expect(pack.authorities).toHaveLength(1);
    expect(pack.authorities[0]).toEqual(
      expect.objectContaining({
        authorityId: 'escr-2024-3-627',
        sourceTier: 'OFFICIAL',
        sourceName: 'e-SCR',
        canonicalAuthorityId: expect.stringMatching(/^AUTH_/),
      }),
    );
    expect(pack.sourceSnapshots[0]).toEqual(
      expect.objectContaining({
        sourceTier: 'OFFICIAL',
        pinpoint: { paragraph: '21', page: undefined },
      }),
    );
  });

  it('records India Kanoon as aggregator evidence, not curated or official', () => {
    const pack = service.buildFromAuthorities({
      jurisdiction: 'IN',
      authorities: [
        {
          id: 'ik-10',
          title: 'Person v State',
          citation: '(2020) 1 SCC 1',
          sourceTier: 'case_law',
          sourceName: 'Indian Kanoon',
          sourceUrl: 'https://indiankanoon.org/doc/10/',
          fullText: 'Judgment passage.',
          court: 'Supreme Court of India',
        },
      ],
    });

    expect(pack.authorities[0].sourceTier).toBe('AGGREGATOR');
    expect(pack.authorities[0].passages[0].sourceTier).toBe('AGGREGATOR');
  });

  it('parses deterministic statute ids into human-readable act and section metadata', () => {
    const pack = service.buildFromAuthorities({
      jurisdiction: 'IN',
      authorities: [
        {
          id: 'statute-in-arbitration-act-s48',
          title: 'statute-in-arbitration-act-s48',
          citation: null,
          sourceTier: 'primary',
          summary: 'Conditions for enforcement of certain foreign awards.',
        },
      ],
    });

    expect(pack.statutes[0]).toEqual(
      expect.objectContaining({
        section: '48',
        actName: expect.stringMatching(/Arbitration and Conciliation Act/i),
      }),
    );
    expect(pack.statutes[0]?.actName).not.toContain('statute-in-');
  });
});
