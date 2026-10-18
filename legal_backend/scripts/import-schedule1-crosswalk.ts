/**
 * Parses Delhi Police BNS training guide IPC→BNS table and generates
 * schedule1-crosswalk.in.generated.ts
 *
 * Usage: npx ts-node -r tsconfig-paths/register scripts/import-schedule1-crosswalk.ts [source.txt]
 */
import * as fs from 'fs';
import * as path from 'path';

interface RawCrosswalkRow {
  legacyAct: 'ipc' | 'crpc' | 'iea';
  legacySection: string;
  newAct: 'bns' | 'bnss' | 'bsa';
  newSection: string;
  title: string;
  changeType: 'renumbered' | 'omitted' | 'merged' | 'split';
  isCognizable?: boolean;
  isBailable?: boolean;
}

/** Authoritative overrides from BNS/BNSS/BSA bare act (gazette text). */
const BARE_ACT_OVERRIDES: Record<string, { newSection: string; title?: string }> = {
  'ipc:302': { newSection: '101', title: 'Punishment for murder' },
  'ipc:304': { newSection: '103', title: 'Punishment for culpable homicide not amounting to murder' },
  'ipc:304A': { newSection: '106', title: 'Causing death by negligence' },
  'ipc:304B': { newSection: '80', title: 'Dowry death' },
  'ipc:305': { newSection: '105', title: 'Abetment of suicide of child or person of unsound mind' },
  'ipc:306': { newSection: '108', title: 'Abetment of suicide' },
  'ipc:120': { newSection: '55', title: 'Concealing design to commit offence punishable with death or imprisonment for life' },
  'ipc:120B': { newSection: '61(2)', title: 'Punishment of criminal conspiracy' },
  'ipc:141': { newSection: '189', title: 'Unlawful assembly' },
  'ipc:143': { newSection: '191', title: 'Punishment for being a member of an unlawful assembly' },
  'ipc:287': { newSection: '291', title: 'Negligent conduct with respect to machinery' },
  'ipc:288': { newSection: '290', title: 'Negligent conduct with respect to pulling down or repairing buildings' },
  'ipc:323': { newSection: '115(2)', title: 'Punishment for voluntarily causing hurt' },
  'ipc:325': { newSection: '117(2)', title: 'Punishment for voluntarily causing grievous hurt' },
  'ipc:326': { newSection: '118(2)', title: 'Voluntarily causing grievous hurt by dangerous weapons or means' },
  'ipc:336': { newSection: '125', title: 'Act endangering life or personal safety of others' },
  'ipc:337': { newSection: '125', title: 'Causing hurt by act endangering life or personal safety of others' },
  'ipc:338': { newSection: '125', title: 'Causing grievous hurt by act endangering life or personal safety of others' },
  'ipc:354A': { newSection: '75', title: 'Sexual harassment' },
  'ipc:354B': { newSection: '76', title: 'Assault or use of criminal force to woman with intent to disrobe' },
  'ipc:354C': { newSection: '77', title: 'Voyeurism' },
  'ipc:354D': { newSection: '78', title: 'Stalking' },
  'ipc:363A': { newSection: '139', title: 'Kidnapping or maiming a child for purposes of begging' },
  'ipc:366A': { newSection: '96', title: 'Procuration of child' },
  'ipc:368': { newSection: '142', title: 'Wrongfully concealing or keeping in confinement a kidnapped person' },
  'ipc:376': { newSection: '63', title: 'Rape' },
  'ipc:376D': { newSection: '70(1)', title: 'Gang rape' },
  'ipc:377': { newSection: '', title: 'Unnatural offences' },
  'ipc:379': { newSection: '303(2)', title: 'Punishment for theft' },
  'ipc:384': { newSection: '308', title: 'Extortion' },
  'ipc:402': { newSection: '313', title: 'Assembling for purpose of committing dacoity' },
  'ipc:406': { newSection: '316(2)', title: 'Punishment for criminal breach of trust' },
  'ipc:420': { newSection: '318(4)', title: 'Cheating and dishonestly inducing delivery of property' },
  'ipc:489A': { newSection: '178', title: 'Counterfeiting currency-notes or bank-notes' },
  'ipc:489B': { newSection: '179', title: 'Using as genuine forged or counterfeit currency-notes or bank-notes' },
  'ipc:489C': { newSection: '180', title: 'Possession of forged or counterfeit currency-notes or bank-notes' },
  'ipc:489D': { newSection: '181', title: 'Making or possessing instruments or materials for forging or counterfeiting currency-notes or bank-notes' },
  'ipc:489E': { newSection: '182', title: 'Making or using documents resembling currency-notes or bank-notes' },
  'ipc:498A': { newSection: '85', title: 'Cruelty by husband or relatives' },
  'ipc:509': { newSection: '79', title: 'Word, gesture or act intended to insult the modesty of a woman' },
  'ipc:511': { newSection: '62', title: 'Punishment for attempting to commit offences punishable with imprisonment for life or other imprisonment' },
  'ipc:124A': { newSection: '', title: 'Sedition' },
};

