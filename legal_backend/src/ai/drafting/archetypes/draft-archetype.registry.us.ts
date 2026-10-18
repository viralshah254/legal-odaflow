import type { DraftArchetypeEntry } from './draft-archetype.types';

/**
 * Hand-verified USA offence/case archetype rows.
 * Prefer state criminal / protective kinds over us_form_catalog.
 * Federal Title 18 cites only when federal nexus signals are present.
 */
export const US_DRAFT_ARCHETYPE_REGISTRY: DraftArchetypeEntry[] = [
  {
    id: 'stalking_harassment_us',
    jurisdiction: 'US',
    archetype: 'protective_order',
    offenceFamily: 'state_harassment',
    signals: [
      /\bstalk(?:ing|s|ed)?\b/i,
      /\bharass(?:ment|ing|ed)?\b/i,
      /\brepeated(?:ly)?\s+(?:follow|contact|call)/i,
    ],
    substantiveSections: [
      {
        actId: 'state_penal',
        section: 'stalking',
        label: 'State stalking/harassment statute (verify state code from grounding)',
      },
    ],
    proceduralVehicles: [
      {
        forum: 'state_family_or_criminal',
        sections: [],
        kind: 'us_state_restraining_order',
        when: 'protective / restraining order',
        whenPattern: /restrain|protective|order|injunction|dv|domestic/i,
      },
      {
        forum: 'state_criminal',
        sections: [],
        kind: 'us_state_criminal_complaint',
        when: 'criminal complaint',
        whenPattern: /criminal\s+complaint|charge|prosecute|police\s+report/i,
      },
    ],
    register: 'protective_order',
    sourceRefs: ['catalog:us_state_restraining_order', 'catalog:us_state_criminal_complaint'],
    priority: 80,
  },
  {
    id: 'domestic_violence_us',
    jurisdiction: 'US',
    archetype: 'protective_order',
    offenceFamily: 'state_dv',
    signals: [
      /\bdomestic\s+violence\b/i,
      // Bare "DV" matches company names (e.g. "DV Tech") — require legal context.
      /\bdv\s+(?:petition|order|case|act|complaint|protection|restraining|hearing)\b/i,
      /\b(?:petition|order|case|act|complaint)\s+(?:for\s+)?dv\b/i,
      /\bintimate\s+partner\b/i,
      /\binimate\s+partner\b/i,
      /\babuse\b.*\b(spouse|partner|wife|husband)\b/i,
    ],
    substantiveSections: [
      {
        actId: 'state_dv',
        section: 'protective_order',
        label: 'State domestic violence / protective order statute (verify from grounding)',
      },
    ],
    proceduralVehicles: [
      {
        forum: 'state_family',
        sections: [],
        kind: 'us_state_domestic_violence_petition',
        when: 'DV petition',
      },
      {
        forum: 'state_family',
        sections: [],
        kind: 'us_state_restraining_order',
        when: 'restraining order',
        whenPattern: /restrain/i,
      },
    ],
    register: 'protective_order',
    sourceRefs: ['catalog:us_state_domestic_violence_petition'],
    priority: 90,
  },
  {
    id: 'assault_battery_us',
    jurisdiction: 'US',
    archetype: 'police_criminal_complaint',
    offenceFamily: 'state_violent',
    signals: [/\bassault\b/i, /\bbattery\b/i, /\bphysical\s+(?:attack|harm|injury)\b/i],
    substantiveSections: [
      {
        actId: 'state_penal',
        section: 'assault',
        label: 'State assault/battery statute (verify state code from grounding)',
      },
    ],
    proceduralVehicles: [
      {
        forum: 'state_criminal',
        sections: [],
        kind: 'us_state_criminal_complaint',
        when: 'state criminal complaint',
      },
    ],
    register: 'police_complaint',
    sourceRefs: ['catalog:us_state_criminal_complaint'],
    priority: 70,
  },
  {
    id: 'theft_fraud_us',
    jurisdiction: 'US',
    archetype: 'police_criminal_complaint',
    offenceFamily: 'state_property',
    signals: [/\btheft\b/i, /\blarceny\b/i, /\bembezzl/i, /\bfraud\b/i, /\bstole\b/i],
    substantiveSections: [
      {
        actId: 'state_penal',
        section: 'theft',
        label: 'State theft/fraud statute (verify from grounding)',
      },
    ],
    proceduralVehicles: [
      {
        forum: 'state_criminal',
        sections: [],
        kind: 'us_state_criminal_complaint',
        when: 'state criminal complaint',
      },
    ],
    register: 'police_complaint',
    sourceRefs: ['catalog:us_state_criminal_complaint'],
    priority: 65,
  },
  {
    id: 'federal_wire_fraud_us',
    jurisdiction: 'US',
    archetype: 'police_criminal_complaint',
    offenceFamily: 'federal_title18',
    signals: [
      /\bwire\s+fraud\b/i,
      /\b18\s*u\.?\s*s\.?\s*c\.?\s*§?\s*1343\b/i,
      /\bfederal\s+(?:criminal|indictment|complaint)\b/i,
      /\bmail\s+fraud\b/i,
    ],
    substantiveSections: [
      {
        actId: 'usc',
        section: '1343',
        label: '18 U.S.C. §1343 (wire fraud)',
      },
    ],
    proceduralVehicles: [
      {
        forum: 'federal_criminal',
        sections: [
          { actId: 'frcrp', section: '3', label: 'Fed. R. Crim. P. 3 (complaint)' },
        ],
        kind: 'us_federal_criminal_complaint',
        when: 'federal criminal complaint with federal nexus',
      },
    ],
    register: 'police_complaint',
    sourceRefs: ['usc:18:1343', 'frcrp:3', 'catalog:us_federal_criminal_complaint'],
    priority: 95,
  },
  {
    id: 'bail_motion_us',
    jurisdiction: 'US',
    archetype: 'bail_release',
    offenceFamily: 'pretrial_release',
    signals: [/\bbail\b/i, /\bpretrial\s+release\b/i, /\bbond\s+motion\b/i, /\bdetention\b/i],
    substantiveSections: [],
    proceduralVehicles: [
      {
        forum: 'state_criminal',
        sections: [],
        kind: 'us_state_bail_motion',
        when: 'state bail/bond motion',
        whenPattern: /state|county|bail|bond/i,
      },
      {
        forum: 'federal_criminal',
        sections: [],
        kind: 'us_federal_detention_memo',
        when: 'federal detention / release',
        whenPattern: /federal|detention|18\s*u\.?\s*s\.?\s*c/i,
      },
    ],
    register: 'bail_application',
    sourceRefs: ['catalog:us_state_bail_motion', 'catalog:us_federal_detention_memo'],
    priority: 75,
  },
  {
    id: 'civil_breach_us',
    jurisdiction: 'US',
    archetype: 'civil_plaint',
    offenceFamily: 'civil_contract',
    signals: [
      /\bbreach\s+of\s+contract\b/i,
      /\bcivil\s+complaint\b/i,
      /\bmoney\s+(?:owed|due|damages)\b/i,
    ],
    substantiveSections: [],
    proceduralVehicles: [
      {
        forum: 'state_civil',
        sections: [],
        kind: 'us_state_civil_complaint',
        when: 'state civil complaint',
      },
    ],
    register: 'civil_plaint',
    sourceRefs: ['catalog:us_state_civil_complaint'],
    priority: 55,
  },
  {
    id: 'federal_civil_complaint_us',
    jurisdiction: 'US',
    archetype: 'civil_plaint',
    offenceFamily: 'federal_civil',
    signals: [/\bfederal\s+complaint\b/i, /\bdiversity\s+jurisdiction\b/i, /\b28\s*u\.?\s*s\.?\s*c\.?\s*§?\s*1331\b/i],
    substantiveSections: [],
    proceduralVehicles: [
      {
        forum: 'federal_civil',
        sections: [],
        kind: 'us_federal_complaint',
        when: 'federal civil complaint',
      },
    ],
    register: 'civil_plaint',
    sourceRefs: ['catalog:us_federal_complaint'],
    priority: 60,
  },
  {
    id: 'divorce_us',
    jurisdiction: 'US',
    archetype: 'family_matrimonial',
    offenceFamily: 'family',
    signals: [/\bdivorce\b/i, /\bdissolution\s+of\s+marriage\b/i, /\bcustody\b/i],
    substantiveSections: [],
    proceduralVehicles: [
      {
        forum: 'state_family',
        sections: [],
        kind: 'us_state_divorce_petition',
        when: 'state divorce / family petition',
      },
    ],
    register: 'family_petition',
    sourceRefs: ['catalog:us_state_divorce_petition'],
    priority: 60,
  },
];
