import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../widgets/ai_model_picker.dart';
import '../../../widgets/ai_tools/ai_tool_widgets.dart';
import '../../../widgets/staged_analysis_progress.dart';
import '../../../widgets/verification/verification_ui.dart';
import 'tabular_review_screen.dart';

const _accentColor = Color(0xFF0EA5E9);

// ---------------------------------------------------------------------------
// Document types
// ---------------------------------------------------------------------------

const _documentTypes = [
  ('CONTRACT', 'Contract'),
  ('LEGAL_NOTICE', 'Legal Notice'),
  ('AGREEMENT', 'Agreement'),
  ('PETITION', 'Petition'),
  ('MOU', 'MOU'),
  ('AFFIDAVIT', 'Affidavit'),
  ('WILL', 'Will / Testament'),
  ('GENERAL', 'General Legal Document'),
];

const _countries = [
  ('IN', 'India'),
  ('US', 'United States'),
  ('KE', 'Kenya'),
  ('GB', 'United Kingdom'),
  ('NG', 'Nigeria'),
  ('ZA', 'South Africa'),
  ('CA', 'Canada'),
  ('AU', 'Australia'),
];

const _reviewStages = [
  StagedProgressStage(
    id: 'extract',
    label: 'Extracting document text…',
    icon: Icons.text_snippet_outlined,
    duration: Duration(seconds: 3),
  ),
  StagedProgressStage(
    id: 'structure',
    label: 'Identifying document structure…',
    icon: Icons.account_tree_outlined,
    duration: Duration(seconds: 4),
  ),
  StagedProgressStage(
    id: 'clauses',
    label: 'Analysing key clauses…',
    icon: Icons.rule_outlined,
    duration: Duration(seconds: 4),
  ),
  StagedProgressStage(
    id: 'risk',
    label: 'Scoring risk and compliance…',
    icon: Icons.shield_outlined,
    duration: Duration(seconds: 3),
  ),
  StagedProgressStage(
    id: 'amendments',
    label: 'Generating amendment suggestions…',
    icon: Icons.edit_note_outlined,
    duration: Duration.zero,
  ),
];

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

class DocumentReviewScreen extends ConsumerStatefulWidget {
  const DocumentReviewScreen({super.key});

  @override
  ConsumerState<DocumentReviewScreen> createState() => _DocumentReviewScreenState();
}

class _DocumentReviewScreenState extends ConsumerState<DocumentReviewScreen> {
  final _textController = TextEditingController();

  String _inputMode = 'upload'; // 'upload' | 'paste'
  String _selectedDocType = 'GENERAL';
  String _selectedCountry = 'IN';
  String _aiModelMode = 'AUTO';
  String? _premiumModelId;

  bool _loading = false;
  String? _error;
  DocumentReviewResult? _result;

