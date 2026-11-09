import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../core/geo/jurisdiction_options.dart';
import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../../../widgets/ai_model_picker.dart';
import '../../../widgets/form_dropdown.dart';

// Client types for the intake form
const _kClientTypes = ['INDIVIDUAL', 'COMPANY', 'NGO', 'PARTNERSHIP'];

String _clientTypeLabel(String type) => switch (type) {
      'INDIVIDUAL' => 'Individual',
      'COMPANY' => 'Company',
      'NGO' => 'NGO',
      'PARTNERSHIP' => 'Partnership',
      _ => type,
    };

bool _clientTypeNeedsContacts(String type) =>
    type == 'COMPANY' || type == 'NGO' || type == 'PARTNERSHIP';

class ClientIntakeScreen extends ConsumerStatefulWidget {
  const ClientIntakeScreen({super.key});

  @override
  ConsumerState<ClientIntakeScreen> createState() => _ClientIntakeScreenState();
}

class _ClientIntakeScreenState extends ConsumerState<ClientIntakeScreen> {
  final _pageController = PageController();
  final _issueFormKey = GlobalKey<FormState>();

  int _currentStep = 0;

  // ── Step 0 ──
  final _issueCtrl = TextEditingController();
  late String _countryCode;
  bool _countryManuallySelected = false;
  String? _jurisdiction;
  bool _classifying = false;
  String? _classifyError;

  // ── Step 1 (AI questions) ──
  String _issueType = 'General';
  String? _suggestedClientName;
  List<LeadPlanQuestion> _questions = [];
  final Map<String, dynamic> _answers = {};

  // ── Step 2 (Client details) ──
  final _clientNameCtrl = TextEditingController();
  final _clientEmailCtrl = TextEditingController();
  final _clientPhoneCtrl = TextEditingController();
  String _clientType = 'INDIVIDUAL';
  String? _selectedClientId;
  String? _selectedClientName;
  List<FirmClient> _clientSearchResults = [];
  bool _searchingClients = false;
  bool _showNewClientForm = false;
  Timer? _searchDebounce;
  final List<Map<String, String>> _contactPeople = [];

  // ── Step 3 (Documents) ──
  final List<PlatformFile> _attachedFiles = [];

