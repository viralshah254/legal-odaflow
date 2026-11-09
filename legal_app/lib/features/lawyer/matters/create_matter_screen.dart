import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../core/config/matter_intake_config.dart';
import '../../../core/geo/jurisdiction_options.dart';
import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/conflicts_api.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../clients/clients_list_screen.dart';
import '../clients/create_client_sheet.dart';
import 'matters_list_screen.dart';

const _totalSteps = 5;

String _practiceAreaLabel(AppLocalizations l10n, String slug) {
  switch (slug) {
    case 'litigation_disputes':
      return l10n.commonLitigationDisputes;
    case 'corporate_commercial':
      return l10n.mattersPracticeAreasCorporateCommercial;
    case 'real_estate_property':
      return l10n.mattersPracticeAreasRealEstateProperty;
    case 'family_matrimonial':
      return l10n.mattersPracticeAreasFamilyMatrimonial;
    case 'criminal_defense':
      return l10n.mattersPracticeAreasCriminalDefence;
    case 'employment_labour':
      return l10n.mattersPracticeAreasEmploymentLabour;
    case 'immigration':
      return l10n.mattersPracticeAreasImmigration;
    case 'intellectual_property':
      return l10n.mattersPracticeAreasIntellectualProperty;
    case 'tax':
      return l10n.mattersPracticeAreasTaxRevenue;
    case 'wills_estates_probate':
      return l10n.mattersPracticeAreasWillsEstatesProbate;
    default:
      return slug.replaceAll('_', ' ');
  }
}

IconData _matterTypeIcon(String type) {
  switch (type) {
    case 'Litigation':
      return Icons.balance_outlined;
    case 'Transaction':
      return Icons.handshake_outlined;
    case 'Advisory':
      return Icons.lightbulb_outline;
    case 'Dispute':
      return Icons.gavel_outlined;
    case 'Registration':
      return Icons.assignment_outlined;
    case 'Compliance':
      return Icons.verified_outlined;
    case 'Drafting':
      return Icons.description_outlined;
    default:
      return Icons.folder_outlined;
  }
}

String _titlePlaceholder(AppLocalizations l10n, String matterType) {
  switch (matterType) {
    case 'Litigation':
      return l10n.mattersPlaceholderLitigationTitle;
    case 'Drafting':
      return l10n.mattersPlaceholderDraftingTitle;
    case 'Transaction':
      return l10n.mattersPlaceholderTransactionTitle;
    default:
      return l10n.mattersPlaceholderMatterTitle;
  }
}

class CreateMatterScreen extends ConsumerStatefulWidget {
  const CreateMatterScreen({super.key, this.initialClientId});

  final String? initialClientId;

  @override
  ConsumerState<CreateMatterScreen> createState() => _CreateMatterScreenState();
}

class _CreateMatterScreenState extends ConsumerState<CreateMatterScreen> {
  final _pageController = PageController();
  final _basicsFormKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _jurisdictionController = TextEditingController();
  final _opposingPartyController = TextEditingController();
  final _desiredOutcomeController = TextEditingController();
  final _courtNameController = TextEditingController();
  final _caseNumberController = TextEditingController();
  final _factsController = TextEditingController();
  final _formSearchController = TextEditingController();

  int _currentStep = 0;
  String _practiceArea = practiceAreaConfigs.first.slug;
  String _matterType = practiceAreaConfigs.first.defaultMatterType;
  String? _clientId;
  String? _clientName;
  String? _clientEmail;
  String? _courtLevel;
  bool _submitting = false;
  bool _conflictClear = false;
  bool _checkingConflict = false;
  String? _error;
  String? _conflictError;
  ConflictCheckResult? _conflictResult;
  List<_LegalFormItem> _availableForms = [];
  bool _loadingForms = false;
  final Set<String> _selectedFormIds = {};
  String _formSearch = '';
  String? _selectedCountry;
  bool _countryManuallySelected = false;
  String? _selectedStateJurisdiction;