// Annexure III deleted sections from Delhi Police guide
const DELETED_IPC = new Set(['124A', '309', '497', '377']);

/** CrPC → BNSS mappings from official transition tables + litigation staples. */
const CRPC_BNSS_MAPPINGS: Array<[string, string, string]> = [
  ['41', '35', 'When police may arrest without warrant'],
  ['50', '47', 'Person arrested to be informed of grounds of arrest'],
  ['54', '51', 'Examination of arrested person by medical officer'],
  ['56', '57', 'Person arrested to be taken before Magistrate or officer in charge of police station'],
  ['57', '58', 'Person arrested not to be detained more than twenty-four hours'],
  ['61', '63', 'Form of summons'],
  ['70', '72', 'Form of warrant of arrest and duration'],
  ['82', '84', 'Proclamation for person absconding'],
  ['87', '90', 'Issue of warrant in lieu of, or in addition to, summons'],
  ['91', '94', 'Summons to produce document or other thing'],
  ['93', '96', 'Search warrants'],
  ['97', '100', 'Search for persons wrongfully confined'],
  ['98', '101', 'Power to compel restoration of abducted females'],
  ['100', '103', 'Persons in charge of closed place to allow search'],
  ['102', '106', 'Power of police officer to seize certain property'],
  ['107', '126', 'Security for keeping the peace in other cases'],
  ['125', '144', 'Maintenance of wives, children and parents'],
  ['133', '152', 'Conditional order for removal of nuisance'],
  ['144', '163', 'Urgent order in nuisance or apprehended danger'],
  ['145', '164', 'Procedure where dispute concerning land or water'],
  ['151', '170', 'Arrest to prevent the commission of cognizable offences'],
  ['154', '173', 'Information in cognizable cases (FIR)'],
  ['155', '174', 'Information as to non-cognizable cases and investigation of such cases'],
  ['156', '175', "Police officer's power to investigate cognizable case"],
  ['157', '176', 'Procedure for investigation'],
  ['161', '180', 'Examination of witnesses by police'],
  ['164', '183', 'Recording of confessions and statements'],
  ['167', '187', 'Procedure when investigation cannot be completed in twenty-four hours'],
  ['172', '192', 'Diary of proceedings in investigation'],
  ['173', '193', 'Report of police officer on completion of investigation'],
  ['190', '210', 'Cognizance of offences by Magistrates'],
  ['200', '223', 'Examination of complainant'],
  ['204', '227', 'Issue of process'],
  ['207', '230', 'Supply to the accused of copy of police report and other documents'],
  ['209', '232', 'Commitment of case to Court of Session when offence is triable exclusively by it'],
  ['227', '250', 'When accused shall be discharged (Sessions trial)'],
  ['228', '251', 'Framing of charge (Sessions trial)'],
  ['229', '252', 'Conviction on plea of guilty (Sessions trial)'],
  ['238', '261', 'Compliance with section 230 (warrant case on police report)'],
  ['239', '262', 'When accused shall be discharged (warrant case on police report)'],
  ['240', '263', 'Framing of charge (warrant case on police report)'],
  ['241', '264', 'Conviction on plea of guilty (warrant case)'],
  ['251', '274', 'Substance of accusation to be stated (summons case)'],
  ['252', '275', 'Conviction on plea of guilty (summons case)'],
  ['253', '276', 'Conviction on plea of guilty in absence of accused in petty cases'],
  ['309', '346', 'Power to postpone or adjourn proceedings'],
  ['311', '348', 'Power to summon material witness, or examine person present'],
  ['313', '351', 'Power to examine the accused'],
  ['315', '353', 'Accused person to be competent witness'],
  ['319', '358', 'Power to proceed against other persons appearing to be guilty of offence'],
  ['320', '359', 'Compounding of offences'],
  ['323', '362', 'Court not to alter judgment'],
  ['357', '395', 'Order to pay compensation'],
  ['389', '430', 'Suspension of sentence pending appeal'],
  ['397', '438', 'Calling for records to exercise powers of revision'],
  ['401', '442', "High Court's powers of revision"],
  ['405', '450', 'Withdrawal of cases and appeals by Sessions Judges'],
  ['437', '480', 'Bail in non-bailable offences'],
  ['438', '482', 'Anticipatory bail'],
  ['439', '483', 'Special powers of High Court or Court of Session regarding bail'],
  ['482', '528', 'Saving of inherent powers of High Court'],
];

