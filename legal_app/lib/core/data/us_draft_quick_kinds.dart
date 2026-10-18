import 'package:flutter/material.dart';

class UsDraftQuickKind {
  const UsDraftQuickKind({
    required this.id,
    required this.label,
    required this.subtitle,
    required this.category,
    required this.icon,
  });

  final String id;
  final String label;
  final String subtitle;
  final String category;
  final IconData icon;
}

const usDraftQuickKinds = <UsDraftQuickKind>[
  UsDraftQuickKind(
    id: 'us_motion_to_dismiss',
    label: 'Motion to Dismiss',
    subtitle: 'Fed. R. Civ. P. 12(b)(6)',
    category: 'Civil',
    icon: Icons.gavel_outlined,
  ),
  UsDraftQuickKind(
    id: 'us_complaint_federal',
    label: 'Federal Complaint',
    subtitle: 'Fed. R. Civ. P. 8',
    category: 'Civil',
    icon: Icons.description_outlined,
  ),
  UsDraftQuickKind(
    id: 'us_answer_complaint',
    label: 'Answer to Complaint',
    subtitle: 'Fed. R. Civ. P. 12',
    category: 'Civil',
    icon: Icons.reply_outlined,
  ),
  UsDraftQuickKind(
    id: 'us_motion_summary_judgment',
    label: 'Motion for Summary Judgment',
    subtitle: 'Fed. R. Civ. P. 56',
    category: 'Civil',
    icon: Icons.balance_outlined,
  ),
  UsDraftQuickKind(
    id: 'us_cease_desist_letter',
    label: 'Cease & Desist Letter',
    subtitle: 'Demand letter',
    category: 'Commercial',
    icon: Icons.mail_outline,
  ),
  UsDraftQuickKind(
    id: 'us_nda_mutual',
    label: 'Mutual NDA',
    subtitle: 'Confidentiality agreement',
    category: 'Commercial',
    icon: Icons.handshake_outlined,
  ),
  UsDraftQuickKind(
    id: 'us_settlement_agreement',
    label: 'Settlement Agreement',
    subtitle: 'Dispute resolution',
    category: 'Commercial',
    icon: Icons.handshake_outlined,
  ),
  UsDraftQuickKind(
    id: 'us_eviction_notice',
    label: 'Eviction Notice',
    subtitle: 'Landlord-tenant',
    category: 'Property',
    icon: Icons.home_work_outlined,
  ),
];

const legalFormsCountryOptions = <({String code, String label})>[
  (code: 'ALL', label: 'All countries'),
  (code: 'IN', label: 'India'),
  (code: 'US', label: 'United States'),
  (code: 'GB', label: 'United Kingdom'),
  (code: 'KE', label: 'Kenya'),
];