  @override
  void initState() {
    super.initState();
    _clientId = widget.initialClientId;
    _selectedCountry = _countryCode;
    ref.read(workCountryProvider.future).then((country) {
      if (!mounted || _countryManuallySelected) return;
      setState(() => _selectedCountry = country);
    });
    _formSearchController.addListener(_onFormSearchChanged);
    _opposingPartyController.addListener(_invalidateConflictCheck);
    if (widget.initialClientId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadInitialClient());
    }
  }

  void _onFormSearchChanged() {
    if (!mounted) return;
    setState(() => _formSearch = _formSearchController.text.trim());
  }

  void _invalidateConflictCheck() {
    if (!mounted) return;
    if (!_conflictClear && _conflictResult == null) return;
    setState(() {
      _conflictClear = false;
      _conflictResult = null;
      _conflictError = null;
    });
  }

  Future<void> _loadInitialClient() async {
    final clientId = widget.initialClientId;
    if (clientId == null || clientId.isEmpty) return;
    final tenantId =
        ref.read(authControllerProvider).session?.user.tenantId ?? '';
    if (tenantId.isEmpty) return;
    try {
      final client = await ref.read(clientsApiProvider).getClient(
            tenantId: tenantId,
            clientId: clientId,
          );
      if (mounted) {
        setState(() {
          _clientName = client.name;
          _clientEmail = client.email;
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _formSearchController.removeListener(_onFormSearchChanged);
    _opposingPartyController.removeListener(_invalidateConflictCheck);
    _pageController.dispose();
    _titleController.dispose();
    _jurisdictionController.dispose();
    _opposingPartyController.dispose();
    _desiredOutcomeController.dispose();
    _courtNameController.dispose();
    _caseNumberController.dispose();
    _factsController.dispose();
    _formSearchController.dispose();
    super.dispose();
  }

  PracticeAreaConfig get _paConfig =>
      practiceAreaConfigFor(_practiceArea) ?? practiceAreaConfigs.first;

  List<MatterTypeOption> get _matterTypeOptions => _paConfig.matterTypes
      .map(matterTypeOptionFor)
      .whereType<MatterTypeOption>()
      .toList();

  String get _countryCode =>
      _selectedCountry ?? ref.read(authControllerProvider).session?.user.countryCode ??
      AppConfig.defaultCountry;

  List<Map<String, String?>> get _partiesForConflict {
    final parties = <Map<String, String?>>[];
    if (_clientName != null && _clientName!.trim().isNotEmpty) {
      parties.add({'name': _clientName, 'email': _clientEmail});
    }
    final opposing = _opposingPartyController.text.trim();
    if (opposing.isNotEmpty) {
      parties.add({'name': opposing});
    }
    return parties;
  }

  void _goToStep(int step) {
    setState(() => _currentStep = step);
    _pageController.animateToPage(
      step,
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeInOutCubic,
    );
  }

  void _handlePracticeAreaChange(String slug) {
    final config = practiceAreaConfigFor(slug) ?? practiceAreaConfigs.first;
    setState(() {
      _practiceArea = slug;
      _matterType = config.defaultMatterType;
      _opposingPartyController.clear();
      _desiredOutcomeController.clear();
      _courtNameController.clear();
      _caseNumberController.clear();
      _courtLevel = null;
      _selectedFormIds.clear();
      _invalidateConflictCheck();
    });
    _loadFormsIfNeeded();
  }

  void _handleMatterTypeChange(String value) {
    setState(() {
      _matterType = value;
      if (!showsOpposingParty(value)) _opposingPartyController.clear();
      if (!showsDesiredOutcome(value)) _desiredOutcomeController.clear();
      if (!showsCourtFields(value)) {
        _courtNameController.clear();
        _caseNumberController.clear();
        _courtLevel = null;
      }
      if (!showsFormPicker(value)) _selectedFormIds.clear();
      _invalidateConflictCheck();
    });
    _loadFormsIfNeeded();
  }

  Future<void> _loadFormsIfNeeded() async {
    if (!showsFormPicker(_matterType)) {
      setState(() {
        _availableForms = [];
        _loadingForms = false;
      });
      return;
    }

    setState(() => _loadingForms = true);
    try {
      final tenantId =
          ref.read(authControllerProvider).session?.user.tenantId ?? '';
      final response = await ref.read(apiClientProvider).dio.get<dynamic>(
            '/legal-forms',
            queryParameters: {
              'countryCode': _countryCode,
              'practiceArea': _practiceArea,
            },
            options: tenantId.isNotEmpty
                ? Options(headers: {'X-Tenant-Id': tenantId})
                : null,
          );
      final forms = (response.data as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(_LegalFormItem.fromJson)
          .toList();
      if (mounted) setState(() => _availableForms = forms);
    } catch (_) {
      if (mounted) setState(() => _availableForms = []);
    } finally {
      if (mounted) setState(() => _loadingForms = false);
    }
  }

  bool _validateCurrentStep() {
    final l10n = AppLocalizations.of(context);
    switch (_currentStep) {
      case 1:
        if (!(_basicsFormKey.currentState?.validate() ?? false)) return false;
        if (_clientId == null || _clientId!.isEmpty) {
          setState(() => _error = l10n.mattersClientRequiredError);
          return false;
        }
        return true;
      default:
        return true;
    }
  }

  Future<void> _handleNext() async {
    setState(() => _error = null);
    if (!_validateCurrentStep()) return;

    if (_currentStep == 1 && showsFormPicker(_matterType) && _availableForms.isEmpty) {
      await _loadFormsIfNeeded();
    }

    if (_currentStep < _totalSteps - 1) {
      _goToStep(_currentStep + 1);
    } else {
      await _submit();
    }
  }

  Future<void> _runConflictCheck() async {
    final l10n = AppLocalizations.of(context);
    final parties = _partiesForConflict;
    if (parties.isEmpty) {
      setState(
        () => _conflictError = l10n.mattersAddPartyForConflictCheck,
      );
      return;
    }

    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null || tenantId.isEmpty) return;

    setState(() {
      _checkingConflict = true;
      _conflictError = null;
    });

    try {
      final result = await ref.read(conflictsApiProvider).createConflictCheck(
            tenantId: tenantId,
            clientId: _clientId,
            parties: parties,
          );
      if (!mounted) return;
      setState(() {
        _conflictResult = result;
        _conflictClear = result.isClear;
      });
    } on ApiException catch (error) {
      if (mounted) setState(() => _conflictError = error.message);
    } catch (_) {
      if (mounted) {
        setState(() => _conflictError = l10n.mattersConflictCheckRequiredError);
      }
    } finally {
      if (mounted) setState(() => _checkingConflict = false);
    }
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    if (!_conflictClear) {
      setState(() => _error = l10n.mattersConflictCheckRequiredError);
      return;
    }

    final user = ref.read(authControllerProvider).session?.user;
    final tenantId = user?.tenantId;
    if (tenantId == null || tenantId.isEmpty) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final matter = await ref.read(mattersApiProvider).createMatter(
            tenantId: tenantId,
            title: _titleController.text.trim(),
            countryCode: _selectedCountry ?? user?.countryCode ?? AppConfig.defaultCountry,
            practiceArea: _practiceArea,
            matterType: _matterType,
            clientId: _clientId,
            jurisdiction: [
              if (_selectedStateJurisdiction != null) _selectedStateJurisdiction!,
              if (_selectedCountry != null)
                AppConfig.countryNames[_selectedCountry] ?? _selectedCountry!,
            ].join(', '),
            factsSummary: _factsController.text.trim(),
            desiredOutcome: _desiredOutcomeController.text.trim(),
            opposingParty: _opposingPartyController.text.trim(),
            courtName: _courtNameController.text.trim(),
            courtLevel: _courtLevel,
            caseNumber: _caseNumberController.text.trim(),
          );
      ref.invalidate(mattersListProvider);
      ref.read(mattersListRefreshProvider.notifier).state++;
      if (!mounted) return;
      context.go('/lawyer/matters/${matter.id}');
    } on ApiException catch (error) {
      setState(() => _error = error.message);
    } catch (_) {
      setState(() => _error = l10n.mattersUnableToCreateMatter);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _pickClient() async {
    final user = ref.read(authControllerProvider).session?.user;
    final tenantId = user?.tenantId ?? '';
    final countryCode = user?.countryCode ?? AppConfig.defaultCountry;

    final result = await showModalBottomSheet<FirmClient>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _ClientPickerSheet(
        tenantId: tenantId,
        countryCode: countryCode,
        ref: ref,
      ),
    );
    if (result != null) {
      setState(() {
        _clientId = result.id;
        _clientName = result.name;
        _clientEmail = result.email;
        _invalidateConflictCheck();
      });
    }
  }

  List<String> get _stepLabels {
    final l10n = AppLocalizations.of(context);
    return [
      l10n.mattersIntakeStepType,
      l10n.mattersIntakeStepBasics,
      l10n.mattersIntakeStepSpecifics,
      l10n.mattersIntakeStepBackground,
      l10n.mattersIntakeStepReview,
    ];
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final isLastStep = _currentStep == _totalSteps - 1;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.mattersNewMatter),
            Text(
              l10n.mattersIntakeSubtitle,
              style: textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.normal,
              ),
            ),
          ],
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(4),
          child: LinearProgressIndicator(
            value: (_currentStep + 1) / _totalSteps,
            backgroundColor: colorScheme.surfaceContainerHighest,
            valueColor: AlwaysStoppedAnimation<Color>(colorScheme.primary),
            minHeight: 4,
          ),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
            child: Row(
              children: [
                for (var i = 0; i < _stepLabels.length; i++) ...[
                  if (i > 0)
                    _StepDivider(active: _currentStep > i - 1),
                  _StepChip(
                    index: i,
                    current: _currentStep,
                    label: _stepLabels[i],
                  ),
                ],
              ],
            ),
          ),
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _StepClassification(
                  practiceArea: _practiceArea,
                  matterType: _matterType,
                  matterTypeOptions: _matterTypeOptions,
                  practiceAreaLabel: _practiceAreaLabel,
                  onPracticeAreaChanged: _handlePracticeAreaChange,
                  onMatterTypeChanged: _handleMatterTypeChange,
                ),
                _StepBasics(
                  formKey: _basicsFormKey,
                  titleController: _titleController,
                  titlePlaceholder: _titlePlaceholder(l10n, _matterType),
                  selectedCountry: _selectedCountry,
                  onCountryChanged: (country) {
                    setState(() {
                      _countryManuallySelected = true;
                      _selectedCountry = country;
                      _selectedStateJurisdiction = null;
                      _jurisdictionController.text = '';
                    });
                  },
                  selectedState: _selectedStateJurisdiction,
                  onStateChanged: (state) {
                    setState(() {
                      _selectedStateJurisdiction = state;
                      _jurisdictionController.text = state ?? '';
                    });
                  },
                  clientName: _clientName,
                  onPickClient: _pickClient,
                  onClearClient: () => setState(() {
                    _clientId = null;
                    _clientName = null;
                    _clientEmail = null;
                    _invalidateConflictCheck();
                  }),
                ),
                _StepSpecifics(
                  matterType: _matterType,
                  opposingPartyController: _opposingPartyController,
                  desiredOutcomeController: _desiredOutcomeController,
                  courtNameController: _courtNameController,
                  caseNumberController: _caseNumberController,
                  courtLevel: _courtLevel,
                  onCourtLevelChanged: (v) => setState(() => _courtLevel = v),
                  loadingForms: _loadingForms,
                  availableForms: _filteredForms,
                  selectedFormIds: _selectedFormIds,
                  formSearchController: _formSearchController,
                  onToggleForm: (id) => setState(() {
                    if (_selectedFormIds.contains(id)) {
                      _selectedFormIds.remove(id);
                    } else {
                      _selectedFormIds.add(id);
                    }
                  }),
                ),
                _StepBackground(factsController: _factsController),
                _StepReview(
                  practiceAreaLabel:
                      _practiceAreaLabel(l10n, _practiceArea),
                  matterType: _matterType,
                  title: _titleController.text.trim(),
                  clientName: _clientName,
                  jurisdiction: [
                    if (_selectedStateJurisdiction != null) _selectedStateJurisdiction!,
                    if (_selectedCountry != null)
                      AppConfig.countryNames[_selectedCountry] ?? _selectedCountry!,
                  ].join(', '),
                  opposingParty: _opposingPartyController.text.trim(),
                  desiredOutcome: _desiredOutcomeController.text.trim(),
                  courtName: _courtNameController.text.trim(),
                  courtLevel: _courtLevel,
                  caseNumber: _caseNumberController.text.trim(),
                  factsSummary: _factsController.text.trim(),
                  selectedFormCount: _selectedFormIds.length,
                  parties: _partiesForConflict,
                  conflictClear: _conflictClear,
                  checkingConflict: _checkingConflict,
                  conflictError: _conflictError,
                  conflictResult: _conflictResult,
                  onRunConflictCheck: _runConflictCheck,
                ),
              ],
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: colorScheme.errorContainer.withValues(alpha: 0.45),
                  borderRadius: BorderRadius.circular(AppColors.radius),
                ),
                child: Text(
                  _error!,
                  style: TextStyle(color: colorScheme.onErrorContainer),
                ),
              ),
            ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: Row(
                children: [
                  if (_currentStep > 0)
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _submitting
                            ? null
                            : () => _goToStep(_currentStep - 1),
                        child: Text(l10n.commonBack),
                      ),
                    ),
                  if (_currentStep > 0) const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: FilledButton.icon(
                      onPressed: (_submitting ||
                              (isLastStep &&
                                  (!_conflictClear || _checkingConflict)))
                          ? null
                          : _handleNext,
                      icon: _submitting
                          ? SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: colorScheme.onPrimary,
                              ),
                            )
                          : Icon(
                              isLastStep ? Icons.check : Icons.arrow_forward,
                              size: 18,
                            ),
                      label: Text(
                        _submitting
                            ? l10n.mattersCreatingMatterEllipsis
                            : isLastStep
                                ? l10n.mattersCreateMatter
                                : l10n.commonNext,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (isLastStep && !_conflictClear && _titleController.text.trim().isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                l10n.mattersCompleteConflictCheckHint,
                style: textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
            ),
        ],
      ),
    );
  }

  List<_LegalFormItem> get _filteredForms {
    if (_formSearch.isEmpty) return _availableForms;
    final q = _formSearch.toLowerCase();
    return _availableForms
        .where(
          (form) =>
              form.formName.toLowerCase().contains(q) ||
              (form.authority?.toLowerCase().contains(q) ?? false) ||
              (form.description?.toLowerCase().contains(q) ?? false) ||
              (form.formNumber?.toLowerCase().contains(q) ?? false),
        )
        .toList();
  }
}

