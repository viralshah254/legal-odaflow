import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';

const List<Map<String, String>> _practiceAreas = [
  {'slug': 'litigation', 'label': 'Litigation'},
  {'slug': 'corporate_commercial', 'label': 'Corporate & Commercial'},
  {'slug': 'real_estate_property', 'label': 'Real Estate & Property'},
  {'slug': 'family_matrimonial', 'label': 'Family & Matrimonial'},
  {'slug': 'criminal_defence', 'label': 'Criminal Defence'},
  {'slug': 'employment_labour', 'label': 'Employment & Labour'},
  {'slug': 'immigration', 'label': 'Immigration'},
  {'slug': 'intellectual_property', 'label': 'Intellectual Property'},
  {'slug': 'tax_revenue', 'label': 'Tax & Revenue'},
  {'slug': 'wills_estates_probate', 'label': 'Wills, Estates & Probate'},
];

const List<Map<String, String>> _jurisdictions = [
  {'code': 'KE', 'label': 'Kenya (LSK)'},
  {'code': 'US', 'label': 'United States (State Bar)'},
  {'code': 'GB', 'label': 'England & Wales (SRA)'},
  {'code': 'IN', 'label': 'India (BCI)'},
];

class LawyerProfileScreen extends ConsumerStatefulWidget {
  const LawyerProfileScreen({super.key});

  @override
  ConsumerState<LawyerProfileScreen> createState() => _LawyerProfileScreenState();
}

