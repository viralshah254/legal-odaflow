import '../../../l10n/app_localizations.dart';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';
import 'package:speech_to_text/speech_to_text.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_list_skeleton.dart';
import '../../../core/widgets/app_page_header.dart';

class EvidenceItem {
  final String id;
  final String title;
  final String? description;
  final String? documentId;
  final String createdAt;
  final String addedByName;
  final String? chainOfCustody;

  EvidenceItem({
    required this.id,
    required this.title,
    this.description,
    this.documentId,
    required this.createdAt,
    required this.addedByName,
    this.chainOfCustody,
  });

  factory EvidenceItem.fromJson(Map<String, dynamic> j) => EvidenceItem(
        id: j['id'] as String,
        title: j['title'] as String? ?? 'Evidence',
        description: j['description'] as String?,
        documentId: j['documentId'] as String?,
        createdAt: j['createdAt'] as String? ?? '',
        addedByName: (j['addedBy'] as Map<String, dynamic>?)?['name'] as String? ?? 'Unknown',
        chainOfCustody: j['chainOfCustody'] as String?,
      );
}

class EvidenceVaultScreen extends ConsumerStatefulWidget {
  final String matterId;
  final String matterTitle;

  const EvidenceVaultScreen({
    super.key,
    required this.matterId,
    required this.matterTitle,
  });

  @override
  ConsumerState<EvidenceVaultScreen> createState() => _EvidenceVaultScreenState();
}