/** IEA → BSA mappings (Schedule I + relevancy staples). */
const IEA_BSA_MAPPINGS: Array<[string, string, string]> = [
  ['3', '3', 'Interpretation clause'],
  ['5', '5', 'Evidence may be given of facts in issue'],
  ['8', '6', 'Motive, preparation and previous or subsequent conduct'],
  ['9', '7', 'Facts necessary to explain or introduce relevant facts'],
  ['10', '8', 'Things said or done by conspirator in reference to common design'],
  ['11', '9', 'When facts not otherwise relevant become relevant'],
  ['12', '10', 'In suits for damages, facts tending to enable Court to determine amount are relevant'],
  ['17', '17', 'Admission defined'],
  ['24', '22', 'Confessions caused by inducement, threat or promise'],
  ['27', '23', 'Discovery of fact in consequence of information from accused'],
  ['32', '32', 'Cases in which statement of relevant fact by person who is dead'],
  ['45', '39', 'Opinions of experts'],
  ['56', '50', 'Fact judicially noticeable'],
  ['57', '51', 'Facts of which Court must take judicial notice'],
  ['60', '54', 'Oral evidence must be direct'],
  ['61', '55', 'Proof of contents of documents'],
  ['62', '56', 'Primary evidence'],
  ['63', '57', 'Secondary evidence'],
  ['65', '59', 'Cases in which secondary evidence relating to documents may be given'],
  ['65A', '61', 'Special provisions as to evidence relating to electronic record'],
  ['65B', '63', 'Admissibility of electronic records'],
  ['73', '71', 'Comparison of signature, writing or seal'],
  ['74', '72', 'Public documents'],
  ['101', '104', 'Burden of proof'],
  ['102', '105', 'On whom burden of proof lies'],
  ['106', '109', 'Burden of proving fact especially within knowledge'],
  ['113A', '116', 'Presumption as to abetment of suicide by married woman'],
  ['113B', '117', 'Presumption as to dowry death'],
  ['114', '118', 'Court may presume existence of certain facts'],
  ['118', '122', 'Who may testify'],
  ['122', '126', 'Communications during marriage'],
  ['123', '127', 'Evidence as to affairs of State'],
  ['124', '128', 'Official communications'],
  ['125', '129', 'Information as to commission of offences'],
  ['132', '136', 'Witness not excused from answering on ground of self-incrimination'],
  ['133', '137', 'Accomplice'],
  ['134', '138', 'Number of witnesses'],
  ['146', '150', 'Questions lawful in cross-examination'],
  ['154', '158', 'Question by consent'],
  ['157', '161', 'Former statements of witness may be proved'],
  ['159', '163', 'Refreshing memory'],
  ['160', '164', 'Testimony to facts stated in document mentioned in section 159'],
  ['161', '165', 'Right of adverse party as to writing used to refresh memory'],
  ['164', '168', "Judge's power to put questions or order production"],
  ['165', '169', 'Power of jury or assessors to put questions'],
  ['167', '171', 'No new trial for improper admission or rejection of evidence'],
];

/** Normalize IPC section tokens: `304-B` → `304B`, `120-B` → `120B`. */
function normalizeIpcSection(raw: string): string {
  return raw.replace(/-/g, '').toUpperCase();
}

/**
 * Split mashed Delhi handbook lines that concatenate several IPC→BNS pairs with `---`.
 * Example: `321 115(1) Hurt ---322 117(1) Grievous hurt ---323 115(2) Hurt`
 */
