import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/models.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import 'matter_detail_screen.dart';

/// Fields the AI/template needs that we consider required.
bool _isRequiredField(String key) =>
    RegExp(r'^(party[12]Name|clientName|landlordName|tenantName)$', caseSensitive: false).hasMatch(key);

/// Fields resolved automatically from matter context — skip prompting.
const _autoResolvedFields = {
  'clientName', 'matterTitle', 'matterDescription', 'caseNumber', 'today',
  'firmName', 'practiceArea', 'jurisdiction', 'courtName', 'factsSummary',
  'desiredOutcome', 'opposingParty',
};

/// Extract all {{variableName}} tokens from template HTML.
List<String> _extractTemplateTokens(String html) {
  final exp = RegExp(r'\{\{(\w+)\}\}');
  return exp.allMatches(html).map((m) => m.group(1)!).toSet().toList();
}

/// Human-readable label from camelCase key.
String _fieldLabel(String key) {
  return key
      .replaceAllMapped(RegExp(r'([A-Z])'), (m) => ' ${m.group(1)}')
      .replaceAll('_', ' ')
      .trim()
      .replaceFirst(key[0], key[0].toUpperCase());
}

/// Lightweight template model for listing.
class _TemplateItem {
  const _TemplateItem({required this.id, required this.name, this.practiceArea, this.content = ''});
  final String id;
  final String name;
  final String? practiceArea;
  final String content;
}

Options _tenantOptions(
  String tenantId, {
  Duration? receiveTimeout,
}) =>
    Options(
      headers: {'X-Tenant-Id': tenantId},
      receiveTimeout: receiveTimeout,
    );

List<_TemplateItem> _parseTemplatesResponse(
  dynamic raw,
  AppLocalizations l10n,
) {
  final List<dynamic> list;
  if (raw is List) {
    list = raw;
  } else if (raw is Map<String, dynamic>) {
    list = raw['templates'] as List<dynamic>? ?? [];
  } else {
    list = const [];
  }

  return list.whereType<Map<String, dynamic>>().map((t) {
    return _TemplateItem(
      id: t['id'] as String? ?? '',
      name: t['name'] as String? ?? l10n.mattersUntitled,
      practiceArea: t['practiceArea'] as String?,
      content: t['content'] as String? ?? '',
    );
  }).where((t) => t.id.isNotEmpty).toList();
}

class GenerateDocumentScreen extends ConsumerStatefulWidget {
  const GenerateDocumentScreen({super.key, required this.matterId});
  final String matterId;

  @override
  ConsumerState<GenerateDocumentScreen> createState() =>
      _GenerateDocumentScreenState();
}

class _GenerateDocumentScreenState extends ConsumerState<GenerateDocumentScreen> {
  List<_TemplateItem> _templates = [];
  bool _loadingTemplates = true;
  bool _drafting = false;
  String? _draftHtml;
  String? _documentId;
  String? _error;
  bool _loadStarted = false;