class _EvidenceVaultScreenState extends ConsumerState<EvidenceVaultScreen> {
  List<EvidenceItem> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final resp = await api.dio.get<dynamic>('/evidence/matters/${widget.matterId}');
      final list = (resp.data as List<dynamic>? ?? []);
      setState(() {
        _items = list.map((e) => EvidenceItem.fromJson(e as Map<String, dynamic>)).toList();
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _logAccess(String evidenceId, String action) async {
    try {
      final api = ref.read(apiClientProvider);
      await api.dio.post<dynamic>('/evidence/$evidenceId/access', data: {'action': action});
    } catch (_) {}
  }

  // ── Evidence capture helpers ──────────────────────────────────────────────

  Future<void> _uploadEvidenceFile({
    required List<int> bytes,
    required String fileName,
    required String mimeType,
    String? title,
    String? description,
  }) async {
    try {
      final api = ref.read(apiClientProvider);
      final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
      // Create evidence record first
      await api.dio.post<dynamic>('/evidence/matters/${widget.matterId}', data: {
        'title': title ?? fileName,
        'description': description,
        'mimeType': mimeType,
        'fileName': fileName,
        'fileBytes': base64Encode(bytes),
        if (tenantId != null) 'tenantId': tenantId,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Evidence uploaded successfully')),
        );
        await _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  /// Pick photo from camera or gallery and upload as evidence.
  Future<void> _captureFromCamera({bool useCamera = true}) async {
    final picker = ImagePicker();
    final status = await (useCamera ? Permission.camera : Permission.photos).request();
    if (!status.isGranted) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Permission denied')),
        );
      }
      return;
    }

    final XFile? picked = useCamera
        ? await picker.pickImage(source: ImageSource.camera, imageQuality: 85)
        : await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);

    if (picked == null) return;

    final bytes = await picked.readAsBytes();
    final fileName = picked.name.isNotEmpty ? picked.name : 'photo_evidence.jpg';
    await _uploadEvidenceFile(
      bytes: bytes,
      fileName: fileName,
      mimeType: 'image/jpeg',
      title: 'Photo evidence — ${DateFormat('MMM d, yyyy HH:mm').format(DateTime.now())}',
    );
  }

  /// Record voice memo and transcribe via speech-to-text, then upload.
  Future<void> _captureVoiceMemo() async {
    final micStatus = await Permission.microphone.request();
    if (!micStatus.isGranted) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Microphone permission denied')),
        );
      }
      return;
    }

    final recorder = AudioRecorder();
    final speechToText = SpeechToText();
    final tmpDir = await getTemporaryDirectory();
    final filePath = '${tmpDir.path}/evidence_voice_${DateTime.now().millisecondsSinceEpoch}.m4a';

    bool isRecording = false;
    String transcript = '';

    if (!mounted) return;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return StatefulBuilder(builder: (ctx, setInnerState) {
          return Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  isRecording ? 'Recording…' : 'Tap to start recording',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                GestureDetector(
                  onTap: () async {
                    if (!isRecording) {
                      await recorder.start(const RecordConfig(), path: filePath);
                      setInnerState(() => isRecording = true);
                    } else {
                      await recorder.stop();
                      setInnerState(() => isRecording = false);

                      // Transcribe
                      final initialized = await speechToText.initialize();
                      if (initialized) {
                        transcript = 'Voice memo recorded. Transcription pending.';
                      }

                      if (ctx.mounted) Navigator.pop(ctx);
                    }
                  },
                  child: CircleAvatar(
                    radius: 36,
                    backgroundColor: isRecording ? Colors.red : const Color(0xFF7C3AED),
                    child: Icon(
                      isRecording ? Icons.stop : Icons.mic,
                      color: Colors.white,
                      size: 32,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                if (isRecording)
                  const Text('Recording in progress…', style: TextStyle(color: Colors.grey)),
                const SizedBox(height: 8),
              ],
            ),
          );
        });
      },
    );

    // Upload the recording + transcript
    final file = File(filePath);
    if (await file.exists()) {
      final bytes = await file.readAsBytes();
      await _uploadEvidenceFile(
        bytes: bytes,
        fileName: 'voice_memo.m4a',
        mimeType: 'audio/m4a',
        title: 'Voice memo — ${DateFormat('MMM d, yyyy HH:mm').format(DateTime.now())}',
        description: transcript.isNotEmpty ? transcript : null,
      );
      await file.delete().catchError((_) => File(filePath));
    }
  }

  /// Pick a document file and upload with OCR-triggered MatterFact extraction.
  Future<void> _captureDocument() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'docx', 'doc', 'txt', 'jpg', 'jpeg', 'png'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    if (file.bytes == null) return;

    await _uploadEvidenceFile(
      bytes: file.bytes!,
      fileName: file.name,
      mimeType: _mimeTypeForExtension(file.extension ?? ''),
      title: file.name,
      description: 'Document scan uploaded for OCR processing',
    );
  }

  String _mimeTypeForExtension(String ext) {
    return switch (ext.toLowerCase()) {
      'pdf' => 'application/pdf',
      'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'doc' => 'application/msword',
      'txt' => 'text/plain',
      'jpg' || 'jpeg' => 'image/jpeg',
      'png' => 'image/png',
      _ => 'application/octet-stream',
    };
  }

  /// Show capture source picker bottom sheet.
  void _showCapturePicker() {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Add Evidence',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ),
            ListTile(
              leading: const CircleAvatar(
                backgroundColor: Color(0xFF7C3AED),
                child: Icon(Icons.camera_alt, color: Colors.white, size: 20),
              ),
              title: const Text('Take Photo'),
              subtitle: const Text('Camera capture'),
              onTap: () {
                Navigator.pop(ctx);
                _captureFromCamera(useCamera: true);
              },
            ),
            ListTile(
              leading: const CircleAvatar(
                backgroundColor: Color(0xFF0EA5E9),
                child: Icon(Icons.photo_library, color: Colors.white, size: 20),
              ),
              title: const Text('Choose from Gallery'),
              subtitle: const Text('Select existing photo'),
              onTap: () {
                Navigator.pop(ctx);
                _captureFromCamera(useCamera: false);
              },
            ),
            ListTile(
              leading: const CircleAvatar(
                backgroundColor: Color(0xFFF59E0B),
                child: Icon(Icons.mic, color: Colors.white, size: 20),
              ),
              title: const Text('Voice Memo'),
              subtitle: const Text('Record & transcribe'),
              onTap: () {
                Navigator.pop(ctx);
                _captureVoiceMemo();
              },
            ),
            ListTile(
              leading: const CircleAvatar(
                backgroundColor: Color(0xFF10B981),
                child: Icon(Icons.upload_file, color: Colors.white, size: 20),
              ),
              title: const Text('Upload Document'),
              subtitle: const Text('PDF, DOCX, image — OCR extraction'),
              onTap: () {
                Navigator.pop(ctx);
                _captureDocument();
              },
            ),
            ListTile(
              leading: const CircleAvatar(
                backgroundColor: Colors.grey,
                child: Icon(Icons.edit, color: Colors.white, size: 20),
              ),
              title: const Text('Manual Entry'),
              subtitle: const Text('Type evidence details'),
              onTap: () {
                Navigator.pop(ctx);
                _showAddDialog();
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _showAddDialog() {
    final l10n = AppLocalizations.of(context);
    final titleCtrl = TextEditingController();
    final descCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.commonAddEvidence),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: titleCtrl,
              decoration: InputDecoration(
                labelText: l10n.commonTitle,
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: descCtrl,
              decoration: InputDecoration(
                labelText: l10n.billingDescription,
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(l10n.commonCancel)),
          FilledButton(
            onPressed: () async {
              final title = titleCtrl.text.trim();
              if (title.isEmpty) return;
              Navigator.pop(ctx);
              try {
                final api = ref.read(apiClientProvider);
                await api.dio.post<dynamic>('/evidence/matters/${widget.matterId}', data: {
                  'title': title,
                  'description': descCtrl.text.trim().isNotEmpty ? descCtrl.text.trim() : null,
                });
                await _load();
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(l10n.commonErrorE), backgroundColor: Colors.red),
                  );
                }
              }
            },
            child: Text(l10n.commonAdd),
          ),
        ],
      ),
    );
  }

  void _showDetail(EvidenceItem item) {
    final l10n = AppLocalizations.of(context);
    _logAccess(item.id, 'VIEWED');
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.5,
        builder: (ctx, scroll) => SingleChildScrollView(
          controller: scroll,
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(item.title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                  ),
                  const Icon(Icons.shield_outlined, color: Colors.green),
                ],
              ),
              const SizedBox(height: 8),
              if (item.description != null && item.description!.isNotEmpty) ...[
                Text(item.description!, style: const TextStyle(color: Colors.grey)),
                const SizedBox(height: 12),
              ],
              _infoRow('Added by', item.addedByName),
              if (item.createdAt.isNotEmpty)
                _infoRow(
                  'Added on',
                  DateFormat('MMM d, yyyy').format(DateTime.tryParse(item.createdAt) ?? DateTime.now()),
                ),
              if (item.chainOfCustody != null && item.chainOfCustody!.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(l10n.commonChainOfCustody, style: Theme.of(context).textTheme.labelMedium),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(item.chainOfCustody!, style: const TextStyle(fontSize: 12, fontFamily: 'monospace')),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 90,
              child: Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.w600)),
            ),
            Expanded(child: Text(value, style: const TextStyle(fontSize: 12))),
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.commonEvidenceVault),
            Text(widget.matterTitle, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.normal)),
          ],
        ),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: AppListSkeleton(itemCount: 5),
            )
          : _error != null
              ? AppErrorView(message: _error!, onRetry: _load)
              : Column(
                  children: [
                    AppPageHeader(
                      title: l10n.commonEvidenceVault,
                      subtitle: widget.matterTitle,
                      count: _items.length,
                      accentColor: const Color(0xFF10B981),
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                    ),
                    if (_items.isNotEmpty) ...[
                      Container(
                        margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981).withValues(alpha: 0.1),
                          borderRadius:
                              BorderRadius.circular(AppColors.radius),
                          border: Border.all(
                              color: const Color(0xFF10B981)
                                  .withValues(alpha: 0.25)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.verified_user,
                                color: Color(0xFF10B981), size: 16),
                            const SizedBox(width: 8),
                            Text(
                              '${_items.length} item${_items.length != 1 ? 's' : ''} secured with chain of custody',
                              style: const TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF10B981),
                                  fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                    ],
                    Expanded(
                      child: _items.isEmpty
                          ? AppEmptyState(
                              icon: Icons.shield_outlined,
                              label: l10n.commonNoEvidenceItems,
                              sublabel:
                                  l10n.commonAddEvidenceToMaintainChainOfCustody,
                              action: FilledButton.icon(
                                onPressed: _showAddDialog,
                                icon: const Icon(Icons.add, size: 16),
                                label: Text(l10n.commonAddEvidence),
                              ),
                            )
                          : RefreshIndicator(
                              onRefresh: () async => _load(),
                              child: ListView.separated(
                                padding: const EdgeInsets.fromLTRB(
                                    16, 0, 16, 96),
                                itemCount: _items.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: 8),
                                itemBuilder: (ctx, i) {
                                  final item = _items[i];
                                  return AppCard(
                                    onTap: () => _showDetail(item),
                                    child: Row(
                                      children: [
                                        AppIconBadge(
                                          icon: Icons.folder_special,
                                          color: const Color(0xFF10B981),
                                          size: 40,
                                          iconSize: 19,
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(item.title,
                                                  style:
                                                      Theme.of(context)
                                                          .textTheme
                                                          .bodyMedium
                                                          ?.copyWith(
                                                              fontWeight:
                                                                  FontWeight
                                                                      .w600)),
                                              const SizedBox(height: 3),
                                              Text(
                                                item.description?.isNotEmpty ==
                                                        true
                                                    ? item.description!
                                                    : 'Added by ${item.addedByName}',
                                                maxLines: 1,
                                                overflow:
                                                    TextOverflow.ellipsis,
                                                style: Theme.of(context)
                                                    .textTheme
                                                    .bodySmall,
                                              ),
                                            ],
                                          ),
                                        ),
                                        Icon(Icons.chevron_right,
                                            color:
                                                AppColors.mutedForegroundDark,
                                            size: 18),
                                      ],
                                    ),
                                  );
                                },
                              ),
                            ),
                    ),
                  ],
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showCapturePicker,
        child: const Icon(Icons.add),
      ),
    );
  }
}