  // ── Step 4 (Preview) ──
  bool _generatingPreview = false;
  String? _previewError;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authControllerProvider).session?.user;
    _countryCode = user?.countryCode?.toUpperCase() ?? AppConfig.defaultCountry;
    _detectLocation();
  }

  Future<void> _detectLocation() async {
    try {
      final detected = await ref.read(detectedLocationProvider.future);
      if (!mounted || _countryManuallySelected) return;
      setState(() {
        _countryCode = detected.countryCode;
        if (detected.jurisdiction != null) _jurisdiction = detected.jurisdiction;
      });
    } catch (_) {}
  }

  @override
  void dispose() {
    _pageController.dispose();
    _issueCtrl.dispose();
    _clientNameCtrl.dispose();
    _clientEmailCtrl.dispose();
    _clientPhoneCtrl.dispose();
    _searchDebounce?.cancel();
    super.dispose();
  }

  List<String>? get _jurisdictions =>
      JurisdictionOptions.forCountry(_countryCode);

  void _goToStep(int step) {
    setState(() => _currentStep = step);
    _pageController.animateToPage(
      step,
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeInOut,
    );
  }

  // ── Step 0 → 1: classify + plan-questions ──────────────────────────────────

  Future<void> _handleStep0Continue() async {
    if (!(_issueFormKey.currentState?.validate() ?? false)) return;

    setState(() {
      _classifying = true;
      _classifyError = null;
    });

    try {
      final facts = _issueCtrl.text.trim();

      // Classify first so we can pass issueType to plan-questions.
      // This ensures the backend returns contract-specific questions when
      // the issue is "Contract & Document Drafting" rather than generic ones.
      final classifyResult =
          await ref.read(consumersApiProvider).classifyForFirmIntake(
                countryCode: _countryCode,
                facts: facts,
              );

      final planResult =
          await ref.read(consumersApiProvider).planQuestionsForIntake(
                facts: facts,
                countryCode: _countryCode,
                issueType: classifyResult.issueType,
              );

      if (!mounted) return;
      setState(() {
        _issueType = classifyResult.issueType;
        _suggestedClientName =
            classifyResult.suggestedClientName ?? planResult.suggestedClientName;
        _questions = planResult.questions;
        _answers.clear();
      });
      _goToStep(1);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _classifyError = e.message);
    } catch (_) {
      if (!mounted) return;
      setState(
        () => _classifyError = 'Failed to analyse issue. Please try again.',
      );
    } finally {
      if (mounted) setState(() => _classifying = false);
    }
  }

  // ── Step 2: client search ──────────────────────────────────────────────────

  void _onClientNameChanged(String value) {
    _searchDebounce?.cancel();
    // Reset selected client if name changes
    if (_selectedClientId != null) {
      setState(() {
        _selectedClientId = null;
        _selectedClientName = null;
      });
    }
    if (value.trim().isEmpty) {
      setState(() {
        _clientSearchResults = [];
        _searchingClients = false;
      });
      return;
    }
    _searchDebounce = Timer(const Duration(milliseconds: 300), () async {
      final tenantId =
          ref.read(authControllerProvider).session?.user.tenantId;
      if (tenantId == null || !mounted) return;
      setState(() => _searchingClients = true);
      try {
        final results = await ref.read(clientsApiProvider).listClients(
              tenantId: tenantId,
              search: value.trim(),
            );
        if (!mounted) return;
        setState(() {
          _clientSearchResults = results;
          _searchingClients = false;
        });
      } catch (_) {
        if (mounted) setState(() => _searchingClients = false);
      }
    });
  }

  void _selectExistingClient(FirmClient client) {
    setState(() {
      _selectedClientId = client.id;
      _selectedClientName = client.name;
      _clientNameCtrl.text = client.name;
      _clientEmailCtrl.text = client.email ?? '';
      _clientPhoneCtrl.text = client.phone ?? '';
      _clientSearchResults = [];
      _showNewClientForm = false;
    });
  }

  // ── Step 4: preview + submit ───────────────────────────────────────────────

  Future<void> _generatePreview() async {
    final clientName = _selectedClientName ?? _clientNameCtrl.text.trim();
    if (clientName.isEmpty) {
      setState(() => _previewError = 'Client name is required.');
      return;
    }

    setState(() {
      _generatingPreview = true;
      _previewError = null;
    });

    try {
      final facts = _issueCtrl.text.trim();
      final title = facts.length > 80 ? facts.substring(0, 80) : facts;

      final result = await ref.read(consumersApiProvider).firmIntakePreview(
            countryCode: _countryCode,
            issueType: _issueType,
            title: title,
            facts: facts,
            planningAnswers: Map<String, dynamic>.from(_answers),
            clientName: clientName,
            clientEmail: _clientEmailCtrl.text.trim().isNotEmpty
                ? _clientEmailCtrl.text.trim()
                : null,
            clientPhone: _clientPhoneCtrl.text.trim().isNotEmpty
                ? _clientPhoneCtrl.text.trim()
                : null,
            clientType: _clientType,
          );

      if (!mounted) return;

      final leadId = result.leadId;
      if (leadId != null && leadId.isNotEmpty) {
        context.go('/lawyer/leads/$leadId');
      } else {
        setState(
          () => _previewError =
              'Lead created but ID not returned. Please check Leads Inbox.',
        );
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _previewError = e.message);
    } catch (_) {
      if (!mounted) return;
      setState(
        () => _previewError = 'Failed to generate preview. Please try again.',
      );
    } finally {
      if (mounted) setState(() => _generatingPreview = false);
    }
  }

  void _addContact() {
    setState(
      () => _contactPeople.add({'name': '', 'role': '', 'email': '', 'phone': ''}),
    );
  }

  void _removeContact(int index) {
    setState(() => _contactPeople.removeAt(index));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    const totalSteps = 5;

    return Scaffold(
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        title: Text(l10n.commonNewClientIntake),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (_currentStep > 0) {
              _goToStep(_currentStep - 1);
            } else if (context.canPop()) {
              context.pop();
            } else {
              context.go('/lawyer');
            }
          },
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(4),
          child: LinearProgressIndicator(
            value: (_currentStep + 1) / totalSteps,
            backgroundColor: colorScheme.surfaceContainerHighest,
            valueColor: AlwaysStoppedAnimation<Color>(colorScheme.primary),
            minHeight: 4,
          ),
        ),
      ),
      body: Column(
        children: [
          // Step indicator chips
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                _StepChip(index: 0, current: _currentStep, label: 'Issue'),
                _StepDivider(active: _currentStep > 0),
                _StepChip(index: 1, current: _currentStep, label: 'Questions'),
                _StepDivider(active: _currentStep > 1),
                _StepChip(index: 2, current: _currentStep, label: 'Client'),
                _StepDivider(active: _currentStep > 2),
                _StepChip(index: 3, current: _currentStep, label: 'Docs'),
                _StepDivider(active: _currentStep > 3),
                _StepChip(index: 4, current: _currentStep, label: 'Preview'),
              ],
            ),
          ),
          // Step pages
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _Step0IssueDetails(
                  formKey: _issueFormKey,
                  issueCtrl: _issueCtrl,
                  countryCode: _countryCode,
                  jurisdiction: _jurisdiction,
                  jurisdictions: _jurisdictions,
                  onCountryChanged: (v) {
                    setState(() {
                      _countryManuallySelected = true;
                      _countryCode = v;
                      _jurisdiction = null;
                    });
                  },
                  onJurisdictionChanged: (v) =>
                      setState(() => _jurisdiction = v),
                  classifyError: _classifyError,
                ),
                _Step1AiQuestions(
                  questions: _questions,
                  answers: _answers,
                  onAnswerChanged: (key, value) =>
                      setState(() => _answers[key] = value),
                ),
                _Step2ClientDetails(
                  clientNameCtrl: _clientNameCtrl,
                  clientEmailCtrl: _clientEmailCtrl,
                  clientPhoneCtrl: _clientPhoneCtrl,
                  clientType: _clientType,
                  selectedClientId: _selectedClientId,
                  selectedClientName: _selectedClientName,
                  suggestedClientName: _suggestedClientName,
                  searchResults: _clientSearchResults,
                  searchingClients: _searchingClients,
                  showNewClientForm: _showNewClientForm,
                  contactPeople: _contactPeople,
                  onNameChanged: _onClientNameChanged,
                  onSelectClient: _selectExistingClient,
                  onClientTypeChanged: (v) =>
                      setState(() => _clientType = v),
                  onShowNewForm: () =>
                      setState(() => _showNewClientForm = true),
                  onAddContact: _addContact,
                  onRemoveContact: _removeContact,
                  onContactChanged: (index, field, value) {
                    setState(() => _contactPeople[index][field] = value);
                  },
                  onCompleteLater: () {
                    setState(() => _showNewClientForm = false);
                    _goToStep(3);
                  },
                ),
                _Step3Documents(
                  attachedFiles: _attachedFiles,
                  onPickFile: () async {
                    final result = await FilePicker.platform.pickFiles(
                      type: FileType.custom,
                      allowedExtensions: [
                        'pdf',
                        'png',
                        'jpg',
                        'jpeg',
                        'docx',
                        'doc',
                      ],
                      allowMultiple: true,
                    );
                    if (result != null && result.files.isNotEmpty) {
                      setState(() => _attachedFiles.addAll(result.files));
                    }
                  },
                  onRemoveFile: (index) =>
                      setState(() => _attachedFiles.removeAt(index)),
                ),
                _Step4Preview(
                  clientName: _selectedClientName ??
                      _clientNameCtrl.text.trim(),
                  countryCode: _countryCode,
                  issueType: _issueType,
                  issueSummary: _issueCtrl.text.trim(),
                  fileCount: _attachedFiles.length,
                  generating: _generatingPreview,
                  error: _previewError,
                  onGenerate: _generatePreview,
                ),
              ],
            ),
          ),
          // Bottom navigation
          SafeArea(
            child: Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  if (_currentStep > 0)
                    Expanded(
                      child: OutlinedButton(
                        onPressed:
                            _classifying ? null : () => _goToStep(_currentStep - 1),
                        child: Text(l10n.commonBack),
                      ),
                    ),
                  if (_currentStep > 0) const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: _buildNextButton(context, l10n),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNextButton(BuildContext context, AppLocalizations l10n) {
    if (_currentStep == 0) {
      return FilledButton(
        onPressed: _classifying ? null : _handleStep0Continue,
        child: _classifying
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white),
              )
            : const Text('Next →'),
      );
    }
    if (_currentStep == 1) {
      return FilledButton(
        onPressed: () => _goToStep(2),
        child: const Text('Next →'),
      );
    }
    if (_currentStep == 2) {
      // Validate: must have either a selected client or a name
      return FilledButton(
        onPressed: () {
          final name =
              _selectedClientName ?? _clientNameCtrl.text.trim();
          if (name.isEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Please enter a client name.')),
            );
            return;
          }
          _goToStep(3);
        },
        child: const Text('Next →'),
      );
    }
    if (_currentStep == 3) {
      return FilledButton(
        onPressed: () => _goToStep(4),
        child: const Text('Next →'),
      );
    }
    // Step 4: handled inside the step widget via onGenerate
    return const SizedBox.shrink();
  }
}