  // Field-check step state
  _TemplateItem? _pendingTemplate;
  List<String> _missingFields = [];
  final Map<String, TextEditingController> _fieldControllers = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _ensureTemplatesLoaded());
  }

  @override
  void dispose() {
    for (final controller in _fieldControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  void _ensureTemplatesLoaded({bool force = false}) {
    if (!mounted) return;
    if (_loadStarted && !force) return;

    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null || tenantId.isEmpty) {
      setState(() {
        _loadingTemplates = false;
        _error = null;
      });
      return;
    }

    _loadStarted = true;
    unawaited(_loadTemplates(force: force));
  }

  Future<void> _loadTemplates({bool force = false}) async {
    if (!mounted) return;

    final l10n = AppLocalizations.of(context);
    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null || tenantId.isEmpty) {
      if (mounted) {
        setState(() {
          _loadingTemplates = false;
          _templates = [];
        });
      }
      return;
    }

    if (mounted) {
      setState(() {
        _loadingTemplates = true;
        if (force) _error = null;
      });
    }

    try {
      MatterDetail? matter;
      try {
        matter = await ref
            .read(matterDetailProvider(widget.matterId).future)
            .timeout(const Duration(seconds: 12));
      } catch (_) {
        matter = ref.read(matterDetailProvider(widget.matterId)).valueOrNull;
      }
      final user = ref.read(authControllerProvider).session?.user;
      final practiceArea = matter?.practiceArea;
      final countryCode = matter?.countryCode ?? user?.countryCode;

      final client = ref.read(apiClientProvider);
      final response = await client.dio.get<dynamic>(
        '/templates',
        queryParameters: {
          if (practiceArea != null && practiceArea.isNotEmpty)
            'practiceArea': practiceArea,
          if (countryCode != null && countryCode.isNotEmpty)
            'countryCode': countryCode,
        },
        options: _tenantOptions(
          tenantId,
          receiveTimeout: const Duration(seconds: 45),
        ),
      );

      final templates = _parseTemplatesResponse(response.data, l10n);
      if (!mounted) return;
      setState(() {
        _templates = templates;
        _error = null;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      final apiMessage = (e.response?.data is Map)
          ? ((e.response!.data as Map).values.join(', '))
          : null;
      setState(() {
        _error = apiMessage?.toString().trim().isNotEmpty == true
            ? apiMessage.toString()
            : e.message ?? l10n.mattersDraftFailedRetry;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = l10n.mattersDraftFailedRetry);
    } finally {
      if (mounted) setState(() => _loadingTemplates = false);
    }
  }

  void _onTemplatePicked(_TemplateItem tpl) {
    final tokens = _extractTemplateTokens(tpl.content);
    final missing = tokens.where((t) => !_autoResolvedFields.contains(t)).toList();
    if (missing.isEmpty) {
      _draftDocument(tpl.id, null);
      return;
    }
    // Set up controllers for missing fields
    for (final key in missing) {
      _fieldControllers.putIfAbsent(key, () => TextEditingController());
    }
    setState(() {
      _pendingTemplate = tpl;
      _missingFields = missing;
    });
  }

  void _onFieldsConfirmed() {
    if (_pendingTemplate == null) return;
    final hasRequiredEmpty = _missingFields
        .where(_isRequiredField)
        .any((k) => _fieldControllers[k]?.text.trim().isEmpty ?? true);
    if (hasRequiredEmpty) {
      setState(() {}); // trigger rebuild to show validation
      return;
    }
    final overrides = {
      for (final k in _missingFields)
        if (_fieldControllers[k]?.text.trim().isNotEmpty ?? false)
          k: _fieldControllers[k]!.text.trim(),
    };
    final templateId = _pendingTemplate!.id;
    setState(() {
      _pendingTemplate = null;
      _missingFields = [];
    });
    _draftDocument(templateId, overrides.isEmpty ? null : overrides);
  }

  Future<void> _draftDocument(String templateId, Map<String, String>? mergeFieldOverrides) async {
    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null || tenantId.isEmpty) return;

    setState(() {
      _drafting = true;
      _error = null;
    });

    try {
      final client = ref.read(apiClientProvider);
      final body = mergeFieldOverrides != null ? {'mergeFieldOverrides': mergeFieldOverrides} : null;
      final response = await client.dio.post<Map<String, dynamic>>(
        '/document-automation/matters/${widget.matterId}/templates/$templateId/draft-with-ai',
        data: body,
        options: _tenantOptions(
          tenantId,
          receiveTimeout: const Duration(seconds: 120),
        ),
      );
      final data = response.data ?? {};
      if (mounted) {
        setState(() {
          _documentId = data['documentId'] as String?;
          _draftHtml = data['draftHtml'] as String?;
        });
      }
    } on DioException catch (e) {
      if (!mounted) return;
      final l10n = AppLocalizations.of(context);
      final msg = (e.response?.data as Map?)?.values.join(', ') ??
          e.message ??
          l10n.mattersDraftFailed;
      if (mounted) setState(() { _error = msg; _drafting = false; });
      return;
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _drafting = false; });
      return;
    }
    if (mounted) setState(() => _drafting = false);
  }

  Future<void> _exportFormat(String format) async {
    if (_documentId == null) return;
    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null) return;

    final l10n = AppLocalizations.of(context);
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.post<Map<String, dynamic>>(
        '/document-automation/documents/$_documentId/export/$format',
        options: _tenantOptions(tenantId),
      );
      final url = response.data?['url'] as String?;
      if (mounted && url != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.mattersExportReady(url))),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.mattersExportFailed(e.toString()))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    ref.watch(matterDetailProvider(widget.matterId));
    final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
    if ((tenantId ?? '').isNotEmpty && !_loadStarted && !_loadingTemplates) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _ensureTemplatesLoaded();
      });
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.mattersGenerateDocument),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (_drafting) {
              setState(() {
                _drafting = false;
                _error = l10n.mattersDraftFailedRetry;
              });
              return;
            }
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/lawyer/matters/${widget.matterId}');
            }
          },
        ),
      ),
      body: _draftHtml != null
          ? _ReviewView(
              draftHtml: _draftHtml!,
              documentId: _documentId,
              onExport: _exportFormat,
              onNewDocument: () => setState(() {
                _draftHtml = null;
                _documentId = null;
              }),
            )
          : _drafting
              ? _DraftingView(
                  onCancel: () => setState(() {
                    _drafting = false;
                    _error = l10n.mattersDraftFailedRetry;
                  }),
                )
              : _pendingTemplate != null
                  ? _FieldCheckView(
                      missingFields: _missingFields,
                      controllers: _fieldControllers,
                      onBack: () => setState(() {
                        _pendingTemplate = null;
                        _missingFields = [];
                      }),
                      onConfirm: _onFieldsConfirmed,
                    )
                  : _TemplatePickerView(
                      templates: _templates,
                      loading: _loadingTemplates,
                      error: _error,
                      onPick: _onTemplatePicked,
                      onRetry: () {
                        _loadStarted = false;
                        _ensureTemplatesLoaded(force: true);
                      },
                    ),
    );
  }
}