// ─── Step widgets ───────────────────────────────────────────────────────────

class _StepClassification extends StatelessWidget {
  const _StepClassification({
    required this.practiceArea,
    required this.matterType,
    required this.matterTypeOptions,
    required this.practiceAreaLabel,
    required this.onPracticeAreaChanged,
    required this.onMatterTypeChanged,
  });

  final String practiceArea;
  final String matterType;
  final List<MatterTypeOption> matterTypeOptions;
  final String Function(AppLocalizations, String) practiceAreaLabel;
  final ValueChanged<String> onPracticeAreaChanged;
  final ValueChanged<String> onMatterTypeChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          l10n.mattersClassification,
          style: textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 6),
        Text(
          l10n.mattersClassificationDescription,
          style: textTheme.bodyMedium?.copyWith(
            color: colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 20),
        Text(
          l10n.mattersPracticeArea,
          style: textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          initialValue: practiceArea,
          decoration: InputDecoration(
            prefixIcon: const Icon(Icons.work_outline, size: 20),
          ),
          items: practiceAreaConfigs
              .map(
                (config) => DropdownMenuItem(
                  value: config.slug,
                  child: Text(practiceAreaLabel(l10n, config.slug)),
                ),
              )
              .toList(),
          onChanged: (value) {
            if (value != null) onPracticeAreaChanged(value);
          },
        ),
        const SizedBox(height: 24),
        Text(
          l10n.mattersMatterType,
          style: textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 10),
        ...matterTypeOptions.map((option) {
          final selected = option.value == matterType;
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Material(
              color: selected
                  ? colorScheme.primaryContainer.withValues(alpha: 0.35)
                  : colorScheme.surfaceContainerLow,
              borderRadius: BorderRadius.circular(AppColors.radius),
              child: InkWell(
                borderRadius: BorderRadius.circular(AppColors.radius),
                onTap: () => onMatterTypeChanged(option.value),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(AppColors.radius),
                    border: Border.all(
                      color: selected
                          ? colorScheme.primary
                          : colorScheme.outline.withValues(alpha: 0.35),
                      width: selected ? 1.5 : 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _matterTypeIcon(option.value),
                        color: selected
                            ? colorScheme.primary
                            : colorScheme.onSurfaceVariant,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              option.label,
                              style: textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: selected
                                    ? colorScheme.primary
                                    : colorScheme.onSurface,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              option.description,
                              style: textTheme.bodySmall?.copyWith(
                                color: colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (selected)
                        Icon(Icons.check_circle, color: colorScheme.primary),
                    ],
                  ),
                ),
              ),
            ),
          );
        }),
      ],
    );
  }
}

