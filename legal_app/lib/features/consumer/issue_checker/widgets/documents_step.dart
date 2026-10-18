import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/providers/app_providers.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../l10n/app_localizations.dart';
import '../issue_checker_constants.dart';

String? _mimeTypeFor(PlatformFile file) {
  final ext = file.extension?.toLowerCase();
  return switch (ext) {
    'pdf' => 'application/pdf',
    'doc' => 'application/msword',
    'docx' =>
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'jpg' || 'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    _ => null,
  };
}

class DocumentsStep extends ConsumerStatefulWidget {
  const DocumentsStep({
    super.key,
    required this.data,
    required this.isAuthenticated,
    required this.onComplete,
    required this.onRequireSignUp,
    this.onBack,
    this.initialCaseId,
  });

  final IssueCheckerWizardData data;
  final bool isAuthenticated;
  final void Function(String? caseId) onComplete;
  final VoidCallback onRequireSignUp;
  final VoidCallback? onBack;
  final String? initialCaseId;

  @override
  ConsumerState<DocumentsStep> createState() => _DocumentsStepState();
}

class _DocumentsStepState extends ConsumerState<DocumentsStep> {
  final List<PlatformFile> _files = [];
  bool _uploading = false;
  String? _error;

  Future<void> _pickFiles() async {
    if (!widget.isAuthenticated) {
      widget.onRequireSignUp();
      return;
    }
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: true,
      type: FileType.custom,
      allowedExtensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
      withData: true,
    );
    if (result == null) return;
    setState(() => _files.addAll(result.files));
  }

  void _removeFile(int index) => setState(() => _files.removeAt(index));

  Future<void> _proceed() async {
    if (_files.isEmpty) {
      widget.onComplete(widget.initialCaseId);
      return;
    }

    setState(() {
      _uploading = true;
      _error = null;
    });

    try {
      final api = ref.read(apiClientProvider);
      final data = widget.data;

      // Create draft case if we don't have one yet.
      String caseId = widget.initialCaseId ?? '';
      if (caseId.isEmpty) {
        final created = await ref.read(consumersApiProvider).createCase(
              countryCode: data.countryCode,
              issueType: data.issueType.isNotEmpty ? data.issueType : 'Other',
              title: data.title.isNotEmpty ? data.title : data.facts.substring(0, data.facts.length.clamp(0, 100)),
              facts: data.facts,
              jurisdiction:
                  data.jurisdiction.isNotEmpty ? data.jurisdiction : null,
            );
        caseId = created.id;
      }

      for (final file in _files) {
        if (file.bytes == null) continue;

        // Step 1: get presigned URL
        final urlResp = await api.dio.post<Map<String, dynamic>>(
          '/documents/consumer/upload-url',
          data: {'consumerCaseId': caseId, 'fileName': file.name},
        );
        final uploadUrl = urlResp.data!['uploadUrl'] as String;
        final fileUrl = urlResp.data!['fileUrl'] as String;

        // Step 2: upload bytes
        final mime = _mimeTypeFor(file) ?? 'application/octet-stream';
        await Dio().put<dynamic>(
          uploadUrl,
          data: Stream.fromIterable(file.bytes!.map((b) => [b])),
          options: Options(
            contentType: mime,
            headers: {'Content-Length': file.bytes!.length},
          ),
        );

        // Step 3: register document metadata
        await ref.read(documentsApiProvider).uploadConsumerDocument(
              consumerCaseId: caseId,
              fileName: file.name,
              fileUrl: fileUrl,
              mimeType: mime,
              fileSizeBytes: file.size,
            );
      }

      if (mounted) widget.onComplete(caseId);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _uploading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.issueCheckerStepsDocuments,
            style: theme.textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 6),
          Text(
            l10n.issueCheckerDocumentsHelpAnalysis,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 16),
          // Upload area
          InkWell(
            onTap: _uploading ? null : _pickFiles,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 24),
              decoration: BoxDecoration(
                border: Border.all(
                  color: theme.colorScheme.outline,
                  style: BorderStyle.solid,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  Icon(
                    Icons.upload_file_outlined,
                    size: 36,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    l10n.issueCheckerAttachDocuments,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.primary,
                    ),
                  ),
                  Text(
                    'PDF, Word, JPG — up to 10 MB each',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_files.isNotEmpty) ...[
            const SizedBox(height: 12),
            ...List.generate(_files.length, (i) {
              final f = _files[i];
              return ListTile(
                dense: true,
                leading: const Icon(Icons.insert_drive_file_outlined),
                title: Text(f.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text('${(f.size / 1024).toStringAsFixed(1)} KB'),
                trailing: IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  onPressed: _uploading ? null : () => _removeFile(i),
                ),
              );
            }),
          ],
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: AppColors.destructiveLight),
            ),
          ],
          const SizedBox(height: 24),
          if (_uploading)
            const Center(child: CircularProgressIndicator())
          else
            Row(
              children: [
                if (widget.onBack != null) ...[
                  OutlinedButton(
                    onPressed: widget.onBack,
                    child: Text(l10n.commonBack),
                  ),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: FilledButton(
                    onPressed: _proceed,
                    child: Text(_files.isEmpty
                        ? l10n.issueCheckerSkip
                        : l10n.commonContinue),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