// ── Step 0: Issue description ─────────────────────────────────────────────────

class _Step0IssueDetails extends StatefulWidget {
  const _Step0IssueDetails({
    required this.formKey,
    required this.issueCtrl,
    required this.countryCode,
    required this.jurisdiction,
    required this.jurisdictions,
    required this.onCountryChanged,
    required this.onJurisdictionChanged,
    this.classifyError,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController issueCtrl;
  final String countryCode;
  final String? jurisdiction;
  final List<String>? jurisdictions;
  final ValueChanged<String> onCountryChanged;
  final ValueChanged<String?> onJurisdictionChanged;
  final String? classifyError;

  @override
  State<_Step0IssueDetails> createState() => _Step0IssueDetailsState();
}

class _Step0IssueDetailsState extends State<_Step0IssueDetails> {
  final _issueFocusNode = FocusNode();
  final _issueFieldKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _issueFocusNode.addListener(_scrollToIssueWhenFocused);
  }

  void _scrollToIssueWhenFocused() {
    if (!_issueFocusNode.hasFocus) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final context = _issueFieldKey.currentContext;
      if (context == null || !mounted) return;
      Scrollable.ensureVisible(
        context,
        alignment: 0.25,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  void dispose() {
    _issueFocusNode.removeListener(_scrollToIssueWhenFocused);
    _issueFocusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;

    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: EdgeInsets.fromLTRB(
        20,
        4,
        20,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Form(
        key: widget.formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _StepHeader(
              icon: Icons.description_outlined,
              title: "What's going on?",
              subtitle: "Briefly describe the client's legal issue.",
            ),
            const SizedBox(height: 20),

            _SectionLabel(l10n.lawyerIntakeIssueDescription),
            const SizedBox(height: 6),
            TextFormField(
              key: _issueFieldKey,
              controller: widget.issueCtrl,
              focusNode: _issueFocusNode,
              maxLines: 5,
              minLines: 3,
              keyboardType: TextInputType.multiline,
              textInputAction: TextInputAction.newline,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                border: const OutlineInputBorder(),
                hintText: l10n.commonBrieflyDescribeTheClient,
                hintStyle: TextStyle(
                  color: colorScheme.onSurfaceVariant,
                  fontSize: 13,
                ),
                contentPadding: const EdgeInsets.all(14),
              ),
              validator: (v) {
                if (v == null || v.trim().length < 10) {
                  return 'Please describe the issue (at least 10 characters).';
                }
                return null;
              },
            ),
            const SizedBox(height: 4),
            Text(
              '${widget.issueCtrl.text.trim().length} chars',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: widget.issueCtrl.text.trim().length >= 10
                        ? colorScheme.primary
                        : colorScheme.onSurfaceVariant,
                  ),
            ),

            const SizedBox(height: 20),

            _SectionLabel(l10n.commonCountry),
            const SizedBox(height: 6),
            FormDropdown<String>(
              value: widget.countryCode,
              items: {...AppConfig.supportedCountryCodes, widget.countryCode}.map((code) {
                return DropdownMenuItem(
                  value: code,
                  child: Text(localizedCountryName(l10n, code)),
                );
              }).toList(),
              onChanged: (v) {
                if (v != null) widget.onCountryChanged(v);
              },
            ),

            if (widget.jurisdictions != null) ...[
              const SizedBox(height: 20),
              _SectionLabel(
                  JurisdictionOptions.dropdownLabel(widget.countryCode)),
              const SizedBox(height: 6),
              FormDropdown<String?>(
                value: widget.jurisdiction,
                items: [
                  DropdownMenuItem(
                    value: null,
                    child: Text(l10n.commonSelectOptional),
                  ),
                  ...widget.jurisdictions!.map(
                    (j) => DropdownMenuItem(value: j, child: Text(j)),
                  ),
                ],
                onChanged: widget.onJurisdictionChanged,
              ),
            ],

            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                border: Border.all(
                    color: colorScheme.outline.withValues(alpha: 0.3)),
                borderRadius: BorderRadius.circular(AppColors.radius),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'AI Model',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.4,
                        ),
                  ),
                  const SizedBox(height: 8),
                  const AiModelPicker(compact: true),
                ],
              ),
            ),

            if (widget.classifyError != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: colorScheme.errorContainer.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(AppColors.radius),
                ),
                child: Text(
                  widget.classifyError!,
                  style: TextStyle(color: colorScheme.onErrorContainer),
                ),
              ),
            ],

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

