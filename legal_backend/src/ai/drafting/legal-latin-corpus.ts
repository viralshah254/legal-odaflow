/**
 * Legal Latin Corpus — Writs, Maxims, and Doctrines
 *
 * Structured reference used by the AI drafting engines. Entries are grouped
 * by category and tagged with the document kinds / practice areas where each
 * term is most applicable. The `buildLegalTerminologyBlock` function returns
 * a curated prompt block that the system prompt injects for each draft, ensuring
 * the LLM applies Latin maxims, writ jurisdiction rules, and constitutional
 * doctrines correctly and cites them with accurate meanings.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface WritEntry {
  slug: string;
  latin: string;
  translation: string;
  articleIndia: string;
  scope: string;
  typicalArt: string;
  kinds: string[];
}

export interface MaximEntry {
  slug: string;
  latin: string;
  translation: string;
  meaning: string;
  kinds: string[];
}

export interface DoctrineEntry {
  slug: string;
  name: string;
  article?: string;
  meaning: string;
  kinds: string[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Five Constitutional Writs
// ──────────────────────────────────────────────────────────────────────────────

export const WRITS: WritEntry[] = [
  {
    slug: 'habeas_corpus',
    latin: 'Habeas Corpus',
    translation: '"You shall have the body"',
    articleIndia: 'Art. 32 (Supreme Court) / Art. 226 (High Court)',
    scope:
      'Secures the release of a person unlawfully detained. Compels the detaining authority to produce the person before the court and justify the lawfulness of detention. Lies against the State and private persons.',
    typicalArt:
      "Petition must show: (a) detention or confinement, (b) absence of lawful authority, and (c) petitioner's standing (family / next friend). Court may order immediate production and release.",
    kinds: [
      'india_habeas_corpus_petition',
      'india_writ_petition_hc',
      'writ_petition',
    ],
  },
  {
    slug: 'mandamus',
    latin: 'Mandamus',
    translation: '"We command"',
    articleIndia: 'Art. 32 / Art. 226',
    scope:
      'Directs a public authority, inferior court, or tribunal to perform a public duty it has omitted or refused to perform. Not available against purely private bodies.',
    typicalArt:
      'Petitioner must show: (a) a legal right to demand performance, (b) a corresponding public duty, and (c) prior demand and refusal (unless futile).',
    kinds: [
      'india_writ_petition_hc',
      'writ_petition',
    ],
  },
  {
    slug: 'certiorari',
    latin: 'Certiorari',
    translation: '"To be certified / informed"',
    articleIndia: 'Art. 226 (High Court); analogous jurisdiction under Art. 32 read with Art. 142',
    scope:
      'Quashes orders of inferior courts, tribunals, or quasi-judicial bodies made (a) without jurisdiction, (b) in excess of jurisdiction, (c) in violation of principles of natural justice, or (d) with an error of law apparent on the face of the record.',
    typicalArt:
      'Applies only to judicial or quasi-judicial acts; purely administrative/executive orders challenged under general Art. 226 jurisdiction rather than strict certiorari.',
    kinds: [
      'india_writ_petition_hc',
      'india_article_227_petition',
      'writ_petition',
    ],
  },
  {
    slug: 'prohibition',
    latin: 'Prohibition',
    translation: '"Forbid"',
    articleIndia: 'Art. 226',
    scope:
      'Prevents an inferior court or tribunal from acting in excess of or outside its jurisdiction. Issues at an early stage — before the inferior body finishes proceedings — unlike certiorari, which issues after a final order.',
    typicalArt:
      'Lies only against judicial or quasi-judicial bodies. The petitioner must show imminent excess of jurisdiction that cannot adequately be addressed by appeal.',
    kinds: [
      'india_writ_petition_hc',
      'writ_petition',
    ],
  },
  {
    slug: 'quo_warranto',
    latin: 'Quo Warranto',
    translation: '"By what authority"',
    articleIndia: 'Art. 226',
    scope:
      "Challenges a person's right to hold a public office. Requires the holder to show by what authority they occupy the office. If the holding is unlawful, the court can oust the person.",
    typicalArt:
      'Available only in respect of substantive public offices created by statute or constitutional provision; not available against contractual or private employment.',
    kinds: [
      'india_writ_petition_hc',
      'writ_petition',
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Legal Maxims
// ──────────────────────────────────────────────────────────────────────────────

export const MAXIMS: MaximEntry[] = [
  {
    slug: 'audi_alteram_partem',
    latin: 'Audi Alteram Partem',
    translation: '"Hear the other side"',
    meaning:
      'Core principle of natural justice: no adverse order may be passed against a person without giving them an opportunity to be heard. Applies to judicial, quasi-judicial, and executive action affecting rights.',
    kinds: [
      'india_writ_petition_hc',
      'india_habeas_corpus_petition',
      'india_service_termination_petition',
      'india_wrongful_termination',
      'india_article_227_petition',
      'writ_petition',
    ],
  },
  {
    slug: 'nemo_judex',
    latin: 'Nemo Judex In Causa Sua',
    translation: '"No one shall be a judge in their own cause"',
    meaning:
      'Rule against bias: a decision-maker who has a personal interest in, or pre-formed opinion about, the outcome must not adjudicate. Breach vitiates the decision regardless of actual prejudice.',
    kinds: [
      'india_writ_petition_hc',
      'india_habeas_corpus_petition',
      'india_service_termination_petition',
      'india_wrongful_termination',
      'writ_petition',
    ],
  },
  {
    slug: 'ubi_jus_ibi_remedium',
    latin: 'Ubi Jus Ibi Remedium',
    translation: '"Where there is a right, there is a remedy"',
    meaning:
      'Every legal right is accompanied by a corresponding legal remedy. Grounds the jurisdiction of constitutional courts to provide relief where a right has been violated even if no specific statute prescribes the remedy.',
    kinds: [
      'india_writ_petition_hc',
      'india_habeas_corpus_petition',
      'india_civil_plaint',
      'india_legal_notice',
      'writ_petition',
    ],
  },
  {
    slug: 'actus_reus_mens_rea',
    latin: 'Actus Reus & Mens Rea',
    translation: '"The guilty act & the guilty mind"',
    meaning:
      'Twin requirements for most criminal offences: (a) actus reus — the prohibited act or omission, and (b) mens rea — the requisite mental element (intention, knowledge, recklessness, or negligence). Absence of either normally negates criminal liability unless the statute imposes strict liability.',
    kinds: [
      'india_regular_bail_bnss_480',
      'india_anticipatory_bail_bnss_482',
      'india_quashing_petition_bnss_528',
      'india_criminal_appeal',
      'india_criminal_revision',
      'bail_application',
    ],
  },
  {
    slug: 'res_judicata',
    latin: 'Res Judicata',
    translation: '"A matter already judged"',
    meaning:
      'A final judgment on the merits by a competent court bars re-litigation of the same claim between the same parties. Prevents multiplicity of proceedings and ensures finality. Codified in India under CPC §11.',
    kinds: [
      'india_civil_plaint',
      'india_writ_petition_hc',
      'india_criminal_appeal',
      'india_written_statement',
      'writ_petition',
    ],
  },
  {
    slug: 'locus_standi',
    latin: 'Locus Standi',
    translation: '"Place of standing"',
    meaning:
      'The right or capacity of a party to bring an action before a court. In constitutional litigation, locus standi is liberalised for writs (any person can move for habeas corpus on behalf of the detainee) and for Public Interest Litigation.',
    kinds: [
      'india_writ_petition_hc',
      'india_habeas_corpus_petition',
      'india_civil_plaint',
      'writ_petition',
    ],
  },
  {
    slug: 'ignorantia_juris',
    latin: 'Ignorantia Juris Non Excusat',
    translation: '"Ignorance of law is no excuse"',
    meaning:
      'Every person is presumed to know the law; professed ignorance of legal requirements does not excuse non-compliance or provide a defence to criminal liability.',
    kinds: [
      'india_regular_bail_bnss_480',
      'india_criminal_appeal',
      'bail_application',
    ],
  },
  {
    slug: 'ex_dolo_malo',
    latin: 'Ex Dolo Malo Non Oritur Actio',
    translation: '"No right of action can arise from fraud"',
    meaning:
      'A party who has procured a right or benefit through fraud or deceit cannot enforce it in a court of law. Applied in contract, property, and commercial disputes.',
    kinds: [
      'india_civil_plaint',
      'india_legal_notice',
      'india_suit_specific_performance',
    ],
  },
  {
    slug: 'damnum_sine_injuria',
    latin: 'Damnum Sine Injuria',
    translation: '"Damage without legal injury"',
    meaning:
      'Not every loss or damage suffered gives rise to a legal claim; the loss must amount to a violation of a legal right. Distinguished from Injuria Sine Damno (legal injury without actual loss).',
    kinds: [
      'india_civil_plaint',
      'india_consumer_complaint_nch',
    ],
  },
  {
    slug: 'in_pari_delicto',
    latin: 'In Pari Delicto',
    translation: '"In equal fault"',
    meaning:
      'Where both parties are equally at fault, neither can claim relief from the court. Limits equitable remedies in cases of mutual illegality.',
    kinds: [
      'india_civil_plaint',
      'india_suit_specific_performance',
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Constitutional Doctrines
// ──────────────────────────────────────────────────────────────────────────────

export const DOCTRINES: DoctrineEntry[] = [
  {
    slug: 'doctrine_of_severability',
    name: 'Doctrine of Severability',
    article: 'Art. 13, Constitution of India',
    meaning:
      'When a statute contains a provision that is void as inconsistent with Part III (Fundamental Rights), only that provision is severed and struck down — the remainder of the Act survives — provided the valid and invalid parts are severable and the Act remains meaningful without the offending part.',
    kinds: [
      'india_writ_petition_hc',
      'india_quashing_petition_bnss_528',
      'writ_petition',
    ],
  },
  {
    slug: 'doctrine_of_eclipse',
    name: 'Doctrine of Eclipse',
    article: 'Art. 13(1), Constitution of India',
    meaning:
      'Pre-constitutional laws that are inconsistent with Fundamental Rights do not become void ab initio; they are merely eclipsed / rendered unenforceable for the period of inconsistency. If the inconsistency is removed by a constitutional amendment, the law revives for future transactions.',
    kinds: [
      'india_writ_petition_hc',
      'writ_petition',
    ],
  },
  {
    slug: 'basic_structure',
    name: 'Doctrine of Basic Structure',
    article: 'Art. 368, Constitution of India',
    meaning:
      "Parliament's power to amend the Constitution (Art. 368) cannot be used to destroy or abrogate its basic or essential features. Established in Kesavananda Bharati v. State of Kerala (1973) 4 SCC 225. Examples of basic features: supremacy of the Constitution, rule of law, judicial review, separation of powers, federalism, secularism.",
    kinds: [
      'india_writ_petition_hc',
      'india_slp_draft',
      'writ_petition',
    ],
  },
  {
    slug: 'proportionality',
    name: 'Doctrine of Proportionality',
    article: 'Arts. 14, 19, 21',
    meaning:
      'Restrictions on fundamental rights must be proportionate to the legitimate aim pursued. The court examines: (a) legitimate aim, (b) rational nexus, (c) necessity (least restrictive means), and (d) fair balance between the restriction and the right. Applied in Modern Dental College v. State of Madhya Pradesh (2016) 7 SCC 353.',
    kinds: [
      'india_writ_petition_hc',
      'india_habeas_corpus_petition',
      'india_regular_bail_bnss_480',
      'writ_petition',
      'bail_application',
    ],
  },
  {
    slug: 'legitimate_expectation',
    name: 'Doctrine of Legitimate Expectation',
    article: 'Art. 14 (equality / fairness)',
    meaning:
      'A person who has a reasonable expectation — based on established practice, a promise, or a representation by a public authority — may challenge a decision that defeats that expectation without adequate notice or justification. Not a vested right; balances public interest against individual reliance.',
    kinds: [
      'india_writ_petition_hc',
      'india_service_termination_petition',
      'india_wrongful_termination',
      'writ_petition',
    ],
  },
  {
    slug: 'prospective_overruling',
    name: 'Doctrine of Prospective Overruling',
    article: 'Supreme Court / Art. 141',
    meaning:
      'When a court overrules an earlier decision, it may direct that the new ruling operates only prospectively — protecting transactions and vested rights based on the overruled decision. Introduced in India in Golak Nath v. State of Punjab AIR 1967 SC 1643.',
    kinds: [
      'india_slp_draft',
      'india_writ_petition_hc',
      'india_civil_appeal_hc',
      'writ_petition',
    ],
  },
  {
    slug: 'alter_ego',
    name: 'Doctrine of Alter Ego',
    meaning:
      'In company law, the acts of key managerial personnel (directors, managing director) are treated as acts of the company itself when they act within the scope of their authority, making the company liable for those acts.',
    kinds: [
      'india_sebi_lodr_disclosure',
      'india_nclt_cirp_real_estate',
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Block builder
// ──────────────────────────────────────────────────────────────────────────────

/** Writs that should appear in the prompt for a given document kind. */
function relevantWrits(kind: string): WritEntry[] {
  return WRITS.filter((w) => w.kinds.some((k) => kind.includes(k) || k.includes(kind)));
}

