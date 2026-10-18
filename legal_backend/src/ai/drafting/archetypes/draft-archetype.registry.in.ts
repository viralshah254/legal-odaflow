import type { DraftArchetypeEntry } from './draft-archetype.types';

/**
 * Hand-verified India offence/case archetype rows.
 * Sections must come from bare-act / Schedule I — never invent.
 */
export const INDIA_DRAFT_ARCHETYPE_REGISTRY: DraftArchetypeEntry[] = [
  {
    id: 'commercial_summary_recovery_in',
    jurisdiction: 'IN',
    archetype: 'civil_plaint',
    offenceFamily: 'commercial_contract_debt',
    signals: [
      /\b(order\s*(?:xxxvii|37)|summary\s+suit)\b/i,
      /\b(purchase\s+order|written\s+contract|unpaid\s+invoices?|acknowledg(?:e)?ment\s+of\s+(?:debt|liability))\b/i,
      /\b(commercial\s+court|commercial\s+dispute|section\s+12a|pre[-\s]?institution\s+mediation)\b/i,
    ],
    substantiveSections: [],
    proceduralVehicles: [
      {
        forum: 'commercial_court',
        sections: [
          {
            actId: 'cpc',
            section: 'Order XXXVII',
            label: 'CPC Order XXXVII (summary procedure)',
          },
          {
            actId: 'commercial_courts_act',
            section: '12A',
            label: 'Commercial Courts Act §12A (pre-institution mediation)',
          },
        ],
        kind: 'india_suit_recovery_cpc_37',
        when: 'written commercial debt qualifying for summary procedure',
        whenPattern:
          /order\s*(?:xxxvii|37)|summary\s+suit|written\s+(?:contract|acknowledg)/i,
      },
      {
        forum: 'commercial_court',
        sections: [
          {
            actId: 'cpc',
            section: 'Order VII',
            label: 'CPC Order VII (plaint)',
          },
        ],
        kind: 'india_civil_suit_money_recovery',
        when: 'ordinary commercial money-recovery suit',
        whenPattern: /money\s+recovery|commercial\s+recovery|unpaid\s+invoices?/i,
      },
    ],
    register: 'civil_plaint',
    sourceRefs: [
      'bare-act:cpc:order-37',
      'bare-act:commercial-courts-act:12A',
    ],
    priority: 96,
  },
  // ── Personal safety ────────────────────────────────────────────────────────
  {
    id: 'stalking_criminal_in',
    jurisdiction: 'IN',
    archetype: 'police_criminal_complaint',
    offenceFamily: 'bns_personal_safety',
    signals: [/\bstalk(?:ing|s|ed)?\b/i, /\brepeated(?:ly)?\s+follow/i, /\bcyber.?stalk/i],
    substantiveSections: [
      {
        actId: 'bns',
        section: '78',
        label: 'BNS §78 (stalking)',
        predecessor: { actId: 'ipc', section: '354D' },
      },
    ],
    proceduralVehicles: [
      {
        forum: 'police_station',
        sections: [
          { actId: 'bnss', section: '173', label: 'BNSS §173 (information in cognizable cases)' },
        ],
        kind: 'india_fir_complaint',
        when: 'cognizable police complaint / FIR',
        whenPattern: /police|fir|sho|station house|complaint to police/i,
      },
      {
        forum: 'magistrate',
        sections: [
          { actId: 'bnss', section: '223', label: 'BNSS §223 (complaint to Magistrate)' },
        ],
        kind: 'india_complaint_magistrate_bnss_223',
        when: 'private complaint before Magistrate',
        whenPattern: /magistrate|private complaint|bnss\s*223/i,
      },
    ],
    altStatutes: [
      {
        actId: 'it_act',
        section: '67',
        label: 'IT Act §67 (obscene material in electronic form — verify applicability)',
        when: /\bonline|cyber|whatsapp|instagram|social media|email\b/i,
      },
    ],
    register: 'police_complaint',
    sourceRefs: ['bare-act:bns:78', 'schedule1:ipc:354D', 'bare-act:bnss:173'],
    bailabilityNote:
      'BNS §78 first offence is generally bailable; do not assert non-bailable unless second/subsequent conviction facts are stated.',
    priority: 80,
  },
  {
    id: 'sexual_harassment_in',
    jurisdiction: 'IN',
    archetype: 'police_criminal_complaint',
    offenceFamily: 'bns_personal_safety',
    signals: [/\bsexual\s+harass/i, /\boutrag(?:e|ing)\s+(?:her\s+)?modesty\b/i],
    substantiveSections: [
      {
        actId: 'bns',
        section: '75',
        label: 'BNS §75 (sexual harassment)',
        predecessor: { actId: 'ipc', section: '354A' },
      },
    ],
    proceduralVehicles: [
      {
        forum: 'police_station',
        sections: [
          { actId: 'bnss', section: '173', label: 'BNSS §173 (information in cognizable cases)' },
        ],
        kind: 'india_fir_complaint',
        when: 'police FIR',
      },
    ],
    register: 'police_complaint',
    sourceRefs: ['bare-act:bns:75', 'schedule1:ipc:354A', 'bare-act:bnss:173'],
    priority: 70,
  },
  {
    id: 'assault_hurt_in',
    jurisdiction: 'IN',
    archetype: 'police_criminal_complaint',
    offenceFamily: 'bns_personal_safety',
    signals: [/\bassault\b/i, /\bhurt\b/i, /\bbeat(?:en|ing)?\b/i, /\bvoluntarily\s+causing\s+hurt\b/i],
    substantiveSections: [
      {
        actId: 'bns',
        section: '115',
        label: 'BNS §115 (voluntarily causing hurt — verify subsection from facts)',
        predecessor: { actId: 'ipc', section: '323' },
      },
    ],
    proceduralVehicles: [
      {
        forum: 'police_station',
        sections: [
          { actId: 'bnss', section: '173', label: 'BNSS §173 (information in cognizable cases)' },
        ],
        kind: 'india_fir_complaint',
        when: 'police FIR',
      },
    ],
    register: 'police_complaint',
    sourceRefs: ['bare-act:bns:115', 'schedule1:ipc:323', 'bare-act:bnss:173'],
    priority: 60,
  },
  {
    id: 'rape_in',
    jurisdiction: 'IN',
    archetype: 'police_criminal_complaint',
    offenceFamily: 'bns_personal_safety',
    signals: [/\brape\b/i, /\bipc\s*§?\s*376\b/i, /\bbns\s*§?\s*63\b/i],
    substantiveSections: [
      {
        actId: 'bns',
        section: '63',
        label: 'BNS §63 (rape)',
        predecessor: { actId: 'ipc', section: '376' },
      },
    ],
    proceduralVehicles: [
      {
        forum: 'police_station',
        sections: [
          { actId: 'bnss', section: '173', label: 'BNSS §173 (information in cognizable cases)' },
        ],
        kind: 'india_fir_complaint',
        when: 'police FIR',
      },
    ],
    register: 'police_complaint',
    sourceRefs: ['bare-act:bns:63', 'schedule1:ipc:376', 'bare-act:bnss:173'],
    bailabilityNote: 'Rape is non-bailable; bail language belongs in a bail application, not the FIR complaint.',
    priority: 90,
  },
  {
    id: 'murder_in',
    jurisdiction: 'IN',
    archetype: 'police_criminal_complaint',
    offenceFamily: 'bns_personal_safety',
    signals: [/\bmurder\b/i, /\bipc\s*§?\s*302\b/i, /\bbns\s*§?\s*101\b/i],
    substantiveSections: [
      {
        actId: 'bns',
        section: '101',
        label: 'BNS §101 (murder)',
        predecessor: { actId: 'ipc', section: '302' },
      },
    ],
    proceduralVehicles: [
      {
        forum: 'police_station',
        sections: [
          { actId: 'bnss', section: '173', label: 'BNSS §173 (information in cognizable cases)' },
        ],
        kind: 'india_fir_complaint',
        when: 'police FIR',
      },
    ],
    register: 'police_complaint',
    sourceRefs: ['bare-act:bns:101', 'schedule1:ipc:302', 'bare-act:bnss:173'],
    bailabilityNote: 'Murder is non-bailable; do not draft bail prayers inside the FIR complaint.',
    priority: 95,
  },

  // ── Property / economic ────────────────────────────────────────────────────
  {
    id: 'theft_in',
    jurisdiction: 'IN',
    archetype: 'police_criminal_complaint',
    offenceFamily: 'bns_property',
    signals: [/\btheft\b/i, /\bstole\b/i, /\bstolen\b/i, /\bipc\s*§?\s*379\b/i],
    substantiveSections: [
      {
        actId: 'bns',
        section: '303',
        label: 'BNS §303 (theft)',
        predecessor: { actId: 'ipc', section: '379' },
      },
    ],
    proceduralVehicles: [
      {
        forum: 'police_station',
        sections: [
          { actId: 'bnss', section: '173', label: 'BNSS §173 (information in cognizable cases)' },
        ],
        kind: 'india_fir_complaint',
        when: 'police FIR',
      },
    ],
    register: 'police_complaint',
    sourceRefs: ['bare-act:bns:303', 'schedule1:ipc:379', 'bare-act:bnss:173'],
    priority: 70,
  },
  {
    id: 'robbery_in',
    jurisdiction: 'IN',
    archetype: 'police_criminal_complaint',
    offenceFamily: 'bns_property',
    signals: [/\brobbery\b/i, /\bipc\s*§?\s*392\b/i, /\bbns\s*§?\s*309\b/i],
    substantiveSections: [
      {
        actId: 'bns',
        section: '309',
        label: 'BNS §309 (robbery)',
        predecessor: { actId: 'ipc', section: '392' },
      },
    ],
    proceduralVehicles: [
      {
        forum: 'police_station',
        sections: [
          { actId: 'bnss', section: '173', label: 'BNSS §173 (information in cognizable cases)' },
        ],
        kind: 'india_fir_complaint',
        when: 'police FIR',
      },
    ],
    register: 'police_complaint',
    sourceRefs: ['bare-act:bns:309', 'schedule1:ipc:392', 'bare-act:bnss:173'],
    priority: 75,
  },
  {
    id: 'cheating_in',
    jurisdiction: 'IN',
    archetype: 'police_criminal_complaint',
    offenceFamily: 'bns_economic',
    signals: [/\bcheat(?:ing|ed)?\b/i, /\bipc\s*§?\s*420\b/i, /\bbns\s*§?\s*318\b/i],
    substantiveSections: [
      {
        actId: 'bns',
        section: '318',
        label: 'BNS §318 (cheating)',
        predecessor: { actId: 'ipc', section: '420' },
      },
    ],
    proceduralVehicles: [
      {
        forum: 'police_station',
        sections: [
          { actId: 'bnss', section: '173', label: 'BNSS §173 (information in cognizable cases)' },
        ],
        kind: 'india_fir_complaint',
        when: 'police FIR',
      },
    ],
    register: 'police_complaint',
    sourceRefs: ['bare-act:bns:318', 'schedule1:ipc:420', 'bare-act:bnss:173'],
    priority: 65,
  },
  {
    id: 'criminal_intimidation_in',
    jurisdiction: 'IN',
    archetype: 'police_criminal_complaint',
    offenceFamily: 'bns_economic',
    signals: [/\bcriminal\s+intimidat/i, /\bthreat(?:en|ened|s)?\s+(?:to\s+)?(?:kill|harm|injure)/i],
    substantiveSections: [
      {
        actId: 'bns',
        section: '351',
        label: 'BNS §351 (criminal intimidation)',
        predecessor: { actId: 'ipc', section: '506' },
      },
    ],
    proceduralVehicles: [
      {
        forum: 'police_station',
        sections: [
          { actId: 'bnss', section: '173', label: 'BNSS §173 (information in cognizable cases)' },
        ],
        kind: 'india_fir_complaint',
        when: 'police FIR',
      },
    ],
    register: 'police_complaint',
    sourceRefs: ['bare-act:bns:351', 'schedule1:ipc:506', 'bare-act:bnss:173'],
    priority: 60,
  },

  // ── Special acts ───────────────────────────────────────────────────────────
  {
    id: 'ni138_cheque_in',
    jurisdiction: 'IN',
    archetype: 'magistrate_private_complaint',
    offenceFamily: 'special_ni_act',
    signals: [
      /\bcheque\s+bounce\b/i,
      /\bdishonou?r(?:ed)?\s+(?:of\s+)?cheque\b/i,
      /\bni\s*act\s*§?\s*138\b/i,
      /\bsection\s+138\b/i,
    ],
    substantiveSections: [
      { actId: 'ni_act', section: '138', label: 'NI Act §138 (dishonour of cheque)' },
    ],
    proceduralVehicles: [
      {
        forum: 'magistrate',
        sections: [
          { actId: 'ni_act', section: '138', label: 'NI Act §138' },
          { actId: 'bnss', section: '223', label: 'BNSS §223 (complaint to Magistrate)' },
        ],
        kind: 'india_cheque_bounce_complaint_ni138',
        when: 'NI Act private complaint — not FIR under BNSS §173',
      },
    ],
    register: 'magistrate_complaint',
    sourceRefs: ['bare-act:ni_act:138', 'bare-act:bnss:223'],
    priority: 100,
  },
  {
    id: 'dv_pwdva_in',
    jurisdiction: 'IN',
    archetype: 'protective_order',
    offenceFamily: 'special_pwdva',
    signals: [
      /\bdomestic\s+violence\b/i,
      /\bpwdva\b/i,
      /\bprotection\s+of\s+women\s+from\s+domestic\b/i,
      /\bdv\s+act\b/i,
    ],
    substantiveSections: [
      {
        actId: 'pwdva',
        section: '12',
        label: 'PWDVA §12 (application to Magistrate)',
      },
    ],
    proceduralVehicles: [
      {
        forum: 'magistrate',
        sections: [
          { actId: 'pwdva', section: '12', label: 'PWDVA §12' },
          { actId: 'pwdva', section: '18', label: 'PWDVA §18 (protection orders)' },
        ],
        kind: 'india_domestic_violence_petition',
        when: 'PWDVA petition — not generic FIR only',
      },
    ],
    register: 'protective_order',
    sourceRefs: ['bare-act:pwdva:12', 'bare-act:pwdva:18'],
    priority: 85,
  },
  {
    id: 'ndps_bail_in',
    jurisdiction: 'IN',
    archetype: 'bail_release',
    offenceFamily: 'special_ndps',
    signals: [/\bndps\b/i, /\bnarcotic\b/i, /\bganja\b/i, /\bheroin\b/i, /\bcocaine\b/i],
    substantiveSections: [
      { actId: 'ndps', section: '37', label: 'NDPS Act §37 (special bail bar)' },
    ],
    proceduralVehicles: [
      {
        forum: 'sessions_or_special',
        sections: [{ actId: 'ndps', section: '37', label: 'NDPS Act §37' }],
        kind: 'india_ndps_bail_application',
        when: 'NDPS bail — twin conditions',
        whenPattern: /bail/i,
      },
    ],
    register: 'bail_application',
    sourceRefs: ['bare-act:ndps:37'],
    priority: 90,
  },
  {
    id: 'pocso_bail_in',
    jurisdiction: 'IN',
    archetype: 'bail_release',
    offenceFamily: 'special_pocso',
    signals: [/\bpocso\b/i, /\bchild\s+sexual\b/i, /\bminor\s+victim\b/i],
    substantiveSections: [
      { actId: 'pocso', section: '29', label: 'POCSO Act §29 (presumption)' },
    ],
    proceduralVehicles: [
      {
        forum: 'special_court',
        sections: [
          { actId: 'pocso', section: '29', label: 'POCSO Act §29' },
          { actId: 'pocso', section: '30', label: 'POCSO Act §30' },
        ],
        kind: 'india_pocso_bail_application',
        when: 'POCSO bail',
        whenPattern: /bail/i,
      },
    ],
    register: 'bail_application',
    sourceRefs: ['bare-act:pocso:29', 'bare-act:pocso:30'],
    priority: 90,
  },
  {
    id: 'pmla_bail_in',
    jurisdiction: 'IN',
    archetype: 'bail_release',
    offenceFamily: 'special_pmla',
    signals: [/\bpmla\b/i, /\bmoney\s+laundering\b/i, /\benforcement\s+directorate\b/i],
    substantiveSections: [
      { actId: 'pmla', section: '45', label: 'PMLA §45 (bail conditions)' },
    ],
    proceduralVehicles: [
      {
        forum: 'special_court',
        sections: [{ actId: 'pmla', section: '45', label: 'PMLA §45' }],
        kind: 'india_pmla_bail_application',
        when: 'PMLA bail',
        whenPattern: /bail/i,
      },
    ],
    register: 'bail_application',
    sourceRefs: ['bare-act:pmla:45'],
    priority: 90,
  },

  // ── Bail (generic) ─────────────────────────────────────────────────────────
  {
    id: 'regular_bail_in',
    jurisdiction: 'IN',
    archetype: 'bail_release',
    offenceFamily: 'bnss_bail',
    signals: [/\bregular\s+bail\b/i, /\bbail\s+application\b/i, /\bseek(?:ing)?\s+bail\b/i],
    substantiveSections: [],
    proceduralVehicles: [
      {
        forum: 'magistrate_or_sessions',
        sections: [
          { actId: 'bnss', section: '480', label: 'BNSS §480 (bail — Magistrate)' },
          { actId: 'bnss', section: '483', label: 'BNSS §483 (bail — Sessions/HC)' },
        ],
        kind: 'india_regular_bail_bnss_480',
        when: 'regular bail post-arrest',
      },
    ],
    register: 'bail_application',
    sourceRefs: ['bare-act:bnss:480', 'bare-act:bnss:483'],
    priority: 50,
  },
  {
    id: 'anticipatory_bail_in',
    jurisdiction: 'IN',
    archetype: 'bail_release',
    offenceFamily: 'bnss_bail',
    signals: [/\banticipatory\s+bail\b/i, /\bbnss\s*§?\s*482\b/i],
    substantiveSections: [],
    proceduralVehicles: [
      {
        forum: 'sessions_or_hc',
        sections: [
          { actId: 'bnss', section: '482', label: 'BNSS §482 (anticipatory bail)' },
        ],
        kind: 'india_anticipatory_bail_bnss_482',
        when: 'anticipatory bail',
      },
    ],
    register: 'bail_application',
    sourceRefs: ['bare-act:bnss:482'],
    priority: 55,
  },

  // ── Family / appellate / civil ─────────────────────────────────────────────
  {
    id: 'maintenance_revision_in',
    jurisdiction: 'IN',
    archetype: 'appellate_revision',
    offenceFamily: 'family_maintenance',
    signals: [
      /\binterim\s+maintenance\b/i,
      /\bmaintenance.*revision\b/i,
      /\bcrpc\s*125\b/i,
      /\bbnss\s*144\b/i,
    ],
    substantiveSections: [
      {
        actId: 'bnss',
        section: '144',
        label: 'BNSS §144 (maintenance)',
        predecessor: { actId: 'crpc', section: '125' },
      },
    ],
    proceduralVehicles: [
      {
        forum: 'high_court',
        sections: [
          { actId: 'bnss', section: '144', label: 'BNSS §144' },
          { actId: 'bnss', section: '438', label: 'BNSS §438 (criminal revision)' },
        ],
        kind: 'india_maintenance_order_revision',
        when: 'interim maintenance revision',
      },
    ],
    register: 'appellate',
    sourceRefs: ['bare-act:bnss:144', 'bare-act:bnss:438', 'schedule1:crpc:125'],
    priority: 85,
  },
  {
    id: 'consumer_complaint_in',
    jurisdiction: 'IN',
    archetype: 'special_statute_complaint',
    offenceFamily: 'consumer_cpa',
    signals: [/\bconsumer\s+complaint\b/i, /\bdeficiency\s+in\s+service\b/i, /\bcpa\s*2019\b/i],
    substantiveSections: [],
    proceduralVehicles: [
      {
        forum: 'consumer_commission',
        sections: [],
        kind: 'india_consumer_complaint',
        when: 'CPA 2019 complaint',
      },
    ],
    register: 'special_statute',
    sourceRefs: ['catalog:india_consumer_complaint'],
    priority: 60,
  },
  {
    id: 'writ_226_in',
    jurisdiction: 'IN',
    archetype: 'writ_constitutional',
    offenceFamily: 'constitutional',
    signals: [/\bwrit\s+petition\b/i, /\barticle\s+226\b/i, /\bmandamus\b/i, /\bcertiorari\b/i],
    substantiveSections: [],
    proceduralVehicles: [
      {
        forum: 'high_court',
        sections: [],
        kind: 'india_writ_petition_hc',
        when: 'Art. 226 writ',
      },
    ],
    register: 'writ',
    sourceRefs: ['constitution:art:226'],
    priority: 70,
  },
  {
    id: 'divorce_hma_in',
    jurisdiction: 'IN',
    archetype: 'family_matrimonial',
    offenceFamily: 'family_hma',
    signals: [/\bdivorce\b/i, /\bhma\s*§?\s*13\b/i, /\bdissolution\s+of\s+marriage\b/i],
    substantiveSections: [
      { actId: 'hma', section: '13', label: 'HMA §13 (divorce)' },
    ],
    proceduralVehicles: [
      {
        forum: 'family_court',
        sections: [{ actId: 'hma', section: '13', label: 'HMA §13' }],
        kind: 'india_divorce_petition_s13',
        when: 'HMA divorce petition',
      },
    ],
    register: 'family_petition',
    sourceRefs: ['bare-act:hma:13'],
    priority: 70,
  },
];
