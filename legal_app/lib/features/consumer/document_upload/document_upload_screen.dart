import '../../../l10n/app_localizations.dart';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../cases/cases_list_screen.dart';
import '../cases/workspace/case_workspace_providers.dart';

class DocumentUploadScreen extends ConsumerStatefulWidget {
  const DocumentUploadScreen({super.key, this.initialCaseId});

  final String? initialCaseId;

  @override
  ConsumerState<DocumentUploadScreen> createState() =>
      _DocumentUploadScreenState();
}

class _DocumentUploadScreenState extends ConsumerState<DocumentUploadScreen> {
  String? _selectedCaseId;
  PlatformFile? _pickedFile;
  bool _isUploading = false;
  double? _uploadProgress;
  String? _uploadMessage;
  bool _uploadSuccess = false;

  @override
  void initState() {
    super.initState();
    _selectedCaseId = widget.initialCaseId;
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;
    setState(() {
      _pickedFile = result.files.first;
      _uploadMessage = null;
      _uploadSuccess = false;
    });
  }

  // Real two-phase upload:
  //  1. POST /documents/consumer/upload-url → { uploadUrl, fileUrl, key }
  //  2. PUT fileBytes to uploadUrl (presigned or local signed URL)
  //  3. POST /documents/consumer/upload with fileUrl metadata
  Future<void> _upload() async {
    final caseId = _selectedCaseId;
    final file = _pickedFile;

    if (caseId == null || caseId.isEmpty) {
      setState(() {
        _uploadMessage = 'Select a case before uploading.';
        _uploadSuccess = false;
      });
      return;
    }
    if (file == null || file.bytes == null) {
      setState(() {
        _uploadMessage = 'Choose a document to upload.';
        _uploadSuccess = false;
      });
      return;
    }

    setState(() {
      _isUploading = true;
      _uploadProgress = null;
      _uploadMessage = null;
      _uploadSuccess = false;
    });

    try {
      final api = ref.read(apiClientProvider);

      // Step 1: get presigned upload URL
      final urlResp = await api.dio.post<Map<String, dynamic>>(
        '/documents/consumer/upload-url',
        data: {
          'consumerCaseId': caseId,
          'fileName': file.name,
        },
      );
      final uploadUrl = urlResp.data!['uploadUrl'] as String;
      final fileUrl = urlResp.data!['fileUrl'] as String;

      // Step 2: PUT the raw bytes to the upload URL
      await Dio().put<dynamic>(
        uploadUrl,
        data: Stream.fromIterable(file.bytes!.map((b) => [b])),
        options: Options(
          contentType: _mimeTypeForFile(file) ?? 'application/octet-stream',
          headers: {'Content-Length': file.bytes!.length},
        ),
        onSendProgress: (sent, total) {
          if (total > 0) {
            setState(() => _uploadProgress = sent / total);
          }
        },
      );

      // Step 3: register the document metadata
      final result = await ref
          .read(documentsApiProvider)
          .uploadConsumerDocument(
            consumerCaseId: caseId,
            fileName: file.name,
            fileUrl: fileUrl,
            mimeType: _mimeTypeForFile(file),
            fileSizeBytes: file.size,
          );

      ref.invalidate(caseDocumentsProvider(caseId));

      if (mounted) {
        setState(() {
          _pickedFile = null;
          _uploadProgress = null;
          _uploadSuccess = true;
          _uploadMessage =
              '${result.document.fileName} uploaded. OCR: ${result.ocrStatus}.';
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _uploadProgress = null;
          _uploadSuccess = false;
          _uploadMessage = error is ApiException
              ? error.message
              : 'Upload failed. Please try again.';
        });
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  String? _mimeTypeForFile(PlatformFile file) {
    return switch (file.extension?.toLowerCase()) {
      'pdf' => 'application/pdf',
      'doc' => 'application/msword',
      'docx' =>
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'jpg' || 'jpeg' => 'image/jpeg',
      'png' => 'image/png',
      _ => null,
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final muted =
        isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;

    final casesAsync = ref.watch(casesListProvider);
    final documentsAsync = _selectedCaseId == null
        ? const AsyncValue<List<ConsumerDocument>>.data([])
        : ref.watch(caseDocumentsProvider(_selectedCaseId!));

    return Scaffold(
      backgroundColor: isDark ? AppColors.logoBlue : null,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(l10n.consumerUploadDocument),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/consumer'),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(casesListProvider);
          final caseId = _selectedCaseId;
          if (caseId != null) ref.invalidate(caseDocumentsProvider(caseId));
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 96),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            // ── Hero intro card ──────────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: surface,
                borderRadius: BorderRadius.circular(AppColors.radius),
                border: Border.all(color: border),
              ),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: cs.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.cloud_upload_outlined,
                        color: cs.primary, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Upload document',
                            style: tt.labelLarge
                                ?.copyWith(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 2),
                        Text(
                          l10n.consumerAttachDocumentsToACaseForOcrAndAiAnalysis,
                          style: tt.bodySmall?.copyWith(color: muted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // ── Case selector ────────────────────────────────────────────
            Text('Select case',
                style: tt.labelMedium?.copyWith(
                    fontWeight: FontWeight.w600, color: muted)),
            const SizedBox(height: 8),
            casesAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (e, _) => AppErrorView(
                  message: e is ApiException ? e.message : e.toString()),
              data: (cases) {
                if (cases.isEmpty) {
                  return Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: surface,
                      borderRadius: BorderRadius.circular(AppColors.radius),
                      border: Border.all(color: border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l10n.consumerNoCasesYet,
                            style: const TextStyle(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 8),
                        Text(l10n
                            .consumerRunTheIssueCheckerToCreateACaseBeforeUploadingDocu,
                            style: tt.bodySmall?.copyWith(color: muted)),
                        const SizedBox(height: 12),
                        FilledButton.tonal(
                          onPressed: () =>
                              context.go('/consumer/issue-checker'),
                          child: Text(l10n.consumerOpenIssueChecker),
                        ),
                      ],
                    ),
                  );
                }
                return DropdownButtonFormField<String>(
                  initialValue: _selectedCaseId,
                  decoration: InputDecoration(
                    labelText: l10n.consumerCase,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppColors.radius),
                    ),
                  ),
                  items: cases
                      .map((c) =>
                          DropdownMenuItem(value: c.id, child: Text(c.title)))
                      .toList(),
                  onChanged: (v) => setState(() {
                    _selectedCaseId = v;
                    _uploadMessage = null;
                    _uploadSuccess = false;
                  }),
                );
              },
            ),
            const SizedBox(height: 24),

            // ── File picker card ─────────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: surface,
                borderRadius: BorderRadius.circular(AppColors.radius),
                border: Border.all(color: border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.attach_file_outlined, color: muted, size: 16),
                      const SizedBox(width: 6),
                      Text(l10n.consumerSelectedFile,
                          style: tt.labelMedium?.copyWith(
                              fontWeight: FontWeight.w600, color: muted)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (_pickedFile != null) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: cs.primary.withValues(alpha: 0.07),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                            color: cs.primary.withValues(alpha: 0.25)),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.description_outlined,
                              color: cs.primary, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(_pickedFile!.name,
                                    style: tt.bodySmall?.copyWith(
                                        fontWeight: FontWeight.w600),
                                    overflow: TextOverflow.ellipsis),
                                Text(
                                  '${(_pickedFile!.size / 1024).toStringAsFixed(1)} KB',
                                  style:
                                      tt.bodySmall?.copyWith(color: muted),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: Icon(Icons.close, size: 16, color: muted),
                            onPressed: () => setState(
                                () => _pickedFile = null),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                  ] else ...[
                    InkWell(
                      onTap: _isUploading ? null : _pickFile,
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 24),
                        decoration: BoxDecoration(
                          color: isDark
                              ? AppColors.logoBlue
                              : const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: border,
                            style: BorderStyle.solid,
                          ),
                        ),
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.cloud_upload_outlined,
                                  size: 32, color: muted),
                              const SizedBox(height: 8),
                              Text('Tap to select a file',
                                  style: tt.bodySmall
                                      ?.copyWith(color: muted)),
                              const SizedBox(height: 4),
                              Text('PDF, DOC, DOCX, JPG, PNG',
                                  style: tt.labelSmall
                                      ?.copyWith(color: muted.withValues(alpha: 0.7))),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],

                  // Upload progress
                  if (_isUploading && _uploadProgress != null) ...[
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: _uploadProgress,
                        minHeight: 4,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${(_uploadProgress! * 100).toStringAsFixed(0)}% uploading…',
                      style:
                          tt.bodySmall?.copyWith(color: muted),
                    ),
                    const SizedBox(height: 12),
                  ],

                  Row(
                    children: [
                      if (_pickedFile == null)
                        OutlinedButton.icon(
                          onPressed: _isUploading ? null : _pickFile,
                          icon: const Icon(Icons.attach_file, size: 16),
                          label: Text(l10n.consumerChooseFile),
                        ),
                      if (_pickedFile != null) ...[
                        OutlinedButton.icon(
                          onPressed: _isUploading ? null : _pickFile,
                          icon: const Icon(Icons.swap_horiz, size: 16),
                          label: const Text('Change file'),
                        ),
                        const SizedBox(width: 10),
                        FilledButton.icon(
                          onPressed: _isUploading ? null : _upload,
                          icon: _isUploading
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white))
                              : const Icon(Icons.cloud_upload_outlined,
                                  size: 16),
                          label: Text(_isUploading ? 'Uploading…' : 'Upload'),
                        ),
                      ],
                    ],
                  ),

                  if (_uploadMessage != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: (_uploadSuccess
                                ? const Color(0xFF10B981)
                                : const Color(0xFFEF4444))
                            .withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            _uploadSuccess
                                ? Icons.check_circle_outline
                                : Icons.error_outline,
                            size: 16,
                            color: _uploadSuccess
                                ? const Color(0xFF10B981)
                                : const Color(0xFFEF4444),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _uploadMessage!,
                              style: tt.bodySmall?.copyWith(
                                color: _uploadSuccess
                                    ? const Color(0xFF10B981)
                                    : const Color(0xFFEF4444),
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
            const SizedBox(height: 28),

            // ── Existing documents ───────────────────────────────────────
            if (_selectedCaseId != null) ...[
              Text(
                l10n.consumerDocumentsForThisCase,
                style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              documentsAsync.when(
                loading: () => const LinearProgressIndicator(),
                error: (e, _) => AppErrorView(
                    message: e is ApiException ? e.message : e.toString()),
                data: (documents) {
                  if (documents.isEmpty) {
                    return AppEmptyState(
                      icon: Icons.folder_open_outlined,
                      label: l10n.consumerNoDocumentsUploadedForThisCaseYet,
                    );
                  }
                  return Column(
                    children: documents
                        .map((doc) => Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 12),
                              decoration: BoxDecoration(
                                color: surface,
                                borderRadius:
                                    BorderRadius.circular(AppColors.radius),
                                border: Border.all(color: border),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 36,
                                    height: 36,
                                    decoration: BoxDecoration(
                                      color: cs.primary.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Icon(
                                        Icons.description_outlined,
                                        color: cs.primary,
                                        size: 18),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(doc.fileName,
                                            style: tt.bodyMedium?.copyWith(
                                                fontWeight: FontWeight.w600),
                                            overflow: TextOverflow.ellipsis),
                                        const SizedBox(height: 2),
                                        Text(
                                          [
                                            if (doc.ocrStatus != null)
                                              doc.ocrStatus!,
                                            if (doc.fileSizeBytes != null)
                                              '${(doc.fileSizeBytes! / 1024).toStringAsFixed(1)} KB',
                                          ].join(' · '),
                                          style: tt.bodySmall
                                              ?.copyWith(color: muted),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ))
                        .toList(),
                  );
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}
