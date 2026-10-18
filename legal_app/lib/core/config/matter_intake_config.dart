// Canonical matter intake config — mirrors legal_web/lib/config/matter-intake.ts
// and legal_backend/src/config/matter-types.ts.

class MatterTypeOption {
  const MatterTypeOption({
    required this.value,
    required this.label,
    required this.description,
  });

  final String value;
  final String label;
  final String description;
}

const matterTypeOptions = <MatterTypeOption>[
  MatterTypeOption(
    value: 'Litigation',
    label: 'Litigation',
    description: 'Court proceedings, hearings, trials',
  ),
  MatterTypeOption(
    value: 'Transaction',
    label: 'Transaction',
    description: 'M&A, conveyancing, commercial deals',
  ),
  MatterTypeOption(
    value: 'Advisory',
    label: 'Advisory',
    description: 'Legal opinion, advice note, memo',
  ),
  MatterTypeOption(
    value: 'Dispute',
    label: 'Dispute',
    description: 'ADR, arbitration, mediation, negotiation',
  ),
  MatterTypeOption(
    value: 'Registration',
    label: 'Registration',
    description: 'IP, company, property registration',
  ),
  MatterTypeOption(
    value: 'Compliance',
    label: 'Compliance',
    description: 'Regulatory, tax, corporate governance',
  ),
  MatterTypeOption(
    value: 'Drafting',
    label: 'Drafting',
    description: 'Contracts, wills, deeds, policies',
  ),
];

class PracticeAreaConfig {
  const PracticeAreaConfig({
    required this.slug,
    required this.matterTypes,
    required this.defaultMatterType,
  });

  final String slug;
  final List<String> matterTypes;
  final String defaultMatterType;
}

const practiceAreaConfigs = <PracticeAreaConfig>[
  PracticeAreaConfig(
    slug: 'litigation_disputes',
    matterTypes: ['Litigation', 'Dispute', 'Advisory'],
    defaultMatterType: 'Litigation',
  ),
  PracticeAreaConfig(
    slug: 'corporate_commercial',
    matterTypes: ['Transaction', 'Drafting', 'Compliance', 'Advisory'],
    defaultMatterType: 'Transaction',
  ),
  PracticeAreaConfig(
    slug: 'real_estate_property',
    matterTypes: ['Transaction', 'Drafting', 'Advisory'],
    defaultMatterType: 'Transaction',
  ),
  PracticeAreaConfig(
    slug: 'family_matrimonial',
    matterTypes: ['Litigation', 'Dispute', 'Advisory'],
    defaultMatterType: 'Litigation',
  ),
  PracticeAreaConfig(
    slug: 'criminal_defense',
    matterTypes: ['Litigation', 'Advisory'],
    defaultMatterType: 'Litigation',
  ),
  PracticeAreaConfig(
    slug: 'employment_labour',
    matterTypes: ['Dispute', 'Litigation', 'Advisory'],
    defaultMatterType: 'Dispute',
  ),
  PracticeAreaConfig(
    slug: 'immigration',
    matterTypes: ['Registration', 'Advisory'],
    defaultMatterType: 'Registration',
  ),
  PracticeAreaConfig(
    slug: 'intellectual_property',
    matterTypes: ['Registration', 'Drafting', 'Advisory'],
    defaultMatterType: 'Registration',
  ),
  PracticeAreaConfig(
    slug: 'tax',
    matterTypes: ['Compliance', 'Advisory'],
    defaultMatterType: 'Compliance',
  ),
  PracticeAreaConfig(
    slug: 'wills_estates_probate',
    matterTypes: ['Drafting', 'Advisory'],
    defaultMatterType: 'Drafting',
  ),
];

class CourtLevelOption {
  const CourtLevelOption({required this.value, required this.label});

  final String value;
  final String label;
}

const courtLevelOptions = <CourtLevelOption>[
  CourtLevelOption(value: 'magistrate', label: 'Magistrate Court'),
  CourtLevelOption(value: 'high', label: 'High Court'),
  CourtLevelOption(value: 'appeal', label: 'Court of Appeal'),
  CourtLevelOption(value: 'supreme', label: 'Supreme Court'),
  CourtLevelOption(value: 'tribunal', label: 'Tribunal'),
  CourtLevelOption(value: 'arbitration', label: 'Arbitration Panel'),
  CourtLevelOption(value: 'other', label: 'Other'),
];

PracticeAreaConfig? practiceAreaConfigFor(String slug) {
  for (final config in practiceAreaConfigs) {
    if (config.slug == slug) return config;
  }
  return null;
}

MatterTypeOption? matterTypeOptionFor(String value) {
  for (final option in matterTypeOptions) {
    if (option.value == value) return option;
  }
  return null;
}

bool showsOpposingParty(String matterType) =>
    matterType == 'Litigation' || matterType == 'Dispute';

bool showsCourtFields(String matterType) => matterType == 'Litigation';

bool showsFormPicker(String matterType) =>
    matterType == 'Drafting' ||
    matterType == 'Transaction' ||
    matterType == 'Registration' ||
    matterType == 'Compliance';

bool showsDesiredOutcome(String matterType) =>
    matterType == 'Litigation' ||
    matterType == 'Dispute' ||
    matterType == 'Advisory';

bool hasSpecificsStep(String matterType) =>
    showsOpposingParty(matterType) ||
    showsDesiredOutcome(matterType) ||
    showsCourtFields(matterType) ||
    showsFormPicker(matterType);