function expandMashedIpcLine(line: string): string[] {
  if (!line.includes('---')) return [line];
  const parts = line.split(/\s*---\s*/);
  if (parts.length < 2) return [line];

  const out: string[] = [];
  const head = parts[0].trim();
  const headMatch = head.match(/^(\d{1,3}-?[A-Z]?)\s+(\d+(?:\([^)]+\))?(?:\([^)]+\))?|NA)\s+(.+)$/i);
  if (!headMatch) return [line];

  const cognizableTail = line.match(/\s+(Non-?[Cc]ognizable|Cognizable)\s+(Non-?\s*[Bb]ailable|[Bb]ailable)\s*$/);
  const suffix = cognizableTail ? ` ${cognizableTail[1]} ${cognizableTail[2]}` : '';

  let title0 = headMatch[3].trim();
  if (cognizableTail) {
    title0 = title0.replace(/\s+(Non-?[Cc]ognizable|Cognizable)\s+(Non-?\s*[Bb]ailable|[Bb]ailable)\s*$/i, '').trim();
  }
  out.push(`${normalizeIpcSection(headMatch[1])} ${headMatch[2]} ${title0}${suffix}`);

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    const m = part.match(/^(\d{1,3}-?[A-Z]?)\s+(\d+(?:\([^)]+\))?(?:\([^)]+\))?|NA)\s+(.+)$/i);
    if (!m) continue;
    let title = m[3].trim();
    if (cognizableTail) {
      title = title.replace(/\s+(Non-?[Cc]ognizable|Cognizable)\s+(Non-?\s*[Bb]ailable|[Bb]ailable)\s*$/i, '').trim();
    }
    out.push(`${normalizeIpcSection(m[1])} ${m[2]} ${title}${suffix}`);
  }
  return out;
}

function parseIpcBnsTable(text: string): RawCrosswalkRow[] {
  const rows: RawCrosswalkRow[] = [];
  const seen = new Set<string>();

  const fullRowRe =
    /^(\d{1,3}[A-Z]?)\s+(\d+(?:\(\d+\))?(?:\(\d+\))?|NA)\s+(.+?)\s+(Cognizable|Non-cognizable|Non-Cognizable)\s+(Bailable|Non-bailable|Non- Bailable|Non-Bailable)/i;
  const omittedRe = /^(\d{1,3}[A-Z]?)\s+NA\s*$/i;
  const simpleRe = /^(\d{1,3}[A-Z]?)\s+(\d+(?:\(\d+\))?)\s+(.+)$/;
  const hyphenatedLeadRe = /^(\d{1,3})-([A-Z])\s+/i;

  const expandedLines: string[] = [];
  for (const rawLine of text.split('\n')) {
    let line = rawLine.trim();
    if (!line || line.startsWith('|') || line === '---' || line === 'IPC BNS') continue;
    if (line.startsWith('Heading') || line.startsWith('Punishment')) continue;
    // Normalize leading `304-B` tokens before other parsing.
    line = line.replace(hyphenatedLeadRe, (_, n, letter) => `${n}${letter.toUpperCase()} `);
    for (const piece of expandMashedIpcLine(line)) {
      expandedLines.push(piece);
    }
  }

  for (const line of expandedLines) {
    let m = line.match(fullRowRe);
    if (m) {
      const legacy = normalizeIpcSection(m[1]);
      if (seen.has(legacy)) continue;
      seen.add(legacy);
      const bns = m[2];
      const title = m[3].trim();
      const cognizable = m[4].toLowerCase().startsWith('cognizable') && !m[4].toLowerCase().includes('non');
      const bailable = m[5].toLowerCase().includes('bailable') && !m[5].toLowerCase().includes('non');

      if (bns === 'NA' || DELETED_IPC.has(legacy)) {
        rows.push({
          legacyAct: 'ipc',
          legacySection: legacy,
          newAct: 'bns',
          newSection: '',
          title,
          changeType: 'omitted',
        });
      } else {
        rows.push({
          legacyAct: 'ipc',
          legacySection: legacy,
          newAct: 'bns',
          newSection: bns,
          title,
          changeType: 'renumbered',
          isCognizable: cognizable,
          isBailable: bailable,
        });
      }
      continue;
    }

    m = line.match(omittedRe);
    if (m) {
      const legacy = normalizeIpcSection(m[1]);
      if (seen.has(legacy)) continue;
      seen.add(legacy);
      rows.push({
        legacyAct: 'ipc',
        legacySection: legacy,
        newAct: 'bns',
        newSection: '',
        title: legacy === '124A' ? 'Sedition' : `IPC s.${legacy}`,
        changeType: 'omitted',
      });
      continue;
    }

    m = line.match(simpleRe);
    if (m) {
      const legacy = normalizeIpcSection(m[1]);
      if (seen.has(legacy)) continue;
      const bns = m[2];
      const title = m[3].trim();
      if (title.length > 3 && title.length < 200 && !title.includes('BNS') && !title.includes('IPC')) {
        seen.add(legacy);
        rows.push({
          legacyAct: 'ipc',
          legacySection: legacy,
          newAct: 'bns',
          newSection: bns,
          title,
          changeType: 'renumbered',
        });
      }
    }
  }

  return rows;
}