class _TemplatePickerView extends StatelessWidget {
  const _TemplatePickerView({
    required this.templates,
    required this.loading,
    required this.error,
    required this.onPick,
    required this.onRetry,
  });
  final List<_TemplateItem> templates;
  final bool loading;
  final String? error;
  final void Function(_TemplateItem tpl) onPick;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (loading) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 16),
            Text(
              l10n.mattersSelectTemplate,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 6),
            Text(
              l10n.mattersSelectTemplateSubtitle,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          l10n.mattersSelectTemplate,
          style: Theme.of(context)
              .textTheme
              .titleMedium
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(
          l10n.mattersSelectTemplateSubtitle,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
        if (error != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.errorContainer.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(AppColors.radius),
            ),
            child: Text(error!,
                style: TextStyle(
                    color: Theme.of(context).colorScheme.onErrorContainer)),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh, size: 18),
            label: Text(l10n.commonRetry),
          ),
        ],
        const SizedBox(height: 16),
        if (templates.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 32),
            child: Column(children: [
              const Icon(Icons.folder_open_outlined, size: 48, color: Colors.grey),
              const SizedBox(height: 12),
              Text(
                l10n.mattersNoTemplatesFound,
                style: const TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 4),
              Text(
                l10n.mattersAddTemplatesHint,
                style: const TextStyle(color: Colors.grey, fontSize: 12),
                textAlign: TextAlign.center,
              ),
            ]),
          )
        else
          ...templates.map(
            (tpl) => Card(
              child: ListTile(
                leading: const Icon(Icons.description_outlined),
                title: Text(tpl.name),
                subtitle: tpl.practiceArea != null
                    ? Text(tpl.practiceArea!.replaceAll('_', ' '))
                    : null,
                trailing: const Icon(Icons.chevron_right),
                onTap: () => onPick(tpl),
              ),
            ),
          ),
      ],
    );
  }
}

class _DraftingView extends StatelessWidget {
  const _DraftingView({required this.onCancel});

  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 20),
            Text(
              l10n.mattersAiDrafting,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              l10n.mattersAiDraftingSubtitle,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            TextButton(
              onPressed: onCancel,
              child: Text(l10n.commonCancel),
            ),
          ],
        ),
      ),
    );
  }
}

/// Step between template selection and drafting — collects missing merge fields.
class _FieldCheckView extends StatefulWidget {
  const _FieldCheckView({
    required this.missingFields,
    required this.controllers,
    required this.onBack,
    required this.onConfirm,
  });
  final List<String> missingFields;
  final Map<String, TextEditingController> controllers;
  final VoidCallback onBack;
  final VoidCallback onConfirm;

  @override
  State<_FieldCheckView> createState() => _FieldCheckViewState();
}