  PlatformFile? _pickedFile;
  String? _pastedText;

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'docx', 'doc', 'txt', 'jpg', 'jpeg', 'png', 'md'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;
    setState(() {
      _pickedFile = result.files.first;
      _inputMode = 'upload';
    });
  }

  Future<void> _analyse() async {
    final hasFile = _inputMode == 'upload' && _pickedFile?.bytes != null;
    final hasText = _inputMode == 'paste' && _textController.text.trim().length > 20;

    if (!hasFile && !hasText) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please upload a file or paste document text.')),
      );
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
      _result = null;
      _pastedText = _inputMode == 'paste' ? _textController.text : null;
    });

    try {
      final ai = ref.read(aiApiProvider);
      final tenantId = ref.read(authControllerProvider).session?.user.tenantId;

      DocumentReviewResult res;

      if (hasFile) {
        final file = _pickedFile!;
        res = await ai.runDocumentReviewFile(
          fileBytes: file.bytes!,
          fileName: file.name,
          documentType: _selectedDocType,
          countryCode: _selectedCountry,
          tenantId: tenantId,
          aiModelMode: _aiModelMode,
          premiumModelId: _premiumModelId,
        );
      } else {
        res = await ai.runDocumentReview(
          extractedText: _textController.text,
          documentType: _selectedDocType,
          countryCode: _selectedCountry,
          tenantId: tenantId,
          aiModelMode: _aiModelMode,
          premiumModelId: _premiumModelId,
        );
      }

      setState(() => _result = res);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Document review failed. Please try again.');
    } finally {
      setState(() => _loading = false);
    }
  }

  void _reset() {
    setState(() {
      _result = null;
      _error = null;
      _pickedFile = null;
      _pastedText = null;
      _textController.clear();
    });
  }

  Future<void> _reanalyseWithText(String text) async {
    setState(() {
      _pastedText = text;
      _loading = true;
      _error = null;
      _result = null;
    });

    try {
      final ai = ref.read(aiApiProvider);
      final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
      final res = await ai.runDocumentReview(
        extractedText: text,
        documentType: _selectedDocType,
        countryCode: _selectedCountry,
        tenantId: tenantId,
        aiModelMode: _aiModelMode,
        premiumModelId: _premiumModelId,
      );
      setState(() => _result = res);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Document review failed. Please try again.');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.manage_search, size: 20),
            SizedBox(width: 8),
            Text('Document Review'),
          ],
        ),
        backgroundColor: isDark ? AppColors.logoBlue : Colors.white,
        foregroundColor: colorScheme.onSurface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Divider(
            height: 1,
            color: _accentColor.withValues(alpha: 0.20),
          ),
        ),
        actions: [
          if (_result != null)
            TextButton.icon(
              onPressed: _reset,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Review another'),
            ),
        ],
      ),
      body: _result != null
          ? _ResultView(
              result: _result!,
              pastedText: _pastedText,
              onReanalyse: _reanalyseWithText,
            )
          : Column(
              children: [
                AiToolFeatureHeader(
                  icon: Icons.manage_search_outlined,
                  title: 'Document Review',
                  subtitle:
                      'Upload a contract or notice and get an AI risk analysis.',
                  accentColor: _accentColor,
                ),
                // Tabular review shortcut
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Card(
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const TabularReviewScreen(),
                        ),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.purple.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.compare_arrows_rounded,
                                  color: Colors.purple, size: 20),
                            ),
                            const SizedBox(width: 12),
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Compare two documents',
                                      style: TextStyle(
                                          fontWeight: FontWeight.w600,
                                          fontSize: 14)),
                                  SizedBox(height: 2),
                                  Text(
                                    'Side-by-side clause comparison with risk scoring',
                                    style: TextStyle(
                                        fontSize: 12, color: Colors.grey),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right_rounded,
                                color: Colors.grey),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: _InputView(
                    loading: _loading,
                    error: _error,
                    inputMode: _inputMode,
                    pickedFile: _pickedFile,
                    textController: _textController,
                    selectedDocType: _selectedDocType,
                    selectedCountry: _selectedCountry,
                    aiModelMode: _aiModelMode,
                    premiumModelId: _premiumModelId,
                    onInputModeChange: (m) => setState(() => _inputMode = m),
                    onPickFile: _pickFile,
                    onDocTypeChange: (v) =>
                        setState(() => _selectedDocType = v),
                    onCountryChange: (v) =>
                        setState(() => _selectedCountry = v),
                    onModelChange: (mode, id) => setState(() {
                      _aiModelMode = mode;
                      _premiumModelId = id;
                    }),
                    onAnalyse: _analyse,
                  ),
                ),
              ],
            ),
    );
  }
}

// ---------------------------------------------------------------------------
// Input view
// ---------------------------------------------------------------------------

class _InputView extends StatelessWidget {
  const _InputView({
    required this.loading,
    required this.error,
    required this.inputMode,
    required this.pickedFile,
    required this.textController,
    required this.selectedDocType,
    required this.selectedCountry,
    required this.aiModelMode,
    required this.premiumModelId,
    required this.onInputModeChange,
    required this.onPickFile,
    required this.onDocTypeChange,
    required this.onCountryChange,
    required this.onModelChange,
    required this.onAnalyse,
  });

  final bool loading;
  final String? error;
  final String inputMode;
  final PlatformFile? pickedFile;
  final TextEditingController textController;
  final String selectedDocType;
  final String selectedCountry;
  final String aiModelMode;
  final String? premiumModelId;
  final ValueChanged<String> onInputModeChange;
  final VoidCallback onPickFile;
  final ValueChanged<String> onDocTypeChange;
  final ValueChanged<String> onCountryChange;
  final void Function(String mode, String? modelId) onModelChange;
  final VoidCallback onAnalyse;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Mode toggle (custom tabs)
          _ModeTabBar(
            selected: inputMode,
            onChanged: onInputModeChange,
          ),
          const SizedBox(height: 16),