function applyOverrides(rows: RawCrosswalkRow[]): RawCrosswalkRow[] {
  const bySection = new Map<string, RawCrosswalkRow>();
  for (const row of rows) {
    const key = row.legacySection;
    const override = BARE_ACT_OVERRIDES[`ipc:${key}`];
    if (override) {
      if (override.newSection === '') {
        bySection.set(key, { ...row, newSection: '', changeType: 'omitted', title: override.title ?? row.title });
      } else {
        bySection.set(key, {
          ...row,
          newSection: override.newSection,
          title: override.title ?? row.title,
          changeType: 'renumbered',
        });
      }
    } else if (!bySection.has(key)) {
      bySection.set(key, row);
    }
  }

  // Ensure bare-act overrides exist even when the Delhi parse missed the row.
  for (const [key, override] of Object.entries(BARE_ACT_OVERRIDES)) {
    const section = key.replace(/^ipc:/, '');
    if (bySection.has(section)) continue;
    const omitted = override.newSection === '' || DELETED_IPC.has(section);
    bySection.set(section, {
      legacyAct: 'ipc',
      legacySection: section,
      newAct: 'bns',
      newSection: omitted ? '' : override.newSection,
      title: override.title ?? `IPC s.${section}`,
      changeType: omitted ? 'omitted' : 'renumbered',
    });
  }

  return [...bySection.values()].sort((a, b) => {
    const na = parseInt(a.legacySection, 10) || 0;
    const nb = parseInt(b.legacySection, 10) || 0;
    return na - nb || a.legacySection.localeCompare(b.legacySection);
  });
}

function buildCrpcRows(): RawCrosswalkRow[] {
  return CRPC_BNSS_MAPPINGS.map(([legacy, bnss, title]) => ({
    legacyAct: 'crpc' as const,
    legacySection: legacy,
    newAct: 'bnss' as const,
    newSection: bnss,
    title,
    changeType: 'renumbered' as const,
  }));
}

function buildIeaRows(): RawCrosswalkRow[] {
  return IEA_BSA_MAPPINGS.map(([legacy, bsa, title]) => ({
    legacyAct: 'iea' as const,
    legacySection: legacy,
    newAct: 'bsa' as const,
    newSection: bsa,
    title,
    changeType: 'renumbered' as const,
  }));
}

function escapeStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ');
}

