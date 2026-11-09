import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/firm_knowledge_api.dart';
import '../../../core/network/work_context_api.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/routing/lawyer_shell_scope.dart';
import '../../../l10n/app_localizations.dart';
import '../../../widgets/form_dropdown.dart';
import '../../consent/ai_inference_consent_dialog.dart';

class FirmKnowledgeScreen extends ConsumerStatefulWidget {
  const FirmKnowledgeScreen({super.key});
  @override
  ConsumerState<FirmKnowledgeScreen> createState() =>
      _FirmKnowledgeScreenState();
}

class _FirmKnowledgeScreenState extends ConsumerState<FirmKnowledgeScreen> {
  final _title = TextEditingController(),
      _content = TextEditingController(),
      _search = TextEditingController(),
      _note = TextEditingController();
  final _detailKey = GlobalKey();
  String? _workspace, _matterId, _documentId, _sourceId;
  String _sourceType = 'custom', _rightsBasis = 'FIRM_WORK_PRODUCT';
  bool _rightsConfirmed = false,
      _selfReviewed = false,
      _firmWide = false,
      _busy = false,
      _loading = true;
  DateTime? _expires;
  FirmKnowledgeList _data = const FirmKnowledgeList();
  FirmKnowledgeItem? _detail;
  List<FirmMatter> _matters = [];
  List<Map<String, dynamic>> _documents = [];
  String? _error;
  Timer? _refresh, _debounce;
  int _request = 0, _matterRequest = 0, _documentRequest = 0;
  String? get _tenant =>
      ref.read(authControllerProvider).session?.user.tenantId;
  FirmKnowledgeApi get _api => FirmKnowledgeApi(ref.read(apiClientProvider));

  @override
  void initState() {
    super.initState();
    unawaited(_load());
    _refresh = Timer.periodic(
      const Duration(seconds: 30),
      (_) => unawaited(_load()),
    );
  }

  @override
  void dispose() {
    _refresh?.cancel();
    _debounce?.cancel();
    for (final controller in [_title, _content, _search, _note]) {
      controller.dispose();
    }
    super.dispose();
  }

  void _resetForm() {
    _sourceId = null;
    _sourceType = 'custom';
    _title.clear();
    _content.clear();
    _matterId = null;
    _documentId = null;
    _documents = [];
    _rightsConfirmed = false;
    _rightsBasis = 'FIRM_WORK_PRODUCT';
    _expires = null;
  }

  Future<void> _load() async {
    final tenant = _tenant;
    if (tenant == null) return;
    final request = ++_request;
    final changedWorkspace = tenant != _workspace;
    if (changedWorkspace && mounted) {
      setState(() {
        _workspace = tenant;
        _resetForm();
        _detail = null;
        _data = const FirmKnowledgeList();
        _matters = [];
        _note.clear();
        _selfReviewed = false;
        _firmWide = false;
        _loading = true;
      });
      unawaited(_loadMatters());
    }
    try {
      final data = await _api.list(tenant);
      FirmKnowledgeItem? detail = _detail;
      if (detail != null) {
        try {
          detail = await _api.get(tenant, detail.id);
        } on ApiException {
          detail = null;
        }
      }
      if (mounted && tenant == _tenant && request == _request) {
        setState(() {
          _data = data;
          _detail = detail;
          _loading = false;
          _error = null;
        });
      }
    } catch (_) {
      if (mounted && tenant == _tenant && request == _request) {
        setState(() {
          _loading = false;
          _detail = null;
          _error = AppLocalizations.of(context).commonKnowledgeError;
        });
      }
    }
  }

  Future<void> _loadMatters() async {
    final tenant = _tenant;
    if (tenant == null) return;
    final request = ++_matterRequest;
    try {
      final items = await ref
          .read(mattersApiProvider)
          .listMatters(tenantId: tenant, search: _search.text.trim());
      if (mounted && tenant == _tenant && request == _matterRequest) {
        setState(() => _matters = items);
      }
    } catch (_) {
      if (mounted && tenant == _tenant && request == _matterRequest) {
        setState(
          () => _error = AppLocalizations.of(
            context,
          ).commonCalendarMattersUnavailable,
        );
      }
    }
  }

  Future<void> _loadDocuments() async {
    final tenant = _tenant, matterId = _matterId;
    final request = ++_documentRequest;
    if (tenant == null || matterId == null) return;
    try {
      final response = await ref
          .read(apiClientProvider)
          .dio
          .get<Map<String, dynamic>>(
            '/ai/research/matter-context',
            queryParameters: {'matterId': matterId},
            options: Options(headers: {'X-Tenant-Id': tenant}),
          );
      if (mounted &&
          tenant == _tenant &&
          matterId == _matterId &&
          request == _documentRequest) {
        setState(
          () =>
              _documents = (response.data?['documents'] as List<dynamic>? ?? [])
                  .whereType<Map<String, dynamic>>()
                  .toList(),
        );
      }
    } catch (_) {
      if (mounted && tenant == _tenant && matterId == _matterId) {
        setState(
          () => _error = AppLocalizations.of(context).commonKnowledgeError,
        );
      }
    }
  }