class _StepBasics extends StatelessWidget {
  const _StepBasics({
    required this.formKey,
    required this.titleController,
    required this.titlePlaceholder,
    required this.selectedCountry,
    required this.onCountryChanged,
    required this.selectedState,
    required this.onStateChanged,
    required this.clientName,
    required this.onPickClient,
    required this.onClearClient,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController titleController;
  final String titlePlaceholder;
  final String? selectedCountry;
  final ValueChanged<String?> onCountryChanged;
  final String? selectedState;
  final ValueChanged<String?> onStateChanged;
  final String? clientName;
  final VoidCallback onPickClient;
  final VoidCallback onClearClient;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final stateOptions = JurisdictionOptions.forCountry(selectedCountry);
    final stateLabel = JurisdictionOptions.dropdownLabel(selectedCountry);

    return Form(
      key: formKey,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            l10n.mattersMatterDetails,
            style: textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 20),
          Text(
            '${l10n.mattersMatterTitle} *',
            style: textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: titleController,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(hintText: titlePlaceholder),
            validator: (value) {
              if (value == null || value.trim().length < 2) {
                return l10n.mattersMatterTitleRequired;
              }
              return null;
            },
          ),
          const SizedBox(height: 18),
          Text(
            '${l10n.clientsSelectClient} *',
            style: textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: onPickClient,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              decoration: BoxDecoration(
                color: Theme.of(context).inputDecorationTheme.fillColor,
                borderRadius: BorderRadius.circular(AppColors.radius),
                border: Border.all(
                  color: clientName == null
                      ? colorScheme.tertiary.withValues(alpha: 0.6)
                      : colorScheme.outline.withValues(alpha: 0.5),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.person_outline,
                    size: 18,
                    color: clientName != null
                        ? colorScheme.primary
                        : colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      clientName ?? l10n.clientsSelectOrAddClient,
                      style: TextStyle(
                        color: clientName != null
                            ? colorScheme.onSurface
                            : colorScheme.onSurfaceVariant,
                        fontWeight: clientName != null
                            ? FontWeight.w600
                            : FontWeight.normal,
                      ),
                    ),
                  ),
                  if (clientName != null)
                    GestureDetector(
                      onTap: onClearClient,
                      child: Icon(
                        Icons.close,
                        size: 18,
                        color: colorScheme.onSurfaceVariant,
                      ),
                    )
                  else
                    Icon(
                      Icons.search,
                      size: 18,
                      color: colorScheme.onSurfaceVariant,
                    ),
                ],
              ),
            ),
          ),
          if (clientName == null) ...[
            const SizedBox(height: 6),
            Text(
              l10n.mattersClientRequiredError,
              style: textTheme.bodySmall?.copyWith(color: colorScheme.tertiary),
            ),
          ],
          const SizedBox(height: 24),
          // ── Jurisdiction section ──────────────────────────────
          Row(
            children: [
              const Icon(Icons.location_on_outlined, size: 16),
              const SizedBox(width: 6),
              Text(
                'Jurisdiction',
                style: textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(width: 6),
              Text(
                '(optional)',
                style: textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Country dropdown
          DropdownButtonFormField<String?>(
            initialValue: selectedCountry,
            isExpanded: true,
            decoration: InputDecoration(
              labelText: 'Country',
              prefixIcon: const Icon(Icons.public_outlined, size: 20),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppColors.radius),
              ),
            ),
            items: [
              const DropdownMenuItem<String?>(
                value: null,
                child: Text('Select country'),
              ),
              ...{...AppConfig.supportedCountryCodes, if (selectedCountry != null) selectedCountry!}.map((code) {
                return DropdownMenuItem<String?>(
                  value: code,
                  child: Text(AppConfig.countryNames[code] ?? code),
                );
              }),
            ],
            onChanged: onCountryChanged,
          ),
          // State / region dropdown — only when options exist for selected country
          if (stateOptions != null) ...[
            const SizedBox(height: 12),
            DropdownButtonFormField<String?>(
              initialValue: selectedState,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: stateLabel,
                prefixIcon: const Icon(Icons.map_outlined, size: 20),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppColors.radius),
                ),
              ),
              items: [
                DropdownMenuItem<String?>(
                  value: null,
                  child: Text('Select ${stateLabel.split(' ').first.toLowerCase()}'),
                ),
                ...stateOptions.map((state) {
                  return DropdownMenuItem<String?>(value: state, child: Text(state));
                }),
              ],
              onChanged: onStateChanged,
            ),
          ],
        ],
      ),
    );
  }
}