// ── Step 1: AI clarifying questions ──────────────────────────────────────────

class _Step1AiQuestions extends StatelessWidget {
  const _Step1AiQuestions({
    required this.questions,
    required this.answers,
    required this.onAnswerChanged,
  });

  final List<LeadPlanQuestion> questions;
  final Map<String, dynamic> answers;
  final void Function(String key, dynamic value) onAnswerChanged;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: EdgeInsets.fromLTRB(
        20,
        4,
        20,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _StepHeader(
            icon: Icons.psychology_outlined,
            title: 'AI clarifying questions',
            subtitle: 'Help the AI understand the situation better.',
          ),
          const SizedBox(height: 20),

          if (questions.isEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: colorScheme.primaryContainer.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(AppColors.radius),
                border: Border.all(
                    color: colorScheme.primary.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  Icon(Icons.check_circle_outline,
                      color: colorScheme.primary, size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'No additional questions needed. You can proceed to client details.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                ],
              ),
            )
          else
            ...questions.map((q) {
              final key = q.key.isNotEmpty ? q.key : q.label;
              return Padding(
                padding: const EdgeInsets.only(bottom: 20),
                child: _QuestionWidget(
                  question: q,
                  answer: answers[key],
                  onChanged: (value) => onAnswerChanged(key, value),
                ),
              );
            }),

          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

class _QuestionWidget extends StatefulWidget {
  const _QuestionWidget({
    required this.question,
    required this.answer,
    required this.onChanged,
  });

  final LeadPlanQuestion question;
  final dynamic answer;
  final ValueChanged<dynamic> onChanged;

  @override
  State<_QuestionWidget> createState() => _QuestionWidgetState();
}

class _QuestionWidgetState extends State<_QuestionWidget> {
  late final TextEditingController _textController;

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController(
      text: widget.answer?.toString() ?? '',
    );
  }

  @override
  void didUpdateWidget(covariant _QuestionWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    final next = widget.answer?.toString() ?? '';
    if (next != _textController.text) {
      _textController.text = next;
    }
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final question = widget.question;
    final answer = widget.answer;
    final onChanged = widget.onChanged;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          question.label,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 8),
        if (question.type == 'single' && question.options.isNotEmpty)
          RadioGroup<String>(
            groupValue: answer as String?,
            onChanged: (v) => onChanged(v),
            child: Column(
              children: question.options.map((opt) {
                return RadioListTile<String>(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text(opt,
                      style: Theme.of(context).textTheme.bodySmall),
                  value: opt,
                );
              }).toList(),
            ),
          )
        else if (question.type == 'multi' && question.options.isNotEmpty)
          Column(
            children: question.options.map((opt) {
              final selected =
                  List<String>.from(answer ?? []).contains(opt);
              return CheckboxListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(opt,
                    style: Theme.of(context).textTheme.bodySmall),
                value: selected,
                onChanged: (checked) {
                  final list = List<String>.from(answer ?? []);
                  if (checked == true) {
                    list.add(opt);
                  } else {
                    list.remove(opt);
                  }
                  onChanged(list);
                },
              );
            }).toList(),
          )
        else
          TextField(
            controller: _textController,
            maxLines: 3,
            minLines: 2,
            keyboardType: TextInputType.multiline,
            textInputAction: TextInputAction.newline,
            onChanged: onChanged,
            decoration: InputDecoration(
              border: const OutlineInputBorder(),
              hintText: 'Type your answer…',
              hintStyle: TextStyle(color: colorScheme.onSurfaceVariant),
              contentPadding: const EdgeInsets.all(12),
            ),
          ),
      ],
    );
  }
}