class _LawyerProfileScreenState extends ConsumerState<LawyerProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _bioController = TextEditingController();
  final _displayTitleController = TextEditingController();
  final _yearsExpController = TextEditingController();
  final _consultFeeController = TextEditingController();

  final Set<String> _selectedPracticeAreas = {};
  final Map<String, String> _specialtyLevels = {};
  final Set<String> _licensedJurisdictions = {};

  bool _acceptingLeads = true;
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _successMsg;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _bioController.dispose();
    _displayTitleController.dispose();
    _yearsExpController.dispose();
    _consultFeeController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    try {
      final api = ref.read(marketplaceApiProvider);
      final data = await api.getMyProfile();
      if (mounted && data != null) {
        setState(() {
          _bioController.text = data['bio'] as String? ?? '';
          _displayTitleController.text = data['displayTitle'] as String? ?? '';
          _yearsExpController.text =
              (data['yearsExperience'] as int?)?.toString() ?? '';
          _consultFeeController.text =
              (data['consultationFee'] as num?)?.toString() ?? '';
          _acceptingLeads = data['acceptingLeads'] as bool? ?? true;

          final pas = data['practiceAreas'];
          if (pas is List) {
            _selectedPracticeAreas.addAll(pas.cast<String>());
          }
          final sl = data['specialtyLevel'];
          if (sl is Map) {
            _specialtyLevels.addAll(
              sl.map((k, v) => MapEntry(k.toString(), v.toString())),
            );
          }
          final jl = data['jurisdictionLicenses'];
          if (jl is List) {
            _licensedJurisdictions.addAll(jl.cast<String>());
          }
        });
      }
    } on ApiException catch (_) {
      // profile not found yet — OK to start fresh
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
      _successMsg = null;
    });
    try {
      final api = ref.read(marketplaceApiProvider);
      await api.upsertMyProfile({
        'bio': _bioController.text.trim(),
        'displayTitle': _displayTitleController.text.trim(),
        'yearsExperience': int.tryParse(_yearsExpController.text.trim()),
        'consultationFee': double.tryParse(_consultFeeController.text.trim()),
        'acceptingLeads': _acceptingLeads,
        'practiceAreas': _selectedPracticeAreas.toList(),
        'specialtyLevel': _specialtyLevels,
        'jurisdictionLicenses': _licensedJurisdictions.toList(),
      });
      if (mounted) setState(() => _successMsg = 'Profile saved successfully.');
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    final theme = Theme.of(context);
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.commonMyProfile)),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.commonMyProfessionalProfile),
        actions: [
          TextButton.icon(
            onPressed: _saving ? null : _save,
            icon: _saving
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.save_outlined),
            label: Text(_saving ? 'Saving…' : 'Save'),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (_successMsg != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.green.shade200),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle, color: Colors.green),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _successMsg!,
                          style: const TextStyle(color: Colors.green),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Text(_error!, style: TextStyle(color: Colors.red.shade700)),
                ),
              ),

            // ── Basic info ─────────────────────────────────────────────
            _sectionHeader(context, 'Basic Information'),
            const SizedBox(height: 12),
            TextFormField(
              controller: _displayTitleController,
              decoration: InputDecoration(
                labelText: l10n.commonProfessionalTitle,
                hintText: l10n.commonEgSeniorPartnerIpSpecialist,
                prefixIcon: Icon(Icons.badge_outlined),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _yearsExpController,
                    decoration: InputDecoration(
                      labelText: l10n.commonYearsOfExperience,
                      prefixIcon: Icon(Icons.history_edu_outlined),
                    ),
                    keyboardType: TextInputType.number,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _consultFeeController,
                    decoration: InputDecoration(
                      labelText: l10n.commonConsultationFee,
                      hintText: l10n.common15000,
                      prefixIcon: Icon(Icons.attach_money_outlined),
                    ),
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _bioController,
              minLines: 4,
              maxLines: 8,
              decoration: InputDecoration(
                labelText: l10n.commonProfessionalBio,
                hintText: l10n.commonDescribeYourExperienceSpecialtiesAndApproach,
                alignLabelWithHint: true,
                prefixIcon: Padding(
                  padding: EdgeInsets.only(bottom: 80),
                  child: Icon(Icons.person_outline),
                ),
              ),
            ),
            const SizedBox(height: 8),
            SwitchListTile(
              value: _acceptingLeads,
              onChanged: (v) => setState(() => _acceptingLeads = v),
              title: Text(l10n.commonAcceptingNewLeads),
              subtitle: Text(l10n.commonShowYourProfileOnTheMarketplace),
              secondary: const Icon(Icons.storefront_outlined),
              contentPadding: EdgeInsets.zero,
            ),

            const SizedBox(height: 24),
            const Divider(),
            const SizedBox(height: 16),

            // ── Practice areas ────────────────────────────────────────
            _sectionHeader(context, 'Practice Areas & Specialties'),
            const SizedBox(height: 4),
            Text(l10n.commonSelectAllAreasYouPracticeThenSetYourLevelForEach,
              style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey),
            ),
            const SizedBox(height: 12),
            ..._practiceAreas.map((pa) {
              final slug = pa['slug']!;
              final label = pa['label']!;
              final selected = _selectedPracticeAreas.contains(slug);
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                  side: BorderSide(
                    color: selected
                        ? theme.colorScheme.primary
                        : Colors.transparent,
                    width: selected ? 1.5 : 0,
                  ),
                ),
                child: CheckboxListTile(
                  value: selected,
                  onChanged: (v) {
                    setState(() {
                      if (v == true) {
                        _selectedPracticeAreas.add(slug);
                        _specialtyLevels.putIfAbsent(slug, () => 'PRACTITIONER');
                      } else {
                        _selectedPracticeAreas.remove(slug);
                        _specialtyLevels.remove(slug);
                      }
                    });
                  },
                  title: Text(label),
                  subtitle: selected
                      ? DropdownButton<String>(
                          value: _specialtyLevels[slug] ?? 'PRACTITIONER',
                          underline: const SizedBox.shrink(),
                          isDense: true,
                          items: [
                            DropdownMenuItem(
                              value: 'PRACTITIONER',
                              child: Text(l10n.commonPractitioner),
                            ),
                            DropdownMenuItem(
                              value: 'SPECIALIST',
                              child: Text(l10n.commonSpecialist),
                            ),
                            DropdownMenuItem(
                              value: 'EXPERT',
                              child: Text(l10n.commonExpertSenior),
                            ),
                          ],
                          onChanged: (v) {
                            if (v != null) {
                              setState(
                                () => _specialtyLevels[slug] = v,
                              );
                            }
                          },
                        )
                      : null,
                  secondary: Icon(
                    _practiceAreaIcon(slug),
                    color: selected
                        ? theme.colorScheme.primary
                        : Colors.grey,
                  ),
                  controlAffinity: ListTileControlAffinity.leading,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              );
            }),

            const SizedBox(height: 24),
            const Divider(),
            const SizedBox(height: 16),

            // ── Jurisdiction licenses ────────────────────────────────
            _sectionHeader(context, 'Bar Admissions & Licenses'),
            const SizedBox(height: 4),
            Text(l10n.commonSelectTheJurisdictionsWhereYouHoldAValidPracticingC,
              style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey),
            ),
            const SizedBox(height: 12),
            ..._jurisdictions.map((j) {
              final code = j['code']!;
              final label = j['label']!;
              final selected = _licensedJurisdictions.contains(code);
              return CheckboxListTile(
                value: selected,
                onChanged: (v) {
                  setState(() {
                    if (v == true) {
                      _licensedJurisdictions.add(code);
                    } else {
                      _licensedJurisdictions.remove(code);
                    }
                  });
                },
                title: Text(label),
                secondary: Icon(
                  Icons.gavel_outlined,
                  color: selected ? theme.colorScheme.primary : Colors.grey,
                ),
                controlAffinity: ListTileControlAffinity.leading,
              );
            }),

            const SizedBox(height: 32),
            ElevatedButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_outlined),
              label: Text(_saving ? 'Saving…' : 'Save Profile'),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _sectionHeader(BuildContext context, String title) {
    return Text(
      title,
      style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
          ),
    );
  }

  IconData _practiceAreaIcon(String slug) {
    switch (slug) {
      case 'litigation':
        return Icons.gavel;
      case 'corporate_commercial':
        return Icons.business;
      case 'real_estate_property':
        return Icons.home_work_outlined;
      case 'family_matrimonial':
        return Icons.family_restroom;
      case 'criminal_defence':
        return Icons.security_outlined;
      case 'employment_labour':
        return Icons.work_outline;
      case 'immigration':
        return Icons.flight_outlined;
      case 'intellectual_property':
        return Icons.lightbulb_outline;
      case 'tax_revenue':
        return Icons.calculate_outlined;
      case 'wills_estates_probate':
        return Icons.account_balance_outlined;
      default:
        return Icons.folder_outlined;
    }
  }
}