class _StepSpecifics extends StatelessWidget {
  const _StepSpecifics({
    required this.matterType,
    required this.opposingPartyController,
    required this.desiredOutcomeController,
    required this.courtNameController,
    required this.caseNumberController,
    required this.courtLevel,
    required this.onCourtLevelChanged,
    required this.loadingForms,
    required this.availableForms,
    required this.selectedFormIds,
    required this.formSearchController,
    required this.onToggleForm,
  });

  final String matterType;
  final TextEditingController opposingPartyController;
  final TextEditingController desiredOutcomeController;
  final TextEditingController courtNameController;
  final TextEditingController caseNumberController;
  final String? courtLevel;
  final ValueChanged<String?> onCourtLevelChanged;
  final bool loadingForms;
  final List<_LegalFormItem> availableForms;
  final Set<String> selectedFormIds;
  final TextEditingController formSearchController;
  final ValueChanged<String> onToggleForm;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final showParties =
        showsOpposingParty(matterType) || showsDesiredOutcome(matterType);
    final showCourt = showsCourtFields(matterType);
    final showForms = showsFormPicker(matterType);

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          l10n.mattersIntakeStepSpecifics,
          style: textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 16),
        if (!showParties && !showCourt && !showForms)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: colorScheme.surfaceContainerLow,
              borderRadius: BorderRadius.circular(AppColors.radius),
            ),
            child: Text(
              l10n.mattersNoAdditionalFieldsForType,
              style: textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        if (showParties) ...[
          _SectionHeader(
            icon: Icons.balance_outlined,
            title: l10n.mattersPartiesAndOutcome,
            subtitle: l10n.mattersAdversarialDetailsDescription,
            accent: colorScheme.tertiary,
          ),
          if (showsOpposingParty(matterType)) ...[
            const SizedBox(height: 12),
            TextFormField(
              controller: opposingPartyController,
              decoration: InputDecoration(
                labelText: l10n.mattersOpposingParty,
                hintText: l10n.mattersFullLegalNameOfOpposingParty,
              ),
            ),
          ],
          if (showsDesiredOutcome(matterType)) ...[
            const SizedBox(height: 12),
            TextFormField(
              controller: desiredOutcomeController,
              minLines: 2,
              maxLines: 4,
              decoration: InputDecoration(
                labelText: l10n.mattersDesiredOutcome,
                hintText: l10n.mattersWhatResultDoesYourClientSeek,
                alignLabelWithHint: true,
              ),
            ),
          ],
          const SizedBox(height: 20),
        ],
        if (showCourt) ...[
          _SectionHeader(
            icon: Icons.gavel_outlined,
            title: l10n.mattersCourtDetails,
            subtitle: l10n.mattersCourtDetailsBlankHint,
            accent: colorScheme.primary,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: courtNameController,
            decoration: InputDecoration(
              labelText: l10n.mattersCourtName,
              hintText: l10n.mattersEgHighCourtOfKenya,
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String?>(
            initialValue: courtLevel,
            decoration: InputDecoration(labelText: l10n.mattersCourtLevel),
            items: [
              DropdownMenuItem<String?>(
                value: null,
                child: Text(l10n.mattersNotSpecified),
              ),
              ...courtLevelOptions.map(
                (opt) => DropdownMenuItem<String?>(
                  value: opt.value,
                  child: Text(opt.label),
                ),
              ),
            ],
            onChanged: onCourtLevelChanged,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: caseNumberController,
            decoration: InputDecoration(
              labelText: l10n.mattersCaseFileNumber,
              hintText: 'e.g. HCCC 123/2026',
            ),
          ),
          const SizedBox(height: 20),
        ],
        if (showForms) ...[
          _SectionHeader(
            icon: Icons.description_outlined,
            title: l10n.mattersStandardFormsAndTemplates,
            subtitle: l10n.mattersFormsPickerDescription,
            accent: colorScheme.secondary,
            trailing: Chip(
              label: Text(l10n.commonOptional),
              visualDensity: VisualDensity.compact,
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
          const SizedBox(height: 12),
          if (loadingForms)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: colorScheme.primary,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(l10n.mattersLoadingRelevantForms),
                ],
              ),
            )
          else if (availableForms.isEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                border: Border.all(
                  color: colorScheme.outline.withValues(alpha: 0.4),
                ),
                borderRadius: BorderRadius.circular(AppColors.radius),
              ),
              child: Text(
                l10n.mattersNoStandardFormsFound,
                style: textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
            )
          else ...[
            TextField(
              controller: formSearchController,
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search, size: 18),
                hintText: l10n.mattersSearchFormsByNameAuthorityOrNumber,
              ),
            ),
            const SizedBox(height: 10),
            ...availableForms.take(8).map((form) {
              final selected = selectedFormIds.contains(form.id);
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Material(
                  color: selected
                      ? colorScheme.primaryContainer.withValues(alpha: 0.25)
                      : colorScheme.surface,
                  borderRadius: BorderRadius.circular(AppColors.radius),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(AppColors.radius),
                    onTap: () => onToggleForm(form.id),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(AppColors.radius),
                        border: Border.all(
                          color: selected
                              ? colorScheme.primary
                              : colorScheme.outline.withValues(alpha: 0.35),
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  form.formName,
                                  style: textTheme.bodyMedium?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                if (form.authority != null) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    form.authority!,
                                    style: textTheme.bodySmall?.copyWith(
                                      color: colorScheme.onSurfaceVariant,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          Icon(
                            selected
                                ? Icons.check_box
                                : Icons.check_box_outline_blank,
                            color: selected
                                ? colorScheme.primary
                                : colorScheme.onSurfaceVariant,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }),
          ],
        ],
      ],
    );
  }
}