// ── Step 2: Client details ────────────────────────────────────────────────────

class _Step2ClientDetails extends StatelessWidget {
  const _Step2ClientDetails({
    required this.clientNameCtrl,
    required this.clientEmailCtrl,
    required this.clientPhoneCtrl,
    required this.clientType,
    required this.selectedClientId,
    required this.selectedClientName,
    required this.suggestedClientName,
    required this.searchResults,
    required this.searchingClients,
    required this.showNewClientForm,
    required this.contactPeople,
    required this.onNameChanged,
    required this.onSelectClient,
    required this.onClientTypeChanged,
    required this.onShowNewForm,
    required this.onAddContact,
    required this.onRemoveContact,
    required this.onContactChanged,
    required this.onCompleteLater,
  });

  final TextEditingController clientNameCtrl;
  final TextEditingController clientEmailCtrl;
  final TextEditingController clientPhoneCtrl;
  final String clientType;
  final String? selectedClientId;
  final String? selectedClientName;
  final String? suggestedClientName;
  final List<FirmClient> searchResults;
  final bool searchingClients;
  final bool showNewClientForm;
  final List<Map<String, String>> contactPeople;
  final ValueChanged<String> onNameChanged;
  final ValueChanged<FirmClient> onSelectClient;
  final ValueChanged<String> onClientTypeChanged;
  final VoidCallback onShowNewForm;
  final VoidCallback onAddContact;
  final ValueChanged<int> onRemoveContact;
  final void Function(int index, String field, String value) onContactChanged;
  final VoidCallback onCompleteLater;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: EdgeInsets.fromLTRB(
        20,
        4,
        20,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _StepHeader(
            icon: Icons.person_add_alt_1,
            title: 'Client details',
            subtitle: 'Search for an existing client or add a new one.',
          ),
          const SizedBox(height: 20),

          // If a client is already selected
          if (selectedClientId != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppColors.radius),
                border: Border.all(color: Colors.green.withValues(alpha: 0.4)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.person_outline,
                      size: 18, color: Colors.green),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Linked to: $selectedClientName',
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 13),
                    ),
                  ),
                  TextButton(
                    onPressed: onShowNewForm,
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: const Size(0, 0),
                      textStyle: const TextStyle(fontSize: 12),
                    ),
                    child: const Text('Change'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

          // Name field with search
          _SectionLabel('Client name *'),
          const SizedBox(height: 6),
          TextField(
            controller: clientNameCtrl,
            textCapitalization: TextCapitalization.words,
            onChanged: onNameChanged,
            decoration: InputDecoration(
              border: const OutlineInputBorder(),
              hintText: 'e.g. John Smith',
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              suffixIcon: searchingClients
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  : null,
            ),
          ),

          // AI suggested chip
          if (suggestedClientName != null &&
              suggestedClientName!.isNotEmpty &&
              clientNameCtrl.text.isEmpty) ...[
            const SizedBox(height: 8),
            GestureDetector(
              onTap: () {
                clientNameCtrl.text = suggestedClientName!;
                onNameChanged(suggestedClientName!);
              },
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: colorScheme.primaryContainer.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                      color: colorScheme.primary.withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.auto_awesome, size: 14, color: colorScheme.primary),
                    const SizedBox(width: 6),
                    Text(
                      'AI suggested: $suggestedClientName',
                      style: TextStyle(
                          fontSize: 12, color: colorScheme.onPrimaryContainer),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '· tap to use',
                      style: TextStyle(
                          fontSize: 11,
                          color: colorScheme.onSurfaceVariant,
                          fontStyle: FontStyle.italic),
                    ),
                  ],
                ),
              ),
            ),
          ],

          // Search results dropdown
          if (searchResults.isNotEmpty) ...[
            const SizedBox(height: 4),
            Container(
              decoration: BoxDecoration(
                border: Border.all(color: colorScheme.outlineVariant),
                borderRadius: BorderRadius.circular(AppColors.radius),
              ),
              child: Column(
                children: [
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    child: Row(
                      children: [
                        Icon(Icons.search, size: 14,
                            color: colorScheme.onSurfaceVariant),
                        const SizedBox(width: 6),
                        Text(
                          'Existing clients',
                          style: TextStyle(
                              fontSize: 11, color: colorScheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  ...searchResults.take(5).map((client) {
                    return ListTile(
                      dense: true,
                      leading: CircleAvatar(
                        radius: 14,
                        backgroundColor: colorScheme.primaryContainer,
                        child: Text(
                          client.name.isNotEmpty
                              ? client.name[0].toUpperCase()
                              : '?',
                          style: TextStyle(
                              fontSize: 12, color: colorScheme.onPrimaryContainer),
                        ),
                      ),
                      title: Text(client.name,
                          style: const TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w500)),
                      subtitle: client.email != null
                          ? Text(client.email!,
                              style: const TextStyle(fontSize: 11))
                          : null,
                      trailing: const Icon(Icons.link, size: 16),
                      onTap: () => onSelectClient(client),
                    );
                  }),
                  ListTile(
                    dense: true,
                    leading: Icon(Icons.person_add_outlined,
                        size: 18, color: colorScheme.primary),
                    title: Text(
                      'New client: "${clientNameCtrl.text.trim()}"',
                      style: TextStyle(
                          fontSize: 12, color: colorScheme.primary),
                    ),
                    onTap: onShowNewForm,
                  ),
                ],
              ),
            ),
          ],

          // New client form
          if (selectedClientId == null && showNewClientForm) ...[
            const SizedBox(height: 20),
            _SectionLabel('Client type'),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _kClientTypes.map((type) {
                final selected = type == clientType;
                return ChoiceChip(
                  label: Text(_clientTypeLabel(type)),
                  selected: selected,
                  onSelected: (_) => onClientTypeChanged(type),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
            _SectionLabel('Email (optional)'),
            const SizedBox(height: 6),
            TextField(
              controller: clientEmailCtrl,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: 'client@example.com',
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
            ),
            const SizedBox(height: 16),
            _SectionLabel('Phone (optional)'),
            const SizedBox(height: 6),
            TextField(
              controller: clientPhoneCtrl,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: '+1 555 000 0000',
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
            ),
            if (_clientTypeNeedsContacts(clientType)) ...[
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _SectionLabel('Contact people'),
                  ),
                  TextButton.icon(
                    onPressed: onAddContact,
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('Add'),
                    style: TextButton.styleFrom(
                        textStyle: const TextStyle(fontSize: 12)),
                  ),
                ],
              ),
              if (contactPeople.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    'Add named contacts for this ${_clientTypeLabel(clientType).toLowerCase()}.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                  ),
                ),
              ...contactPeople.asMap().entries.map((entry) {
                final idx = entry.key;
                final contact = entry.value;
                return _ContactPersonRow(
                  index: idx,
                  contact: contact,
                  onChanged: onContactChanged,
                  onRemove: () => onRemoveContact(idx),
                );
              }),
            ],
            const SizedBox(height: 20),
            OutlinedButton(
              onPressed: onCompleteLater,
              child: const Text('Complete later (skip email/phone)'),
            ),
          ],

          // Prompt to start new form if no search results shown
          if (selectedClientId == null &&
              !showNewClientForm &&
              searchResults.isEmpty &&
              clientNameCtrl.text.isNotEmpty) ...[
            const SizedBox(height: 12),
            TextButton.icon(
              onPressed: onShowNewForm,
              icon: const Icon(Icons.person_add_outlined, size: 16),
              label: Text(
                'Create "${clientNameCtrl.text.trim()}" as new client',
              ),
            ),
          ],

          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

class _ContactPersonRow extends StatelessWidget {
  const _ContactPersonRow({
    required this.index,
    required this.contact,
    required this.onChanged,
    required this.onRemove,
  });

  final int index;
  final Map<String, String> contact;
  final void Function(int, String, String) onChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(
            color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(AppColors.radius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Contact ${index + 1}',
                style: Theme.of(context)
                    .textTheme
                    .labelSmall
                    ?.copyWith(fontWeight: FontWeight.w600),
              ),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.close, size: 16),
                onPressed: onRemove,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                flex: 2,
                child: TextField(
                  onChanged: (v) => onChanged(index, 'name', v),
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    labelText: 'Name',
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  onChanged: (v) => onChanged(index, 'role', v),
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    labelText: 'Role',
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  onChanged: (v) => onChanged(index, 'email', v),
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    labelText: 'Email',
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  onChanged: (v) => onChanged(index, 'phone', v),
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    labelText: 'Phone',
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Step 3: Document upload ───────────────────────────────────────────────────

class _Step3Documents extends StatelessWidget {
  const _Step3Documents({
    required this.attachedFiles,
    required this.onPickFile,
    required this.onRemoveFile,
  });

  final List<PlatformFile> attachedFiles;
  final VoidCallback onPickFile;
  final ValueChanged<int> onRemoveFile;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _StepHeader(
            icon: Icons.attach_file_outlined,
            title: 'Supporting documents',
            subtitle: 'Attach any relevant files (optional).',
          ),
          const SizedBox(height: 24),

          OutlinedButton.icon(
            onPressed: onPickFile,
            icon: const Icon(Icons.upload_file_outlined),
            label: const Text('Attach files (PDF, images)'),
          ),

          if (attachedFiles.isEmpty) ...[
            const SizedBox(height: 24),
            Center(
              child: Text(
                'No files attached yet.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
              ),
            ),
          ] else ...[
            const SizedBox(height: 16),
            Text(
              '${attachedFiles.length} file(s) attached',
              style: Theme.of(context).textTheme.labelMedium,
            ),
            const SizedBox(height: 8),
            ...attachedFiles.asMap().entries.map((entry) {
              final idx = entry.key;
              final file = entry.value;
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  dense: true,
                  leading: const Icon(Icons.insert_drive_file_outlined),
                  title: Text(
                    file.name,
                    style: const TextStyle(fontSize: 13),
                  ),
                  subtitle: file.size > 0
                      ? Text(
                          '${(file.size / 1024).toStringAsFixed(1)} KB',
                          style: const TextStyle(fontSize: 11),
                        )
                      : null,
                  trailing: IconButton(
                    icon: const Icon(Icons.close, size: 16),
                    onPressed: () => onRemoveFile(idx),
                  ),
                ),
              );
            }),
          ],

          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

// ── Step 4: Preview ───────────────────────────────────────────────────────────

class _Step4Preview extends StatelessWidget {
  const _Step4Preview({
    required this.clientName,
    required this.countryCode,
    required this.issueType,
    required this.issueSummary,
    required this.fileCount,
    required this.generating,
    required this.error,
    required this.onGenerate,
  });

  final String clientName;
  final String countryCode;
  final String issueType;
  final String issueSummary;
  final int fileCount;
  final bool generating;
  final String? error;
  final VoidCallback onGenerate;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _StepHeader(
            icon: Icons.preview_outlined,
            title: 'Preview & submit',
            subtitle:
                'Generate an AI intake analysis and create the lead.',
          ),
          const SizedBox(height: 20),

          // Summary card
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppColors.radius),
              side: BorderSide(
                  color: colorScheme.outlineVariant.withValues(alpha: 0.6)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _ReviewRow(
                    icon: Icons.person_outline,
                    label: 'Client',
                    value: clientName.isEmpty ? '—' : clientName,
                    colorScheme: colorScheme,
                    textTheme: textTheme,
                  ),
                  const Divider(height: 20),
                  _ReviewRow(
                    icon: Icons.public,
                    label: 'Country',
                    value: countryCode,
                    colorScheme: colorScheme,
                    textTheme: textTheme,
                  ),
                  const Divider(height: 20),
                  _ReviewRow(
                    icon: Icons.gavel_outlined,
                    label: 'Issue type',
                    value: issueType,
                    colorScheme: colorScheme,
                    textTheme: textTheme,
                  ),
                  const Divider(height: 20),
                  _ReviewRow(
                    icon: Icons.attach_file_outlined,
                    label: 'Files',
                    value: fileCount == 0
                        ? 'None'
                        : '$fileCount attached',
                    colorScheme: colorScheme,
                    textTheme: textTheme,
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),
          Text('Issue description', style: textTheme.labelMedium),
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: colorScheme.surfaceContainerHighest
                  .withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(AppColors.radius),
              border: Border.all(
                  color: colorScheme.outlineVariant.withValues(alpha: 0.6)),
            ),
            child: Text(
              issueSummary.isEmpty ? '—' : issueSummary,
              style: textTheme.bodySmall
                  ?.copyWith(color: colorScheme.onSurfaceVariant),
            ),
          ),

          if (error != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: colorScheme.errorContainer.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(AppColors.radius),
              ),
              child: Text(
                error!,
                style: TextStyle(color: colorScheme.onErrorContainer),
              ),
            ),
          ],

          const SizedBox(height: 24),

          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: generating ? null : onGenerate,
              icon: generating
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.auto_awesome_outlined, size: 18),
              label: Text(generating ? 'Generating…' : 'Generate preview'),
            ),
          ),

          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