          if (loading) ...[
            StagedAnalysisProgress(
              active: true,
              stages: _reviewStages,
              title: 'Reviewing document…',
            ),
          ] else if (inputMode == 'upload') ...[
            // Animated upload zone
            _UploadZone(
              pickedFile: pickedFile,
              onTap: onPickFile,
            ),
          ] else ...[
            // Paste zone
            TextField(
              controller: textController,
              maxLines: 12,
              style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
              decoration: InputDecoration(
                hintText:
                    'Paste the full text of your contract, legal notice, or any legal document…',
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12)),
                alignLabelWithHint: true,
              ),
            ),
          ],

          const SizedBox(height: 16),

          // Options
          Row(
            children: [
              Expanded(
                child: _DropdownField(
                  label: 'Document Type',
                  value: selectedDocType,
                  items: _documentTypes.map((e) => (e.$1, e.$2)).toList(),
                  onChanged: onDocTypeChange,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _DropdownField(
                  label: 'Jurisdiction',
                  value: selectedCountry,
                  items: _countries.map((e) => (e.$1, e.$2)).toList(),
                  onChanged: onCountryChange,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          AiModelPicker(
            initialMode: aiModelMode,
            initialPremiumModelId: premiumModelId,
            compact: true,
            onChanged: onModelChange,
          ),
          const SizedBox(height: 16),

          FilledButton.icon(
            onPressed: loading ? null : onAnalyse,
            icon: loading
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.auto_awesome, size: 18),
            label: Text(loading ? 'Analysing…' : 'Analyse Document'),
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),

          if (error != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: Theme.of(context).colorScheme.errorContainer,
              ),
              child: Row(
                children: [
                  Icon(Icons.error_outline, color: Theme.of(context).colorScheme.error, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      error!,
                      style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Custom mode tab bar (Upload / Paste)
// ---------------------------------------------------------------------------

class _ModeTabBar extends StatelessWidget {
  const _ModeTabBar({required this.selected, required this.onChanged});

  final String selected;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.logoBlueSurface
            : colorScheme.surfaceContainerHighest.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.borderLight,
        ),
      ),
      child: Row(
        children: [
          _ModeTab(
            label: 'Upload File',
            icon: Icons.upload_file_outlined,
            isSelected: selected == 'upload',
            onTap: () => onChanged('upload'),
            accentColor: _accentColor,
          ),
          const SizedBox(width: 4),
          _ModeTab(
            label: 'Paste Text',
            icon: Icons.edit_note_outlined,
            isSelected: selected == 'paste',
            onTap: () => onChanged('paste'),
            accentColor: _accentColor,
          ),
        ],
      ),
    );
  }
}

class _ModeTab extends StatelessWidget {
  const _ModeTab({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.onTap,
    required this.accentColor,
  });

  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected
                ? (isDark
                    ? accentColor.withValues(alpha: 0.22)
                    : accentColor.withValues(alpha: 0.12))
                : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
            border: isSelected
                ? Border.all(color: accentColor.withValues(alpha: 0.40))
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 15,
                color: isSelected
                    ? accentColor
                    : Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.55),
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight:
                      isSelected ? FontWeight.w700 : FontWeight.w500,
                  color: isSelected
                      ? accentColor
                      : Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.55),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Animated upload zone
// ---------------------------------------------------------------------------

class _UploadZone extends StatefulWidget {
  const _UploadZone({required this.pickedFile, required this.onTap});

  final PlatformFile? pickedFile;
  final VoidCallback onTap;

  @override
  State<_UploadZone> createState() => _UploadZoneState();
}

class _UploadZoneState extends State<_UploadZone>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseCtrl;
  late final Animation<double> _pulseAnim;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
    _pulseAnim = Tween<double>(begin: 0.3, end: 0.8).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasFile = widget.pickedFile != null;
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final successColor = const Color(0xFF10B981);
    final borderColor =
        hasFile ? successColor : _accentColor;

    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        widget.onTap();
      },
      child: AnimatedBuilder(
        animation: _pulseAnim,
        builder: (context, child) {
          return Container(
            height: 160,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: hasFile
                  ? successColor.withValues(alpha: isDark ? 0.10 : 0.05)
                  : isDark
                      ? AppColors.logoBlueSurface
                      : const Color(0xFFF0F9FF),
              border: Border.all(
                color: hasFile
                    ? successColor.withValues(alpha: 0.60)
                    : borderColor.withValues(
                        alpha: _pulseAnim.value,
                      ),
                width: hasFile ? 2 : 1.5,
              ),
              boxShadow: hasFile
                  ? [
                      BoxShadow(
                        color: successColor.withValues(alpha: 0.12),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      )
                    ]
                  : null,
            ),
            child: child,
          );
        },
        child: hasFile
            ? _FilePickedContent(
                file: widget.pickedFile!,
                colorScheme: colorScheme,
              )
            : _UploadPromptContent(colorScheme: colorScheme),
      ),
    );
  }
}