function generateTs(rows: RawCrosswalkRow[]): string {
  const lines: string[] = [
    '/**',
    ' * AUTO-GENERATED — do not edit by hand.',
    ' * Regenerate: npm run import:schedule1-crosswalk',
    ' * Source: Delhi Police BNS training guide (June 2024) + BNS/BNSS/BSA bare act overrides',
    ` * Generated: ${new Date().toISOString().slice(0, 10)}`,
    ' */',
    '',
    "import type { SectionFinderEntry } from './section-finder.types';",
    '',
    'export const SCHEDULE1_CROSSWALK_ROWS: Omit<SectionFinderEntry,',
    "  'legacyActShort' | 'legacyActFull' | 'newActShort' | 'newActFull' | 'trialCourt' | 'trialCourtLabel' | 'transitionDate'",
    '>[] = [',
  ];

  for (const row of rows) {
    const id = `${row.legacyAct.toUpperCase()}-${row.legacySection}`;
    const omitted = row.changeType === 'omitted' || !row.newSection;
    const changeType = omitted ? 'omitted' : row.changeType === 'renumbered' ? 'renumbered' : row.changeType;
    const changeSummary = omitted
      ? `${row.legacyAct.toUpperCase()} §${row.legacySection} (${escapeStr(row.title)}) has been **omitted** under the Bharatiya Nyaya Sanhita, 2023 (effective 1 July 2024). This provision is **no longer in force**.`
      : `${row.legacyAct.toUpperCase()} §${row.legacySection} → ${row.newAct.toUpperCase()} §${row.newSection}. ${escapeStr(row.title)}.`;

    lines.push('  {');
    lines.push(`    id: '${id}',`);
    lines.push(`    legacyActId: '${row.legacyAct}',`);
    lines.push(`    legacySection: '${row.legacySection}',`);
    lines.push(`    legacyTitle: '${escapeStr(row.title)}',`);
    if (omitted) {
      lines.push(`    newActId: 'bns',`);
      lines.push(`    newSection: '',`);
      lines.push(`    newTitle: '',`);
    } else {
      const newActId = row.newAct;
      lines.push(`    newActId: '${newActId}',`);
      lines.push(`    newSection: '${row.newSection}',`);
      lines.push(`    newTitle: '${escapeStr(row.title)}',`);
    }
    lines.push(`    changeType: '${changeType}',`);
    lines.push(`    changeSummary: '${escapeStr(changeSummary)}',`);
    lines.push(
      omitted
        ? `    punishment: 'Not applicable — section omitted',`
        : `    punishment: 'See ${row.newAct.toUpperCase()} bare act / Schedule II',`,
    );
    lines.push(`    isCognizable: ${row.isCognizable ?? !omitted},`);
    lines.push(`    isBailable: ${row.isBailable ?? false},`);
    lines.push(`    isCompoundable: false,`);
    lines.push(
      omitted
        ? `    bailPosture: 'Not applicable — legacy section no longer in force',`
        : `    bailPosture: 'Refer to ${row.newAct.toUpperCase()} Schedule II classification.',`,
    );
    lines.push(`    sourceRef: '${row.newAct.toUpperCase()}, 2023, Schedule I',`);
    lines.push(`    tier: 'crosswalk',`);
    lines.push(`    isInForce: ${omitted ? 'false' : 'true'},`);
    lines.push(`    matchSource: 'curated',`);
    lines.push('  },');
  }

  lines.push('];');
  lines.push('');
  lines.push(`export const SCHEDULE1_CROSSWALK_COUNT = ${rows.length};`);
  lines.push('');
  return lines.join('\n');
}

function resolveSourcePath(): string {
  const defaultSource = path.join(
    __dirname,
    '../corpus/in/delhi-police-bns-ipc-crosswalk.txt',
  );
  const arg = process.argv[2]?.trim();
  // Ignore shell comment fragments accidentally passed as argv (e.g. `npm run x # comment`)
  if (!arg || arg.startsWith('#')) {
    return defaultSource;
  }
  const candidate = path.isAbsolute(arg) ? arg : path.resolve(process.cwd(), arg);
  if (fs.existsSync(candidate)) {
    return candidate;
  }
  if (fs.existsSync(defaultSource)) {
    console.warn(`Source not found: ${arg}; using default ${defaultSource}`);
    return defaultSource;
  }
  return candidate;
}

function main() {
  const sourcePath = resolveSourcePath();
  let ipcRows: RawCrosswalkRow[] = [];

  if (fs.existsSync(sourcePath)) {
    const text = fs.readFileSync(sourcePath, 'utf8');
    ipcRows = applyOverrides(parseIpcBnsTable(text));
    console.log(`Parsed ${ipcRows.length} IPC→BNS rows from ${sourcePath}`);
  } else {
    console.error(`Source not found: ${sourcePath}`);
    console.error(
      'Place Delhi Police BNS training guide text at corpus/in/delhi-police-bns-ipc-crosswalk.txt',
    );
    process.exit(1);
  }

  const allRows = [...ipcRows, ...buildCrpcRows(), ...buildIeaRows()];
  const outPath = path.join(
    __dirname,
    '../src/legal-search/india-section-finder/schedule1-crosswalk.in.generated.ts',
  );
  fs.writeFileSync(outPath, generateTs(allRows), 'utf8');
  console.log(`Wrote ${allRows.length} crosswalk rows to ${outPath}`);
}

main();