class _StepBackground extends StatelessWidget {
  const _StepBackground({required this.factsController});

  final TextEditingController factsController;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          l10n.mattersBackground,
          style: textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 16),
        TextFormField(
          controller: factsController,
          minLines: 6,
          maxLines: 12,
          decoration: InputDecoration(
            labelText: l10n.mattersFactsSummaryOptional,
            hintText: l10n.mattersFactsSummaryPlaceholder,
            alignLabelWithHint: true,
          ),
        ),
      ],
    );
  }
}

class _StepReview extends StatelessWidget {
  const _StepReview({
    required this.practiceAreaLabel,
    required this.matterType,
    required this.title,
    required this.clientName,
    required this.jurisdiction,
    required this.opposingParty,
    required this.desiredOutcome,
    required this.courtName,
    required this.courtLevel,
    required this.caseNumber,
    required this.factsSummary,
    required this.selectedFormCount,
    required this.parties,
    required this.conflictClear,
    required this.checkingConflict,
    required this.conflictError,
    required this.conflictResult,
    required this.onRunConflictCheck,
  });

  final String practiceAreaLabel;
  final String matterType;
  final String title;
  final String? clientName;
  final String jurisdiction;
  final String opposingParty;
  final String desiredOutcome;
  final String courtName;
  final String? courtLevel;
  final String caseNumber;
  final String factsSummary;
  final int selectedFormCount;
  final List<Map<String, String?>> parties;
  final bool conflictClear;
  final bool checkingConflict;
  final String? conflictError;
  final ConflictCheckResult? conflictResult;
  final VoidCallback onRunConflictCheck;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          l10n.mattersIntakeStepReview,
          style: textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 16),
        _ReviewCard(
          children: [
            _ReviewRow(
              icon: _matterTypeIcon(matterType),
              label: l10n.mattersMatterType,
              value: matterType,
            ),
            _ReviewRow(
              icon: Icons.work_outline,
              label: l10n.mattersPracticeArea,
              value: practiceAreaLabel,
            ),
            _ReviewRow(
              icon: Icons.title_outlined,
              label: l10n.mattersMatterTitle,
              value: title.isEmpty ? '—' : title,
            ),
            _ReviewRow(
              icon: Icons.person_outline,
              label: l10n.clientsSelectClient,
              value: clientName ?? l10n.mattersNoClientLinked,
            ),
            if (jurisdiction.isNotEmpty)
              _ReviewRow(
                icon: Icons.location_on_outlined,
                label: l10n.mattersJurisdictionOptional,
                value: jurisdiction,
              ),
            if (opposingParty.isNotEmpty)
              _ReviewRow(
                icon: Icons.balance_outlined,
                label: l10n.mattersOpposingParty,
                value: opposingParty,
              ),
            if (desiredOutcome.isNotEmpty)
              _ReviewRow(
                icon: Icons.flag_outlined,
                label: l10n.mattersDesiredOutcome,
                value: desiredOutcome,
              ),
            if (courtName.isNotEmpty)
              _ReviewRow(
                icon: Icons.account_balance_outlined,
                label: l10n.mattersCourtName,
                value: courtName,
              ),
            if (selectedFormCount > 0)
              _ReviewRow(
                icon: Icons.description_outlined,
                label: l10n.mattersStandardFormsAndTemplates,
                value: l10n.mattersFormsSelectedCount(selectedFormCount),
              ),
          ],
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.shield_outlined, color: colorScheme.primary),
                    const SizedBox(width: 8),
                    Text(
                      l10n.mattersConflictCheckTitle,
                      style: textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  l10n.mattersConflictCheckDescription,
                  style: textTheme.bodySmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 12),
                if (parties.isEmpty)
                  Text(
                    l10n.mattersConflictCheckPartyHint,
                    style: textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  )
                else
                  ...parties.map(
                    (party) => Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(
                        '• ${party['name'] ?? 'Unnamed'}${party['email'] != null ? ' (${party['email']})' : ''}',
                        style: textTheme.bodySmall,
                      ),
                    ),
                  ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed:
                      checkingConflict || parties.isEmpty ? null : onRunConflictCheck,
                  icon: checkingConflict
                      ? SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: colorScheme.primary,
                          ),
                        )
                      : const Icon(Icons.shield_outlined, size: 18),
                  label: Text(
                    checkingConflict
                        ? l10n.mattersCheckingConflict
                        : l10n.mattersRunConflictCheck,
                  ),
                ),
                if (conflictError != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    conflictError!,
                    style: TextStyle(color: colorScheme.error, fontSize: 13),
                  ),
                ],
                if (conflictResult != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: conflictResult!.isClear
                          ? colorScheme.primaryContainer.withValues(alpha: 0.35)
                          : colorScheme.errorContainer.withValues(alpha: 0.35),
                      borderRadius: BorderRadius.circular(AppColors.radius),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              conflictResult!.isClear
                                  ? Icons.check_circle_outline
                                  : Icons.warning_amber_outlined,
                              size: 18,
                              color: conflictResult!.isClear
                                  ? colorScheme.primary
                                  : colorScheme.error,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              conflictResult!.isClear
                                  ? l10n.commonClear
                                  : l10n.commonReviewRequired,
                              style: textTheme.labelLarge?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                        if (conflictResult!.summary != null) ...[
                          const SizedBox(height: 6),
                          Text(
                            conflictResult!.summary!,
                            style: textTheme.bodySmall,
                          ),
                        ],
                        ...conflictResult!.matches.map(
                          (match) => Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(
                              '${match.name} · ${match.reason}',
                              style: textTheme.bodySmall,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.accent,
    this.trailing,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color accent;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: accent),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  if (trailing != null) trailing!,
                ],
              ),
              Text(
                subtitle,
                style: textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(AppColors.radius),
        border: Border.all(color: colorScheme.outline.withValues(alpha: 0.25)),
      ),
      child: Column(children: children),
    );
  }
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: colorScheme.onSurfaceVariant),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: textTheme.labelSmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
                Text(
                  value,
                  style: textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StepChip extends StatelessWidget {
  const _StepChip({
    required this.index,
    required this.current,
    required this.label,
  });

  final int index;
  final int current;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final done = index < current;
    final active = index == current;

    return Expanded(
      child: Column(
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: done || active
                  ? colorScheme.primary
                  : colorScheme.surfaceContainerHighest,
            ),
            child: Center(
              child: done
                  ? Icon(Icons.check, size: 12, color: colorScheme.onPrimary)
                  : Text(
                      '${index + 1}',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: active
                            ? colorScheme.onPrimary
                            : colorScheme.onSurfaceVariant,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 10,
              fontWeight: active ? FontWeight.w700 : FontWeight.w500,
              color: active
                  ? colorScheme.primary
                  : colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _StepDivider extends StatelessWidget {
  const _StepDivider({required this.active});

  final bool active;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Container(
        width: 10,
        height: 1,
        color: active
            ? colorScheme.primary
            : colorScheme.outlineVariant.withValues(alpha: 0.6),
      ),
    );
  }
}

class _LegalFormItem {
  _LegalFormItem({
    required this.id,
    required this.formName,
    this.authority,
    this.description,
    this.formNumber,
  });

  factory _LegalFormItem.fromJson(Map<String, dynamic> json) => _LegalFormItem(
        id: json['id'] as String,
        formName: json['formName'] as String? ?? 'Form',
        authority: json['authority'] as String?,
        description: json['description'] as String?,
        formNumber: json['formNumber'] as String?,
      );

  final String id;
  final String formName;
  final String? authority;
  final String? description;
  final String? formNumber;
}

// ============================================================================
// Client picker bottom sheet (unchanged)
// ============================================================================

class _ClientPickerSheet extends ConsumerStatefulWidget {
  const _ClientPickerSheet({
    required this.tenantId,
    required this.countryCode,
    required this.ref,
  });

  final String tenantId;
  final String countryCode;
  final WidgetRef ref;

  @override
  ConsumerState<_ClientPickerSheet> createState() => _ClientPickerSheetState();
}

class _ClientPickerSheetState extends ConsumerState<_ClientPickerSheet> {
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _openAddClient() async {
    final created = await showCreateClientSheet(context, ref);
    if (created != null && mounted) {
      Navigator.of(context).pop(created);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    final clientsAsync = ref.watch(clientsListProvider(_query.isEmpty ? null : _query));

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: colorScheme.onSurfaceVariant.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Text(
                  l10n.clientsSelectClient,
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: _openAddClient,
                  icon: const Icon(Icons.add, size: 16),
                  label: Text(l10n.clientsNewClient),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              controller: _searchCtrl,
              autofocus: true,
              onChanged: (v) => setState(() => _query = v.trim()),
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search, size: 18),
                hintText: l10n.clientsSearchByNameOrEmail,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppColors.radius),
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 11,
                ),
                suffixIcon: _query.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close, size: 16),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _query = '');
                        },
                      )
                    : null,
              ),
            ),
          ),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(context).height * 0.45,
            ),
            child: clientsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (_, __) => Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  l10n.clientsCouldNotLoadClients,
                  style: TextStyle(color: colorScheme.error),
                ),
              ),
              data: (clients) {
                if (clients.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.people_outline,
                          size: 40,
                          color: colorScheme.onSurfaceVariant
                              .withValues(alpha: 0.4),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          _query.isEmpty
                              ? l10n.clientsNoClients
                              : l10n.clientsNoClientsMatch(_query),
                          style: TextStyle(
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: 12),
                        OutlinedButton.icon(
                          onPressed: _openAddClient,
                          icon: const Icon(Icons.add, size: 16),
                          label: Text(l10n.clientsAddNewClient),
                        ),
                      ],
                    ),
                  );
                }
                return ListView.builder(
                  shrinkWrap: true,
                  itemCount: clients.length,
                  itemBuilder: (context, i) {
                    final client = clients[i];
                    return ListTile(
                      leading: CircleAvatar(
                        radius: 18,
                        backgroundColor:
                            colorScheme.primary.withValues(alpha: 0.12),
                        child: Text(
                          client.name.isNotEmpty
                              ? client.name[0].toUpperCase()
                              : '?',
                          style: TextStyle(
                            color: colorScheme.primary,
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      title: Text(
                        client.name,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      subtitle: client.email != null
                          ? Text(client.email!)
                          : null,
                      trailing: client.type != null
                          ? _TypeBadge(client.type!, l10n: l10n)
                          : null,
                      onTap: () => Navigator.of(context).pop(client),
                    );
                  },
                );
              },
            ),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}

class _TypeBadge extends StatelessWidget {
  const _TypeBadge(this.type, {required this.l10n});
  final String type;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isCompany = type.toUpperCase() == 'COMPANY';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: colorScheme.primary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        isCompany ? l10n.clientsTypeCompanyShort : l10n.clientsTypeIndividualShort,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: colorScheme.primary,
        ),
      ),
    );
  }
}