/** Maxims relevant to a given document kind. */
function relevantMaxims(kind: string): MaximEntry[] {
  return MAXIMS.filter((m) => m.kinds.some((k) => kind.includes(k) || k.includes(kind)));
}

/** Doctrines relevant to a given document kind. */
function relevantDoctrines(kind: string): DoctrineEntry[] {
  return DOCTRINES.filter((d) => d.kinds.some((k) => kind.includes(k) || k.includes(kind)));
}

/**
 * Builds a structured terminology block for inclusion in AI system prompts.
 * Returns an empty string for document kinds that don't benefit from legal Latin
 * (e.g. contracts, notices).
 */
export function buildLegalTerminologyBlock(kind: string): string {
  // Skip for contracts, agreements, and plain notices — these rarely invoke Latin maxims.
  if (
    /contract|agreement|nda|lease|deed|mou|loan|offer_letter|appointment_letter|shareholders|service_agreement|employment_contract|legal_notice|express_notice/i.test(
      kind,
    )
  ) {
    return '';
  }

  const writs = relevantWrits(kind);
  const maxims = relevantMaxims(kind);
  const doctrines = relevantDoctrines(kind);

  if (writs.length === 0 && maxims.length === 0 && doctrines.length === 0) {
    return '';
  }

  const lines: string[] = [
    'LEGAL TERMINOLOGY REFERENCE (apply where factually appropriate — cite in grounds and arguments):',
  ];

  if (writs.length > 0) {
    lines.push('');
    lines.push('WRIT JURISDICTION:');
    for (const w of writs) {
      lines.push(`- ${w.latin} ${w.translation} [${w.articleIndia}]`);
      lines.push(`  Scope: ${w.scope}`);
      lines.push(`  Drafting note: ${w.typicalArt}`);
    }
  }

  if (maxims.length > 0) {
    lines.push('');
    lines.push('LEGAL MAXIMS:');
    for (const m of maxims) {
      lines.push(`- ${m.latin} ${m.translation}: ${m.meaning}`);
    }
  }

  if (doctrines.length > 0) {
    lines.push('');
    lines.push('CONSTITUTIONAL DOCTRINES:');
    for (const d of doctrines) {
      const art = d.article ? ` [${d.article}]` : '';
      lines.push(`- ${d.name}${art}: ${d.meaning}`);
    }
  }

  return lines.join('\n');
}