  Future<void> _view(FirmKnowledgeItem item) async {
    final tenant = _tenant;
    if (tenant == null || _busy) return;
    setState(() => _busy = true);
    try {
      final detail = await _api.get(tenant, item.id);
      if (mounted && tenant == _tenant) {
        setState(() {
          _detail = detail;
          _selfReviewed = false;
          _firmWide = false;
          _note.clear();
        });
        WidgetsBinding.instance.addPostFrameCallback((_) {
          final target = _detailKey.currentContext;
          if (mounted && target != null) {
            unawaited(
              Scrollable.ensureVisible(
                target,
                duration: const Duration(milliseconds: 250),
              ),
            );
          }
        });
      }
    } catch (_) {
      if (mounted && tenant == _tenant) {
        setState(() {
          _detail = null;
          _error = AppLocalizations.of(context).commonKnowledgeError;
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submit() async {
    final tenant = _tenant;
    if (tenant == null ||
        tenant != _workspace ||
        !_rightsConfirmed ||
        !_data.canSubmit ||
        _busy) {
      return;
    }
    setState(() => _busy = true);
    try {
      _sourceId ??= WorkContextOperation.newKey();
      final item = await _api.submit(tenant, {
        'sourceType': _sourceType,
        'sourceId': _sourceId,
        'title': _title.text.trim(),
        'content': _content.text.trim(),
        if (_matterId != null) 'matterId': _matterId,
        if (_documentId != null) 'documentId': _documentId,
        'rightsBasis': _rightsBasis,
        'rightsConfirmed': _rightsConfirmed,
        if (_expires != null)
          'rightsExpiresAt': _expires!.toUtc().toIso8601String(),
      });
      if (mounted && tenant == _tenant) {
        setState(_resetForm);
        _message(AppLocalizations.of(context).commonKnowledgeSaved);
        await _load();
        if (mounted && tenant == _tenant) {
          final detail = await _api.get(tenant, item.id);
          if (mounted && tenant == _tenant) {
            setState(() => _detail = detail);
          }
        }
      }
    } catch (_) {
      if (mounted && tenant == _tenant) {
        _message(AppLocalizations.of(context).commonKnowledgeError);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _review(String decision) async {
    final tenant = _tenant, item = _detail;
    if (tenant == null ||
        tenant != _workspace ||
        item == null ||
        item.tenantId != tenant ||
        _busy) {
      return;
    }
    if (decision == 'approve') {
      final consent = await requireAiInferenceConsent(context);
      if (!consent || !mounted || tenant != _tenant) return;
    }
    setState(() => _busy = true);
    try {
      await _api.review(
        tenant,
        item,
        decision,
        selfReviewConfirmed: _selfReviewed,
        firmWideConfirmed: _firmWide,
        note: _note.text,
      );
      if (mounted && tenant == _tenant) {
        _message(AppLocalizations.of(context).commonKnowledgeUpdated);
        await _load();
      }
    } catch (_) {
      if (mounted && tenant == _tenant) {
        _message(AppLocalizations.of(context).commonKnowledgeError);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _message(String message) => ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text(message)));
  Future<void> _pickExpiry() async {
    final now = DateTime.now(), initial = _expires?.toLocal();
    final date = await showDatePicker(
      context: context,
      initialDate: initial != null && initial.isAfter(now) ? initial : now,
      firstDate: now,
      lastDate: DateTime(now.year + 20),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: initial == null
          ? const TimeOfDay(hour: 23, minute: 59)
          : TimeOfDay.fromDateTime(initial),
    );
    if (time != null && mounted) {
      setState(
        () => _expires = DateTime(
          date.year,
          date.month,
          date.day,
          time.hour,
          time.minute,
        ),
      );
    }
  }

  String _status(AppLocalizations l, FirmKnowledgeItem item) {
    if (item.rightsExpired) return l.commonKnowledgeExpired;
    return switch (item.status) {
      'PENDING' => l.commonKnowledgeStatusPending,
      'INDEXING' => l.commonKnowledgeStatusIndexing,
      'APPROVED' => l.commonKnowledgeStatusApproved,
      'INDEX_FAILED' => l.commonKnowledgeStatusIndexFailed,
      'REJECTED' => l.commonKnowledgeStatusRejected,
      'REVOKED' => l.commonKnowledgeStatusRevoked,
      _ => l.commonKnowledgeStatusUnknown,
    };
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context),
        user = ref.watch(authControllerProvider).session?.user;
    ref.listen(authControllerProvider, (previous, next) {
      if (previous?.session?.user.tenantId != next.session?.user.tenantId) {
        unawaited(_load());
      }
    });
    final detail = _detail;
    final maker = detail?.lastEditedById == user?.id;
    final reviewable =
        detail != null && ['PENDING', 'INDEX_FAILED'].contains(detail.status);
    final canApprove =
        _data.canReview &&
        reviewable &&
        !detail.rightsExpired &&
        (!maker || (!_data.independentReviewRequired && _selfReviewed)) &&
        (detail.matterId != null || _firmWide);
    return Scaffold(
      appBar: AppBar(
        leading: const LawyerMenuButton(),
        title: Text(l.commonKnowledgeTitle),
        actions: [
          IconButton(
            onPressed: () => unawaited(_load()),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading || _workspace != user?.tenantId
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(l.commonKnowledgeDescription),
                  const SizedBox(height: 16),
                  if (_error != null)
                    TextButton(
                      onPressed: () => unawaited(_load()),
                      child: Text(_error!),
                    ),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            l.commonKnowledgeNew,
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          if (!_data.canSubmit) Text(l.commonKnowledgeReadOnly),
                          TextField(
                            controller: _title,
                            maxLength: 300,
                            decoration: InputDecoration(
                              labelText: l.commonTitle,
                            ),
                          ),
                          TextField(
                            controller: _content,
                            maxLines: 7,
                            maxLength: 100000,
                            decoration: InputDecoration(
                              labelText: l.commonKnowledgeContent,
                            ),
                          ),
                          TextField(
                            controller: _search,
                            decoration: InputDecoration(
                              labelText: l.commonCalendarSearchMatters,
                            ),
                            onChanged: (_) {
                              _debounce?.cancel();
                              _debounce = Timer(
                                const Duration(milliseconds: 300),
                                () => unawaited(_loadMatters()),
                              );
                            },
                          ),
                          Text(l.commonCalendarLinkedMatter),
                          FormDropdown<String?>(
                            value: _matterId,
                            items: [
                              DropdownMenuItem<String?>(
                                value: null,
                                child: Text(l.commonNone),
                              ),
                              if (_matterId != null &&
                                  !_matters.any((m) => m.id == _matterId))
                                DropdownMenuItem<String?>(
                                  value: _matterId,
                                  child: Text(l.commonCalendarLinkedMatter),
                                ),
                              ..._matters.map(
                                (m) => DropdownMenuItem<String?>(
                                  value: m.id,
                                  child: Text(m.title),
                                ),
                              ),
                            ],
                            onChanged: (value) {
                              setState(() {
                                _matterId = value;
                                _documentId = null;
                                _documents = [];
                              });
                              unawaited(_loadDocuments());
                            },
                          ),
                          if (_matterId != null) ...[
                            Text(l.commonKnowledgeSourceDocument),
                            FormDropdown<String?>(
                              value: _documentId,
                              items: [
                                DropdownMenuItem<String?>(
                                  value: null,
                                  child: Text(l.commonNone),
                                ),
                                if (_documentId != null &&
                                    !_documents.any(
                                      (d) => d['id'] == _documentId,
                                    ))
                                  DropdownMenuItem<String?>(
                                    value: _documentId,
                                    child: Text(
                                      l.commonKnowledgeSourceDocument,
                                    ),
                                  ),
                                ..._documents.map(
                                  (d) => DropdownMenuItem<String?>(
                                    value: d['id'] as String,
                                    child: Text(d['fileName'] as String),
                                  ),
                                ),
                              ],
                              onChanged: (value) =>
                                  setState(() => _documentId = value),
                            ),
                          ],
                          Text(l.commonKnowledgeRights),
                          FormDropdown<String>(
                            value: _rightsBasis,
                            items: [
                              DropdownMenuItem(
                                value: 'FIRM_WORK_PRODUCT',
                                child: Text(l.commonKnowledgeRightsFirm),
                              ),
                              DropdownMenuItem(
                                value: 'LICENSED_INTERNAL_USE',
                                child: Text(l.commonKnowledgeRightsLicense),
                              ),
                              DropdownMenuItem(
                                value: 'PUBLIC_DOMAIN',
                                child: Text(l.commonKnowledgeRightsPublic),
                              ),
                            ],
                            onChanged: (value) {
                              if (value != null) {
                                setState(() => _rightsBasis = value);
                              }
                            },
                          ),
                          Row(
                            children: [
                              Expanded(
                                child: TextButton(
                                  onPressed: () => unawaited(_pickExpiry()),
                                  child: Text(
                                    _expires == null
                                        ? l.commonKnowledgeExpiry
                                        : DateFormat.yMMMd().add_Hm().format(
                                            _expires!.toLocal(),
                                          ),
                                  ),
                                ),
                              ),
                              if (_expires != null)
                                IconButton(
                                  onPressed: () =>
                                      setState(() => _expires = null),
                                  icon: const Icon(Icons.clear),
                                ),
                            ],
                          ),
                          CheckboxListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(l.commonKnowledgeRightsConfirm),
                            value: _rightsConfirmed,
                            onChanged: (value) => setState(
                              () => _rightsConfirmed = value ?? false,
                            ),
                          ),
                          FilledButton(
                            onPressed:
                                _busy || !_data.canSubmit || !_rightsConfirmed
                                ? null
                                : () => unawaited(_submit()),
                            child: Text(
                              _busy ? l.commonLoading : l.commonKnowledgeSubmit,
                            ),
                          ),
                          TextButton(
                            onPressed: _busy
                                ? null
                                : () => setState(_resetForm),
                            child: Text(l.commonKnowledgeNew),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    l.commonKnowledgeCount(
                      _data.count.toString(),
                      _data.limit.toString(),
                    ),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  if (_data.items.isEmpty)
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(l.commonKnowledgeEmpty),
                    ),
                  ..._data.items.map(
                    (item) => Card(
                      child: ListTile(
                        title: Text(item.title),
                        subtitle: Text(_status(l, item)),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: _busy ? null : () => unawaited(_view(item)),
                      ),
                    ),
                  ),
                  if (detail != null && detail.tenantId == user?.tenantId)
                    Card(
                      key: _detailKey,
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              detail.title,
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                            Text(
                              l.commonKnowledgeRevision(
                                detail.revision.toString(),
                              ),
                            ),
                            Text(_status(l, detail)),
                            SizedBox(
                              height: 280,
                              child: SingleChildScrollView(
                                child: SelectableText(detail.content),
                              ),
                            ),
                            if (_data.canSubmit)
                              OutlinedButton(
                                onPressed: _busy
                                    ? null
                                    : () {
                                        setState(() {
                                          _sourceId = detail.sourceId;
                                          _sourceType = detail.sourceType;
                                          _title.text = detail.title;
                                          _content.text = detail.content;
                                          _matterId = detail.matterId;
                                          _documentId = detail.documentId;
                                          _rightsBasis = detail.rightsBasis;
                                          _expires = detail.rightsExpiresAt;
                                          _rightsConfirmed = false;
                                        });
                                        unawaited(_loadDocuments());
                                      },
                                child: Text(l.commonKnowledgeRevise),
                              ),
                            if (_data.canReview && reviewable) ...[
                              if (maker && _data.independentReviewRequired)
                                Text(l.commonKnowledgeIndependentReview),
                              if (maker && !_data.independentReviewRequired)
                                CheckboxListTile(
                                  title: Text(
                                    l.commonKnowledgeSelfReviewConfirm,
                                  ),
                                  value: _selfReviewed,
                                  onChanged: (value) => setState(
                                    () => _selfReviewed = value ?? false,
                                  ),
                                ),
                              if (detail.matterId == null)
                                CheckboxListTile(
                                  title: Text(l.commonKnowledgeFirmWideConfirm),
                                  value: _firmWide,
                                  onChanged: (value) => setState(
                                    () => _firmWide = value ?? false,
                                  ),
                                ),
                              TextField(
                                controller: _note,
                                maxLength: 2000,
                                decoration: InputDecoration(
                                  labelText: l.commonKnowledgeReviewNote,
                                ),
                              ),
                              FilledButton(
                                onPressed: _busy || !canApprove
                                    ? null
                                    : () => unawaited(_review('approve')),
                                child: Text(l.commonKnowledgeApprove),
                              ),
                              OutlinedButton(
                                onPressed: _busy
                                    ? null
                                    : () => unawaited(_review('reject')),
                                child: Text(l.commonKnowledgeReject),
                              ),
                            ],
                            if ((_data.canReview ||
                                    detail.createdById == user?.id) &&
                                detail.status != 'REVOKED')
                              TextButton(
                                onPressed: _busy
                                    ? null
                                    : () => unawaited(_review('revoke')),
                                child: Text(l.commonKnowledgeRevoke),
                              ),
                            if (detail.reviews.isNotEmpty) ...[
                              Text(
                                l.commonKnowledgeReviewHistory,
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              ...detail.reviews.map(
                                (r) => ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  title: Text(
                                    l.commonKnowledgeRevision(
                                      '${r['revision']}',
                                    ),
                                  ),
                                  subtitle: Text(
                                    [
                                          r['decision'] == 'APPROVE'
                                              ? l.commonKnowledgeStatusApproved
                                              : r['decision'] == 'REJECT'
                                              ? l.commonKnowledgeStatusRejected
                                              : l.commonKnowledgeStatusRevoked,
                                          r['note'] as String? ?? '',
                                        ]
                                        .where((text) => text.isNotEmpty)
                                        .join('\n'),
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}