class _FilePickedContent extends StatelessWidget {
  const _FilePickedContent({required this.file, required this.colorScheme});

  final PlatformFile file;
  final ColorScheme colorScheme;

  @override
  Widget build(BuildContext context) {
    final successColor = const Color(0xFF10B981);
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: successColor.withValues(alpha: 0.12),
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.check_circle_outline,
              size: 24, color: successColor),
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Text(
            file.name,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(fontWeight: FontWeight.w600),
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          '${((file.size) / 1024).toStringAsFixed(0)} KB · tap to change',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
        ),
      ],
    );
  }
}

class _UploadPromptContent extends StatelessWidget {
  const _UploadPromptContent({required this.colorScheme});

  final ColorScheme colorScheme;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: _accentColor.withValues(alpha: 0.10),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.upload_file_outlined,
              size: 24, color: _accentColor),
        ),
        const SizedBox(height: 10),
        Text(
          'Tap to upload a document',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 2),
        Text(
          'PDF, DOCX, TXT, JPG — up to 20 MB',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Dropdown field
// ---------------------------------------------------------------------------

class _DropdownField extends StatelessWidget {
  const _DropdownField({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final String label;
  final String value;
  final List<(String, String)> items;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
        const SizedBox(height: 4),
        DropdownButtonFormField<String>(
          key: ValueKey(value),
          initialValue: value,
          isExpanded: true,
          decoration: InputDecoration(
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            isDense: true,
          ),
          items: items
              .map(
                (e) => DropdownMenuItem(
                  value: e.$1,
                  child: Text(
                    e.$2,
                    style: const TextStyle(fontSize: 13),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          selectedItemBuilder: (context) => items
              .map(
                (e) => Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    e.$2,
                    style: const TextStyle(fontSize: 13),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          onChanged: (v) {
            if (v != null) onChanged(v);
          },
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Result view
// ---------------------------------------------------------------------------

class _ResultView extends StatefulWidget {
  const _ResultView({
    required this.result,
    this.pastedText,
    required this.onReanalyse,
  });

  final DocumentReviewResult result;
  final String? pastedText;
  final void Function(String text) onReanalyse;

  @override
  State<_ResultView> createState() => _ResultViewState();
}

class _ResultViewState extends State<_ResultView> {
  bool _documentExpanded = false;

  String? get _docText {
    final extracted = widget.result.extractedText;
    if (extracted != null && extracted.isNotEmpty) return extracted;
    final pasted = widget.pastedText;
    if (pasted != null && pasted.isNotEmpty) return pasted;
    return null;
  }

  int _wordCount(String t) =>
      t.trim().isEmpty ? 0 : t.trim().split(RegExp(r'\s+')).length;

  void _openEditSheet() {
    final docText = _docText ?? '';
    final editController = TextEditingController(text: docText);

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 16,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.edit_note, size: 20),
                      const SizedBox(width: 8),
                      const Expanded(
                        child: Text(
                          'Edit Document Text',
                          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, size: 18),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: editController,
                    maxLines: null,
                    minLines: 8,
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
                    decoration: InputDecoration(
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      hintText: 'Paste or edit document text…',
                    ),
                    onChanged: (_) => setSheetState(() {}),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${editController.text.length} chars · ${_wordCount(editController.text)} words',
                    style: Theme.of(ctx).textTheme.bodySmall?.copyWith(
                      color: Theme.of(ctx).colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: () {
                      final newText = editController.text;
                      Navigator.pop(ctx);
                      widget.onReanalyse(newText);
                    },
                    icon: const Icon(Icons.auto_awesome, size: 16),
                    label: const Text('Re-analyse'),
                  ),
                ],
              ),
            );
          },
        );
      },
    ).whenComplete(editController.dispose);
  }

  List<InlineSpan> _buildAnnotatedSpans(
      String docText, DocumentReviewResult result) {
    final ranges = <_AnnotationRange>[];

    for (final clause in result.keyClauses) {
      final orig = clause.originalText;
      if (orig.trim().isEmpty) continue;
      final idx = docText.indexOf(orig);
      if (idx >= 0) {
        ranges.add(_AnnotationRange(
          start: idx,
          end: idx + orig.length,
          color: clause.flagged
              ? const Color(0xFFFEF3C7)
              : const Color(0xFFD1FAE5),
          textColor: clause.flagged
              ? const Color(0xFF92400E)
              : const Color(0xFF065F46),
        ));
      }
    }

    for (final amendment in result.amendments) {
      final orig = amendment.originalText;
      if (orig.trim().isEmpty) continue;
      final idx = docText.indexOf(orig);
      if (idx >= 0) {
        ranges.add(_AnnotationRange(
          start: idx,
          end: idx + orig.length,
          color: const Color(0xFFDBEAFE),
          textColor: const Color(0xFF1E40AF),
        ));
      }
    }

    ranges.sort((a, b) => a.start.compareTo(b.start));

    final merged = <_AnnotationRange>[];
    int cursor = 0;
    for (final r in ranges) {
      if (r.start < cursor) continue;
      merged.add(r);
      cursor = r.end;
    }

    final spans = <InlineSpan>[];
    int pos = 0;
    for (final r in merged) {
      if (r.start > pos) {
        spans.add(TextSpan(text: docText.substring(pos, r.start)));
      }
      spans.add(TextSpan(
        text: docText.substring(r.start, r.end),
        style: TextStyle(backgroundColor: r.color, color: r.textColor),
      ));
      pos = r.end;
    }
    if (pos < docText.length) {
      spans.add(TextSpan(text: docText.substring(pos)));
    }
    return spans.isEmpty ? [TextSpan(text: docText)] : spans;
  }

  Widget _buildDocumentTextCard(BuildContext context) {
    final docText = _docText;
    if (docText == null || docText.isEmpty) return const SizedBox.shrink();

    return Card(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () => setState(() => _documentExpanded = !_documentExpanded),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Row(
                children: [
                  const Icon(Icons.description_outlined, size: 18),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Document Text',
                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                  ),
                  TextButton.icon(
                    onPressed: _openEditSheet,
                    icon: const Icon(Icons.edit_outlined, size: 14),
                    label: const Text('Edit', style: TextStyle(fontSize: 12)),
                    style: TextButton.styleFrom(
                      minimumSize: Size.zero,
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(
                    _documentExpanded ? Icons.expand_less : Icons.expand_more,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),
          if (_documentExpanded) ...[
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 12,
                    runSpacing: 6,
                    children: const [
                      _LegendChip(
                        color: Color(0xFFFEF3C7),
                        textColor: Color(0xFF92400E),
                        label: 'Flagged clause',
                      ),
                      _LegendChip(
                        color: Color(0xFFD1FAE5),
                        textColor: Color(0xFF065F46),
                        label: 'Key clause',
                      ),
                      _LegendChip(
                        color: Color(0xFFDBEAFE),
                        textColor: Color(0xFF1E40AF),
                        label: 'Amendment needed',
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SelectionArea(
                    child: RichText(
                      text: TextSpan(
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontFamily: 'monospace',
                          height: 1.6,
                        ),
                        children: _buildAnnotatedSpans(docText, widget.result),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final result = widget.result;
    final highRisks = result.risks.where((r) => r.severity == 'HIGH').length;
    final flaggedClauses = result.keyClauses.where((c) => c.flagged).length;

    return DefaultTabController(
      length: 5,
      child: Column(
        children: [
          // Quick stats
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
            child: Row(
              children: [
                _StatChip(label: 'Strengths', value: result.pros.length.toString()),
                const SizedBox(width: 8),
                _StatChip(label: 'Weaknesses', value: result.cons.length.toString()),
                const SizedBox(width: 8),
                _StatChip(
                  label: 'High Risks',
                  value: highRisks.toString(),
                  highlight: highRisks > 0,
                  color: Colors.red,
                ),
                const SizedBox(width: 8),
                _StatChip(
                  label: 'Flagged',
                  value: flaggedClauses.toString(),
                  highlight: flaggedClauses > 0,
                  color: Colors.amber,
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          _buildDocumentTextCard(context),
          const TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [
              Tab(
                icon: Icon(Icons.dashboard_outlined, size: 16),
                text: 'Overview',
              ),
              Tab(
                icon: Icon(Icons.compare_arrows_outlined, size: 16),
                text: 'Pros & Cons',
              ),
              Tab(
                icon: Icon(Icons.warning_amber_outlined, size: 16),
                text: 'Risks',
              ),
              Tab(
                icon: Icon(Icons.article_outlined, size: 16),
                text: 'Clauses',
              ),
              Tab(
                icon: Icon(Icons.edit_outlined, size: 16),
                text: 'Amendments',
              ),
            ],
          ),
          Expanded(
            child: TabBarView(
              children: [
                _OverviewTab(result: result),
                _ProsConsTab(pros: result.pros, cons: result.cons),
                _RisksTab(risks: result.risks),
                _ClausesTab(clauses: result.keyClauses),
                _AmendmentsTab(amendments: result.amendments),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({
    required this.label,
    required this.value,
    this.highlight = false,
    this.color,
  });

  final String label;
  final String value;
  final bool highlight;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final effectiveColor = highlight && color != null
        ? color!
        : Theme.of(context).colorScheme.primary;
    final bgColor = highlight && color != null
        ? color!.withValues(alpha: isDark ? 0.18 : 0.10)
        : Theme.of(context).colorScheme.surfaceContainerHighest;

    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: bgColor,
          border: Border.all(
            color: highlight && color != null
                ? color!.withValues(alpha: 0.35)
                : Theme.of(context)
                    .colorScheme
                    .outline
                    .withValues(alpha: 0.15),
          ),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: highlight ? effectiveColor : null,
                height: 1,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: highlight
                        ? effectiveColor.withValues(alpha: 0.85)
                        : null,
                  ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _LegendChip extends StatelessWidget {
  const _LegendChip({
    required this.color,
    required this.textColor,
    required this.label,
  });

  final Color color;
  final Color textColor;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(fontSize: 11, color: textColor)),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

class _OverviewTab extends StatelessWidget {
  const _OverviewTab({required this.result});
  final DocumentReviewResult result;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final riskColor = result.riskLabel == 'Critical'
        ? Colors.red
        : result.riskLabel == 'High'
            ? Colors.orange
            : result.riskLabel == 'Moderate'
                ? Colors.amber
                : Colors.green;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (result.publicationState != null ||
            (result.findings != null && result.findings!.isNotEmpty)) ...[
          ResearchVerificationCard(
            publicationState: result.publicationState,
            findings: result.findings,
            dimensions: result.dimensions,
            requiresLawyerReview: result.requiresLawyerReview,
          ),
          const SizedBox(height: 12),
        ],
        // Risk score + summary
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Chip(label: Text(result.documentType), labelStyle: const TextStyle(fontSize: 12)),
                          const SizedBox(height: 8),
                          Text(result.summary, style: Theme.of(context).textTheme.bodyMedium),
                        ],
                      ),
                    ),
                    const SizedBox(width: 16),
                    Column(
                      children: [
                        Text(
                          result.overallRiskScore.toString(),
                          style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: riskColor),
                        ),
                        Text(
                          '${result.riskLabel} Risk',
                          style: TextStyle(fontSize: 12, color: riskColor, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 4),
                        SizedBox(
                          width: 56,
                          child: LinearProgressIndicator(
                            value: result.overallRiskScore / 100,
                            color: riskColor,
                            minHeight: 6,
                            borderRadius: BorderRadius.circular(99),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),

        // Parties
        if (result.parties.isNotEmpty) ...[
          Text('Parties', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: result.parties.map((p) => Chip(
              label: Text('${p.name} · ${p.role}', style: const TextStyle(fontSize: 12)),
              avatar: const Icon(Icons.person_outline, size: 14),
            )).toList(),
          ),
          const SizedBox(height: 12),
        ],

        // Key dates
        if (result.keyDates.isNotEmpty) ...[
          Text('Key Dates', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          ...result.keyDates.map((d) => Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: colorScheme.outlineVariant),
                    color: colorScheme.surfaceContainerHighest,
                  ),
                  child: Text(d.date, style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
                ),
                const SizedBox(width: 8),
                Expanded(child: Text(d.description, style: Theme.of(context).textTheme.bodySmall)),
              ],
            ),
          )),
          const SizedBox(height: 12),
        ],

        // Recommendations
        if (result.recommendations.isNotEmpty) ...[
          Text('Recommendations', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          ...result.recommendations.map((r) => Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.chevron_right, size: 18, color: colorScheme.primary),
                const SizedBox(width: 4),
                Expanded(child: Text(r, style: Theme.of(context).textTheme.bodySmall)),
              ],
            ),
          )),
          const SizedBox(height: 12),
        ],

        // Compliance flags
        if (result.complianceFlags.isNotEmpty) ...[
          Text(
            'Compliance Flags',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600, color: Colors.amber.shade800),
          ),
          const SizedBox(height: 8),
          ...result.complianceFlags.map((f) => Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: Colors.amber.shade50,
                border: Border.all(color: Colors.amber.shade200),
              ),
              child: Row(
                children: [
                  Icon(Icons.warning_amber_outlined, size: 16, color: Colors.amber.shade700),
                  const SizedBox(width: 8),
                  Expanded(child: Text(f, style: TextStyle(fontSize: 13, color: Colors.amber.shade900))),
                ],
              ),
            ),
          )),
        ],

        const SizedBox(height: 24),
        Text(
          'AI-generated analysis — verify all findings with a qualified lawyer before acting on any advice.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colorScheme.onSurfaceVariant),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

class _ProsConsTab extends StatelessWidget {
  const _ProsConsTab({required this.pros, required this.cons});
  final List<DocumentReviewPro> pros;
  final List<DocumentReviewCon> cons;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (pros.isNotEmpty) ...[
          Row(
            children: [
              const Icon(Icons.check_circle_outline, color: Colors.green, size: 18),
              const SizedBox(width: 6),
              Text('Strengths (${pros.length})', style: Theme.of(context).textTheme.titleSmall?.copyWith(color: Colors.green.shade700, fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: 8),
          ...pros.map((p) => _ProConCard(title: p.title, detail: p.detail, isPro: true)),
          const SizedBox(height: 16),
        ],
        if (cons.isNotEmpty) ...[
          Row(
            children: [
              const Icon(Icons.cancel_outlined, color: Colors.red, size: 18),
              const SizedBox(width: 6),
              Text('Weaknesses (${cons.length})', style: Theme.of(context).textTheme.titleSmall?.copyWith(color: Colors.red.shade700, fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: 8),
          ...cons.map((c) => _ProConCard(title: c.title, detail: c.detail, isPro: false)),
        ],
      ],
    );
  }
}

class _ProConCard extends StatelessWidget {
  const _ProConCard({required this.title, required this.detail, required this.isPro});
  final String title;
  final String detail;
  final bool isPro;

  @override
  Widget build(BuildContext context) {
    final color = isPro ? Colors.green : Colors.red;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
        color: color.withValues(alpha: 0.04),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: color.shade700)),
          const SizedBox(height: 4),
          Text(detail, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

class _RisksTab extends StatelessWidget {
  const _RisksTab({required this.risks});
  final List<DocumentReviewRisk> risks;

  Color _severityColor(String severity) {
    switch (severity) {
      case 'HIGH': return Colors.red;
      case 'MEDIUM': return Colors.amber;
      default: return Colors.blue;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (risks.isEmpty) {
      return const Center(child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.shield_outlined, size: 48, color: Colors.green),
          SizedBox(height: 8),
          Text('No significant risks identified'),
        ],
      ));
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: risks.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final risk = risks[i];
        final color = _severityColor(risk.severity);
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: color.withValues(alpha: 0.3)),
            color: color.withValues(alpha: 0.05),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(risk.title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(99),
                      color: color.withValues(alpha: 0.15),
                    ),
                    child: Text(
                      risk.severity,
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: color),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(risk.detail, style: Theme.of(context).textTheme.bodySmall),
              if (risk.legalBasis != null) ...[
                const SizedBox(height: 6),
                Text(
                  'Legal basis: ${risk.legalBasis}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(fontStyle: FontStyle.italic),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _ClausesTab extends StatelessWidget {
  const _ClausesTab({required this.clauses});
  final List<DocumentReviewClause> clauses;

  @override
  Widget build(BuildContext context) {
    if (clauses.isEmpty) {
      return const Center(child: Text('No clauses extracted.'));
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: clauses.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final clause = clauses[i];
        return ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
            side: BorderSide(
              color: clause.flagged
                  ? Colors.amber.withValues(alpha: 0.5)
                  : Theme.of(context).colorScheme.outlineVariant,
            ),
          ),
          collapsedShape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
            side: BorderSide(
              color: clause.flagged
                  ? Colors.amber.withValues(alpha: 0.5)
                  : Theme.of(context).colorScheme.outlineVariant,
            ),
          ),
          backgroundColor: clause.flagged ? Colors.amber.withValues(alpha: 0.03) : null,
          leading: clause.flagged
              ? const Icon(Icons.warning_amber_outlined, color: Colors.amber, size: 20)
              : const Icon(Icons.article_outlined, size: 20),
          title: Text(clause.title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          children: [
            if (clause.originalText.isNotEmpty) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(6),
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                ),
                child: Text(
                  clause.originalText,
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 11),
                ),
              ),
              const SizedBox(height: 8),
            ],
            Text(clause.analysis, style: Theme.of(context).textTheme.bodySmall),
          ],
        );
      },
    );
  }
}

class _AmendmentsTab extends StatelessWidget {
  const _AmendmentsTab({required this.amendments});
  final List<DocumentReviewAmendment> amendments;

  @override
  Widget build(BuildContext context) {
    if (amendments.isEmpty) {
      return const Center(child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.check_circle_outline, size: 48, color: Colors.green),
          SizedBox(height: 8),
          Text('No amendments suggested — document looks well-drafted.'),
        ],
      ));
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: amendments.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, i) {
        final a = amendments[i];
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(a.clauseRef, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(99),
                        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
                      ),
                      child: Text('Amendment ${i + 1}', style: const TextStyle(fontSize: 11)),
                    ),
                  ],
                ),
                Text(a.issue, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                const SizedBox(height: 10),

                if (a.originalText.isNotEmpty) ...[
                  Text('Original', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                  const SizedBox(height: 4),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(6),
                      color: Colors.red.withValues(alpha: 0.05),
                      border: Border.all(color: Colors.red.withValues(alpha: 0.2)),
                    ),
                    child: Text(
                      a.originalText,
                      style: const TextStyle(fontSize: 12, decoration: TextDecoration.lineThrough, decorationColor: Colors.red),
                    ),
                  ),
                  const SizedBox(height: 8),
                ],

                Text('Suggested Replacement', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                const SizedBox(height: 4),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(6),
                    color: Colors.green.withValues(alpha: 0.05),
                    border: Border.all(color: Colors.green.withValues(alpha: 0.2)),
                  ),
                    child: Text(a.suggestedText, style: const TextStyle(fontSize: 12)),
                ),
                const SizedBox(height: 8),

                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Why: ${a.reason}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
                      ),
                    ),
                    TextButton.icon(
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: a.suggestedText));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Copied to clipboard')),
                        );
                      },
                      icon: const Icon(Icons.copy, size: 14),
                      label: const Text('Copy', style: TextStyle(fontSize: 12)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Annotation helpers
// ---------------------------------------------------------------------------

class _AnnotationRange {
  const _AnnotationRange({
    required this.start,
    required this.end,
    required this.color,
    required this.textColor,
  });

  final int start;
  final int end;
  final Color color;
  final Color textColor;
}