class _StepHeader extends StatelessWidget {
  const _StepHeader({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: colorScheme.secondary.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: colorScheme.secondary),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              Text(
                subtitle,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
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

class _StepChip extends StatelessWidget {
  const _StepChip(
      {required this.index, required this.current, required this.label});

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
          const SizedBox(height: 3),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  fontSize: 9,
                  color: active
                      ? colorScheme.primary
                      : colorScheme.onSurfaceVariant,
                  fontWeight:
                      active ? FontWeight.w600 : FontWeight.normal,
                ),
            textAlign: TextAlign.center,
            overflow: TextOverflow.ellipsis,
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
        width: 14,
        height: 1,
        color: active
            ? colorScheme.primary
            : colorScheme.outlineVariant.withValues(alpha: 0.6),
      ),
    );
  }
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.colorScheme,
    required this.textTheme,
  });

  final IconData icon;
  final String label;
  final String value;
  final ColorScheme colorScheme;
  final TextTheme textTheme;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: colorScheme.onSurfaceVariant),
        const SizedBox(width: 10),
        Expanded(
          child: Text(label,
              style: textTheme.bodySmall
                  ?.copyWith(color: colorScheme.onSurfaceVariant)),
        ),
        Text(
          value,
          style: textTheme.bodySmall?.copyWith(
            fontWeight: FontWeight.w600,
            color: colorScheme.onSurface,
          ),
        ),
      ],
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
            fontWeight: FontWeight.w600,
          ),
    );
  }
}