class _FieldCheckViewState extends State<_FieldCheckView> {
  bool _submitted = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.amber.shade50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.amber.shade300),
            ),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(Icons.assignment_outlined, color: Colors.amber, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Complete document details',
                      style: theme.textTheme.titleSmall
                          ?.copyWith(color: Colors.amber.shade900)),
                  const SizedBox(height: 4),
                  Text(
                    'Fill in the fields below to create a fully personalised document. '
                    'Fields marked * are required. Optional fields will be auto-filled by AI.',
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: Colors.amber.shade800),
                  ),
                ]),
              ),
            ]),
          ),
          const SizedBox(height: 20),
          ...widget.missingFields.map((key) {
            final isRequired = _isRequiredField(key);
            final ctrl = widget.controllers[key]!;
            final isEmpty = _submitted && isRequired && ctrl.text.trim().isEmpty;
            return Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Text(
                    _fieldLabel(key),
                    style: theme.textTheme.labelMedium
                        ?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  if (isRequired) ...[
                    const SizedBox(width: 4),
                    const Text('*', style: TextStyle(color: Colors.red)),
                  ] else ...[
                    const SizedBox(width: 6),
                    Text('(optional)',
                        style: theme.textTheme.labelSmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant)),
                  ],
                ]),
                const SizedBox(height: 6),
                TextField(
                  controller: ctrl,
                  onChanged: (_) {
                    if (_submitted) setState(() {});
                  },
                  decoration: InputDecoration(
                    hintText: isRequired
                        ? 'Enter ${_fieldLabel(key).toLowerCase()}'
                        : 'Leave blank to auto-fill',
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8)),
                    errorText: isEmpty ? 'This field is required' : null,
                    isDense: true,
                  ),
                ),
              ]),
            );
          }),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
              child: OutlinedButton(
                onPressed: widget.onBack,
                child: const Text('Back'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton.icon(
                onPressed: () {
                  setState(() => _submitted = true);
                  widget.onConfirm();
                },
                icon: const Icon(Icons.auto_awesome, size: 18),
                label: const Text('Generate'),
              ),
            ),
          ]),
        ],
      );
  }
}

class _ReviewView extends StatefulWidget {
  const _ReviewView({
    required this.draftHtml,
    required this.documentId,
    required this.onExport,
    required this.onNewDocument,
  });
  final String draftHtml;
  final String? documentId;
  final Future<void> Function(String format) onExport;
  final VoidCallback onNewDocument;

  @override
  State<_ReviewView> createState() => _ReviewViewState();
}

class _ReviewViewState extends State<_ReviewView> {
  bool _exportingDocx = false;
  bool _exportingPdf = false;

  String _htmlToPlainText(String html) => html
      .replaceAll(RegExp(r'<[^>]+>'), ' ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          color: Colors.amber.withValues(alpha: 0.1),
          child: Row(children: [
            const Icon(Icons.warning_amber_outlined,
                size: 18, color: Colors.amber),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                l10n.mattersAttorneyReviewRequired,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.amber[800],
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
          ]),
        ),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.mattersDocumentDraft,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: Theme.of(context)
                            .colorScheme
                            .onSurfaceVariant,
                      ),
                ),
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: Theme.of(context)
                          .colorScheme
                          .outline
                          .withValues(alpha: 0.3),
                    ),
                    borderRadius: BorderRadius.circular(AppColors.radius),
                  ),
                  child: SelectableText(
                    _htmlToPlainText(widget.draftHtml),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _exportingDocx
                      ? null
                      : () async {
                          setState(() => _exportingDocx = true);
                          await widget.onExport('docx');
                          if (mounted) setState(() => _exportingDocx = false);
                        },
                  icon: _exportingDocx
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.download_outlined, size: 16),
                  label: Text(l10n.mattersExportDocx),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _exportingPdf
                      ? null
                      : () async {
                          setState(() => _exportingPdf = true);
                          await widget.onExport('pdf');
                          if (mounted) setState(() => _exportingPdf = false);
                        },
                  icon: _exportingPdf
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.picture_as_pdf_outlined, size: 16),
                  label: Text(l10n.mattersExportPdf),
                ),
              ),
            ]),
            const SizedBox(height: 8),
            TextButton(
              onPressed: widget.onNewDocument,
              child: Text(l10n.mattersGenerateAnotherDocument),
            ),
          ]),
        ),
      ],
    );
  }
}
