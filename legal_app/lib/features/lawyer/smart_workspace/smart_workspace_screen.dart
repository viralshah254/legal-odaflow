import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pdfrx/pdfrx.dart';
import '../../../core/network/smart_workspace_api.dart';
import '../../../core/providers/app_providers.dart';

// ── Providers ──────────────────────────────────────────────────────────────

final _smartWorkspaceApiProvider = Provider<SmartWorkspaceApi>((ref) {
  final client = ref.watch(apiClientProvider);
  return SmartWorkspaceApi(client);
});

final _workspaceProvider =
    FutureProvider.family<SmartWorkspace, String>((ref, matterId) async {
  final api = ref.read(_smartWorkspaceApiProvider);
  return api.getOrCreateForMatter(matterId);
});

final _annotationsProvider =
    FutureProvider.family<List<DocumentAnnotation>, String>((ref, workspaceId) async {
  final api = ref.read(_smartWorkspaceApiProvider);
  return api.listAnnotations(workspaceId);
});

final _canvasNodesProvider =
    FutureProvider.family<List<CanvasNode>, String>((ref, workspaceId) async {
  final api = ref.read(_smartWorkspaceApiProvider);
  return api.listCanvasNodes(workspaceId);
});

// ── Draw mode ──────────────────────────────────────────────────────────────

enum _DrawMode { select, pen, arrow, note }

// ── Ink stroke data ─────────────────────────────────────────────────────────

class _Stroke {
  final List<Offset> points;
  final Color color;
  final double width;
  _Stroke({required this.points, required this.color, required this.width});
}

// ── Main screen ────────────────────────────────────────────────────────────

class SmartWorkspaceScreen extends ConsumerStatefulWidget {
  const SmartWorkspaceScreen({super.key, required this.matterId, this.matterTitle});

  final String matterId;
  final String? matterTitle;

  @override
  ConsumerState<SmartWorkspaceScreen> createState() => _SmartWorkspaceScreenState();
}

class _SmartWorkspaceScreenState extends ConsumerState<SmartWorkspaceScreen>
    with SingleTickerProviderStateMixin {
  String? _activeDocumentId;
  String? _activeDocumentUrl;
  String? _activeDocumentName;
  String? _activeDocumentMime;
  String? _activeDocumentExtractedText;
  late TabController _tabController;

  _DrawMode _drawMode = _DrawMode.select;
  bool _speedDialOpen = false;
  Color _inkColor = const Color(0xFFFF3B5C);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _selectDocument(WorkspaceDoc wd) {
    setState(() {
      _activeDocumentId = wd.documentId;
      _activeDocumentUrl = wd.document.fileUrl;
      _activeDocumentName = wd.document.fileName;
      _activeDocumentMime = wd.document.mimeType;
      _activeDocumentExtractedText = wd.document.extractedText;
    });
    if (MediaQuery.of(context).size.width < 700) {
      _tabController.animateTo(0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final workspaceAsync = ref.watch(_workspaceProvider(widget.matterId));
    final isTablet = MediaQuery.of(context).size.width >= 700;

    return Scaffold(
      backgroundColor: const Color(0xFF0F1117),
      appBar: AppBar(
      backgroundColor: const Color(0xFF0F1117),
      foregroundColor: Colors.white70,
      elevation: 0,
      title: Text(
        widget.matterTitle != null
            ? '${widget.matterTitle} — Workspace'
            : 'Research Workspace',
        style: const TextStyle(fontSize: 15, color: Colors.white70),
      ),
      bottom: isTablet
          ? PreferredSize(
              preferredSize: const Size.fromHeight(1),
              child: Container(height: 1, color: Colors.white.withAlpha(20)),
            )
          : TabBar(
              controller: _tabController,
              indicatorColor: const Color(0xFF6366F1),
              labelColor: Colors.white,
              unselectedLabelColor: Colors.white38,
              tabs: const [
                Tab(text: 'Document', icon: Icon(Icons.picture_as_pdf_outlined, size: 16)),
                Tab(text: 'Canvas', icon: Icon(Icons.sticky_note_2_outlined, size: 16)),
              ],
            ),
        actions: [
          workspaceAsync.when(
            data: (ws) => IconButton(
              icon: const Icon(Icons.add_circle_outline),
              tooltip: 'Add document to workspace',
              color: Colors.white54,
              onPressed: () => _showAddDocDialog(ws),
            ),
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),
        ],
      ),
      body: workspaceAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1))),
        error: (e, _) => Center(
          child: Text('Error: $e', style: const TextStyle(color: Colors.white38)),
        ),
        data: (workspace) => isTablet
            ? _buildTabletLayout(workspace)
            : _buildPhoneLayout(workspace),
      ),
      floatingActionButton: _buildSpeedDial(),
    );
  }

  // ── Speed dial FAB ─────────────────────────────────────────────────────────

  Widget _buildSpeedDial() {
    final modes = [
      (_DrawMode.select, Icons.near_me_outlined, 'Select', Colors.white60),
      (_DrawMode.pen, Icons.draw_outlined, 'Pen', const Color(0xFFFF3B5C)),
      (_DrawMode.arrow, Icons.trending_flat, 'Arrow', const Color(0xFF38BDF8)),
      (_DrawMode.note, Icons.sticky_note_2_outlined, 'Note', const Color(0xFFFCD34D)),
    ];

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        // Sub-buttons
        AnimatedSize(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutBack,
          child: _speedDialOpen
              ? Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: modes.map((item) {
                    final (mode, icon, label, color) = item;
                    final isActive = _drawMode == mode;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // Label pill
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            margin: const EdgeInsets.only(right: 8),
                            decoration: BoxDecoration(
                              color: Colors.black.withAlpha(180),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: Colors.white.withAlpha(20)),
                            ),
                            child: Text(
                              label,
                              style: TextStyle(
                                color: isActive ? color : Colors.white60,
                                fontSize: 12,
                                fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                              ),
                            ),
                          ),
                          // Icon button
                          _GlassButton(
                            icon: icon,
                            color: isActive ? color : Colors.white38,
                            active: isActive,
                            accentColor: color,
                            onPressed: () {
                              setState(() {
                                _drawMode = mode;
                                _speedDialOpen = false;
                              });
                            },
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                )
              : const SizedBox.shrink(),
        ),

        // Ink color row (pen/arrow modes)
        if (_speedDialOpen && (_drawMode == _DrawMode.pen || _drawMode == _DrawMode.arrow)) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: 8, right: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final c in [
                  const Color(0xFFFF3B5C),
                  const Color(0xFFF97316),
                  const Color(0xFF38BDF8),
                  const Color(0xFFA78BFA),
                  const Color(0xFF34D399),
                  Colors.white,
                ])
                  GestureDetector(
                    onTap: () => setState(() => _inkColor = c),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      margin: const EdgeInsets.only(right: 6),
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        color: c,
                        shape: BoxShape.circle,
                        border: _inkColor == c
                            ? Border.all(color: Colors.white, width: 2)
                            : null,
                        boxShadow: _inkColor == c
                            ? [BoxShadow(color: c.withAlpha(120), blurRadius: 8)]
                            : null,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],

        // Main FAB
        _GlassFab(
          icon: _speedDialOpen ? Icons.close : _modeIcon(_drawMode),
          accentColor: _modeColor(_drawMode),
          onPressed: () => setState(() => _speedDialOpen = !_speedDialOpen),
        ),
      ],
    );
  }

  IconData _modeIcon(_DrawMode mode) => switch (mode) {
    _DrawMode.select => Icons.near_me_outlined,
    _DrawMode.pen    => Icons.draw_outlined,
    _DrawMode.arrow  => Icons.trending_flat,
    _DrawMode.note   => Icons.sticky_note_2_outlined,
  };

  Color _modeColor(_DrawMode mode) => switch (mode) {
    _DrawMode.select => Colors.white60,
    _DrawMode.pen    => const Color(0xFFFF3B5C),
    _DrawMode.arrow  => const Color(0xFF38BDF8),
    _DrawMode.note   => const Color(0xFFFCD34D),
  };

  // ── Layout builders ────────────────────────────────────────────────────────

  Widget _buildTabletLayout(SmartWorkspace workspace) {
    return Row(
      children: [
        _DocListPanel(
          workspace: workspace,
          activeDocumentId: _activeDocumentId,
          onSelect: _selectDocument,
        ),
        Container(width: 1, color: Colors.white.withAlpha(15)),
        Expanded(
          flex: 3,
          child: _activeDocumentUrl != null
              ? _buildPdfPane(workspace.id)
              : const _EmptyDocPlaceholder(),
        ),
        Container(width: 1, color: Colors.white.withAlpha(15)),
        Expanded(
          flex: 2,
          child: _CanvasPane(
            workspaceId: workspace.id,
            drawMode: _drawMode,
            inkColor: _inkColor,
            onAddNode: (type, x, y, content) async {
              final api = ref.read(_smartWorkspaceApiProvider);
              await api.createCanvasNode(
                workspace.id,
                type: type,
                positionX: x,
                positionY: y,
                content: content,
              );
              ref.invalidate(_canvasNodesProvider(workspace.id));
            },
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneLayout(SmartWorkspace workspace) {
    return Column(
      children: [
        SizedBox(
          height: 48,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            children: workspace.workspaceDocs.map((wd) {
              final active = wd.documentId == _activeDocumentId;
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  backgroundColor: Colors.white.withAlpha(10),
                  selectedColor: const Color(0xFF6366F1).withAlpha(80),
                  labelStyle: TextStyle(
                    color: active ? Colors.white : Colors.white54,
                    fontSize: 12,
                  ),
                  label: Text(wd.document.fileName, overflow: TextOverflow.ellipsis),
                  selected: active,
                  onSelected: (_) => _selectDocument(wd),
                ),
              );
            }).toList(),
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _activeDocumentUrl != null
                  ? _buildPdfPane(workspace.id)
                  : const _EmptyDocPlaceholder(),
              _CanvasPane(
                workspaceId: workspace.id,
                drawMode: _drawMode,
                inkColor: _inkColor,
                onAddNode: (type, x, y, content) async {
                  final api = ref.read(_smartWorkspaceApiProvider);
                  await api.createCanvasNode(
                    workspace.id,
                    type: type,
                    positionX: x,
                    positionY: y,
                    content: content,
                  );
                  ref.invalidate(_canvasNodesProvider(workspace.id));
                },
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPdfPane(String workspaceId) {
    final annotationsAsync = ref.watch(_annotationsProvider(workspaceId));
    final activeDocId = _activeDocumentId;
    final activeDocUrl = _activeDocumentUrl;
    if (activeDocId == null || activeDocUrl == null) {
      return const _EmptyDocPlaceholder();
    }

    final docAnnotations = annotationsAsync.value
            ?.where((a) => a.documentId == activeDocId)
            .toList() ??
        [];

    return Column(
      children: [
        if (_activeDocumentExtractedText?.trim().isEmpty ?? true)
          _OcrBanner(
            documentId: activeDocId,
            fileName: _activeDocumentName ?? '',
            mimeType: _activeDocumentMime,
            onOcrTriggered: () async {
              final api = ref.read(_smartWorkspaceApiProvider);
              await api.triggerOcr(activeDocId);
            },
          ),
        Expanded(
          child: _PdfAnnotationViewer(
            fileUrl: activeDocUrl,
            documentId: activeDocId,
            workspaceId: workspaceId,
            annotations: docAnnotations,
            drawMode: _drawMode,
            inkColor: _inkColor,
            onAnnotationCreated: (_) {
              ref.invalidate(_annotationsProvider(workspaceId));
            },
            onInkSaved: (stroke) async {
              final api = ref.read(_smartWorkspaceApiProvider);
              await api.createAnnotation(
                workspaceId,
                documentId: activeDocId,
                type: 'ink',
                anchor: {'startOffset': 0, 'endOffset': 0, 'quote': ''},
                color: '#FF3B5C',
                content: {
                  'strokes': [
                    {
                      'points': stroke.points.map((p) => [p.dx, p.dy]).toList(),
                      'color': '#FF3B5C',
                      'width': 2.5,
                    }
                  ],
                },
              );
              ref.invalidate(_annotationsProvider(workspaceId));
            },
          ),
        ),
      ],
    );
  }

  void _showAddDocDialog(SmartWorkspace workspace) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: const Color(0xFF1E1B4B),
        content: const Text(
          'Open the document vault to add documents to this workspace.',
          style: TextStyle(color: Colors.white70),
        ),
      ),
    );
  }
}

// ── Glass FAB ──────────────────────────────────────────────────────────────

class _GlassFab extends StatelessWidget {
  const _GlassFab({
    required this.icon,
    required this.accentColor,
    required this.onPressed,
  });

  final IconData icon;
  final Color accentColor;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
          child: Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: accentColor.withAlpha(30),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: accentColor.withAlpha(80), width: 1),
              boxShadow: [
                BoxShadow(color: accentColor.withAlpha(60), blurRadius: 16, spreadRadius: 1),
              ],
            ),
            child: Icon(icon, color: accentColor, size: 22),
          ),
        ),
      ),
    );
  }
}

class _GlassButton extends StatelessWidget {
  const _GlassButton({
    required this.icon,
    required this.color,
    required this.active,
    required this.accentColor,
    required this.onPressed,
  });

  final IconData icon;
  final Color color;
  final bool active;
  final Color accentColor;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: active ? accentColor.withAlpha(40) : Colors.white.withAlpha(10),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: active ? accentColor.withAlpha(120) : Colors.white.withAlpha(20),
              ),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
        ),
      ),
    );
  }
}

// ── Doc list panel ──────────────────────────────────────────────────────────

class _DocListPanel extends StatelessWidget {
  const _DocListPanel({
    required this.workspace,
    required this.activeDocumentId,
    required this.onSelect,
  });

  final SmartWorkspace workspace;
  final String? activeDocumentId;
  final void Function(WorkspaceDoc) onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 180,
      color: Colors.white.withAlpha(5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
            child: Text(
              'DOCUMENTS',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: Colors.white.withAlpha(70),
                letterSpacing: 1.2,
              ),
            ),
          ),
          Expanded(
            child: workspace.workspaceDocs.isEmpty
                ? Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      'No documents yet.\nTap + to add.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white.withAlpha(60), fontSize: 12),
                    ),
                  )
                : ListView(
                    children: workspace.workspaceDocs.map((wd) {
                      final active = wd.documentId == activeDocumentId;
                      return Material(
                        color: Colors.transparent,
                        child: ListTile(
                          dense: true,
                          selected: active,
                          selectedTileColor: const Color(0xFF6366F1).withAlpha(30),
                          leading: Icon(
                            Icons.picture_as_pdf_outlined,
                            size: 16,
                            color: active ? const Color(0xFF818CF8) : Colors.white38,
                          ),
                          title: Text(
                            wd.document.fileName,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11,
                              color: active ? Colors.white : Colors.white54,
                            ),
                          ),
                          onTap: () => onSelect(wd),
                        ),
                      );
                    }).toList(),
                  ),
          ),
        ],
      ),
    );
  }
}

// ── PDF viewer with annotation + ink overlay ───────────────────────────────

class _PdfAnnotationViewer extends ConsumerStatefulWidget {
  const _PdfAnnotationViewer({
    required this.fileUrl,
    required this.documentId,
    required this.workspaceId,
    required this.annotations,
    required this.drawMode,
    required this.inkColor,
    required this.onAnnotationCreated,
    required this.onInkSaved,
  });

  final String fileUrl;
  final String documentId;
  final String workspaceId;
  final List<DocumentAnnotation> annotations;
  final _DrawMode drawMode;
  final Color inkColor;
  final void Function(DocumentAnnotation) onAnnotationCreated;
  final Future<void> Function(_Stroke) onInkSaved;

  @override
  ConsumerState<_PdfAnnotationViewer> createState() => _PdfAnnotationViewerState();
}

class _PdfAnnotationViewerState extends ConsumerState<_PdfAnnotationViewer> {
  final PdfViewerController _pdfController = PdfViewerController();
  String _selectedText = '';

  // Ink drawing state
  final List<_Stroke> _savedStrokes = [];
  List<Offset> _currentPoints = [];
  bool _isDrawing = false;

  void _handleTextSelection(List<PdfTextRanges> selections) {
    final text = selections.map((r) => r.text).join(' ').trim();
    setState(() => _selectedText = text);
    if (_selectedText.isNotEmpty && widget.drawMode == _DrawMode.select) {
      _showSelectionMenu();
    }
  }

  void _showSelectionMenu() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF1A1B26),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _AiSelectionSheet(
        selectedText: _selectedText,
        documentId: widget.documentId,
        workspaceId: widget.workspaceId,
        onHighlight: (color) async {
          final api = ref.read(_smartWorkspaceApiProvider);
          final ann = await api.createAnnotation(
            widget.workspaceId,
            documentId: widget.documentId,
            type: 'highlight',
            anchor: {
              'startOffset': 0,
              'endOffset': _selectedText.length,
              'quote': _selectedText,
            },
            color: color,
          );
          widget.onAnnotationCreated(ann);
          if (ctx.mounted) Navigator.pop(ctx);
        },
        onExtractToCanvas: (color) async {
          final api = ref.read(_smartWorkspaceApiProvider);
          final ann = await api.createAnnotation(
            widget.workspaceId,
            documentId: widget.documentId,
            type: 'excerpt',
            anchor: {
              'startOffset': 0,
              'endOffset': _selectedText.length,
              'quote': _selectedText,
            },
            color: color,
          );
          await api.extractToCanvas(widget.workspaceId, ann.id);
          widget.onAnnotationCreated(ann);
          if (ctx.mounted) Navigator.pop(ctx);
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                backgroundColor: const Color(0xFF1E1B4B),
                content: const Text('Added to canvas.', style: TextStyle(color: Colors.white70)),
              ),
            );
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final inDrawMode = widget.drawMode == _DrawMode.pen || widget.drawMode == _DrawMode.arrow;

    return Stack(
      children: [
        // PDF viewer (pointer events disabled in draw mode so ink overlay gets them)
        IgnorePointer(
          ignoring: inDrawMode,
          child: PdfViewer.uri(
            Uri.parse(widget.fileUrl),
            controller: _pdfController,
            params: PdfViewerParams(
              enableTextSelection: !inDrawMode,
              onTextSelectionChange: _handleTextSelection,
              pagePaintCallbacks: [_paintAnnotations],
            ),
          ),
        ),

        // Ink drawing overlay
        if (inDrawMode)
          Positioned.fill(
            child: GestureDetector(
              onPanStart: (d) {
                setState(() {
                  _isDrawing = true;
                  _currentPoints = [d.localPosition];
                });
              },
              onPanUpdate: (d) {
                if (_isDrawing) {
                  setState(() => _currentPoints.add(d.localPosition));
                }
              },
              onPanEnd: (_) async {
                if (_currentPoints.length > 2) {
                  final stroke = _Stroke(
                    points: List.from(_currentPoints),
                    color: widget.inkColor,
                    width: 2.5,
                  );
                  setState(() {
                    _savedStrokes.add(stroke);
                    _currentPoints = [];
                    _isDrawing = false;
                  });
                  await widget.onInkSaved(stroke);
                } else {
                  setState(() {
                    _currentPoints = [];
                    _isDrawing = false;
                  });
                }
              },
              child: CustomPaint(
                painter: _InkPainter(
                  savedStrokes: _savedStrokes,
                  livePoints: _currentPoints,
                  liveColor: widget.inkColor,
                ),
                size: Size.infinite,
              ),
            ),
          ),

        // Draw mode indicator badge
        if (inDrawMode)
          Positioned(
            top: 12,
            left: 0,
            right: 0,
            child: Center(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.black.withAlpha(160),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: widget.inkColor.withAlpha(120)),
                    ),
                    child: Text(
                      widget.drawMode == _DrawMode.pen ? '✏  Draw mode — drag to ink' : '↗  Arrow mode — drag to draw',
                      style: TextStyle(color: widget.inkColor, fontSize: 12),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  void _paintAnnotations(Canvas canvas, Rect pageRect, PdfPage page) {
    final pageAnnotations = widget.annotations
        .where((a) => a.anchor['page'] == page.pageNumber)
        .toList();

    for (final ann in pageAnnotations) {
      final bbox = ann.anchor['bbox'] as Map<String, dynamic>?;
      if (bbox != null) {
        final x = (bbox['x'] as num).toDouble();
        final y = (bbox['y'] as num).toDouble();
        final w = (bbox['width'] as num).toDouble();
        final h = (bbox['height'] as num).toDouble();

        final color = _hexToColor(ann.color);

        // Glow shadow
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(
              pageRect.left + x * pageRect.width - 2,
              pageRect.top + y * pageRect.height - 2,
              w * pageRect.width + 4,
              h * pageRect.height + 4,
            ),
            const Radius.circular(4),
          ),
          Paint()
            ..color = color.withAlpha(40)
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
        );

        // Highlight fill
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(
              pageRect.left + x * pageRect.width,
              pageRect.top + y * pageRect.height,
              w * pageRect.width,
              h * pageRect.height,
            ),
            const Radius.circular(2),
          ),
          Paint()
            ..color = color.withAlpha(80)
            ..style = PaintingStyle.fill,
        );

        // Anchor dot on right edge
        canvas.drawCircle(
          Offset(
            pageRect.left + (x + w) * pageRect.width,
            pageRect.top + (y + h / 2) * pageRect.height,
          ),
          5,
          Paint()..color = color.withAlpha(200),
        );
      }
    }
  }

  Color _hexToColor(String hex) {
    final h = hex.replaceAll('#', '');
    final value = int.tryParse(h, radix: 16) ?? 0xFDE68A;
    return Color(0xFF000000 | value);
  }
}

// ── Ink painter ────────────────────────────────────────────────────────────

class _InkPainter extends CustomPainter {
  _InkPainter({
    required this.savedStrokes,
    required this.livePoints,
    required this.liveColor,
  });

  final List<_Stroke> savedStrokes;
  final List<Offset> livePoints;
  final Color liveColor;

  @override
  void paint(Canvas canvas, Size size) {
    // Draw saved strokes
    for (final stroke in savedStrokes) {
      _drawStroke(canvas, stroke.points, stroke.color, stroke.width);
    }
    // Draw live stroke
    if (livePoints.length > 1) {
      _drawStroke(canvas, livePoints, liveColor, 2.5, glowing: true);
    }
  }

  void _drawStroke(Canvas canvas, List<Offset> points, Color color, double width, {bool glowing = false}) {
    if (points.isEmpty) return;

    final paint = Paint()
      ..color = color
      ..strokeWidth = width
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    if (glowing) {
      // Glow layer
      canvas.drawPath(
        _buildSmoothPath(points),
        Paint()
          ..color = color.withAlpha(80)
          ..strokeWidth = width * 3
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..style = PaintingStyle.stroke
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
      );
    }

    canvas.drawPath(_buildSmoothPath(points), paint);
  }

  Path _buildSmoothPath(List<Offset> pts) {
    final path = Path();
    if (pts.isEmpty) return path;
    path.moveTo(pts[0].dx, pts[0].dy);
    for (int i = 1; i < pts.length - 1; i++) {
      final mx = (pts[i].dx + pts[i + 1].dx) / 2;
      final my = (pts[i].dy + pts[i + 1].dy) / 2;
      path.quadraticBezierTo(pts[i].dx, pts[i].dy, mx, my);
    }
    if (pts.length > 1) {
      path.lineTo(pts.last.dx, pts.last.dy);
    }
    return path;
  }

  @override
  bool shouldRepaint(_InkPainter old) =>
      old.livePoints != livePoints || old.savedStrokes != savedStrokes;
}

// ── Canvas pane ────────────────────────────────────────────────────────────

class _CanvasPane extends ConsumerStatefulWidget {
  const _CanvasPane({
    required this.workspaceId,
    required this.drawMode,
    required this.inkColor,
    required this.onAddNode,
  });

  final String workspaceId;
  final _DrawMode drawMode;
  final Color inkColor;
  final Future<void> Function(String type, double x, double y, Map<String, dynamic> content) onAddNode;

  @override
  ConsumerState<_CanvasPane> createState() => _CanvasPaneState();
}

class _CanvasPaneState extends ConsumerState<_CanvasPane> {
  final TransformationController _transformController = TransformationController();

  @override
  void dispose() {
    _transformController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final nodesAsync = ref.watch(_canvasNodesProvider(widget.workspaceId));

    return Container(
      color: const Color(0xFF0F1117),
      child: nodesAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: Color(0xFF6366F1)),
        ),
        error: (e, _) => Center(
          child: Text('Error: $e', style: const TextStyle(color: Colors.white38)),
        ),
        data: (nodes) => nodes.isEmpty
            ? _buildEmptyState()
            : InteractiveViewer(
                transformationController: _transformController,
                boundaryMargin: const EdgeInsets.all(400),
                minScale: 0.2,
                maxScale: 3.0,
                child: SizedBox(
                  width: 1600,
                  height: 1600,
                  child: Stack(
                    children: [
                      // Dot grid background
                      CustomPaint(
                        painter: _DotGridPainter(),
                        size: const Size(1600, 1600),
                      ),
                      ...nodes.map(
                        (node) => _CanvasNodeCard(
                          node: node,
                          workspaceId: widget.workspaceId,
                          drawMode: widget.drawMode,
                          onChanged: () => ref.invalidate(
                            _canvasNodesProvider(widget.workspaceId),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Ghost cards
          SizedBox(
            width: 240,
            height: 160,
            child: Stack(
              children: [
                _ghostCard(left: 0, top: 20, w: 120, h: 70, accentColor: const Color(0xFFFCD34D)),
                _ghostCard(left: 100, top: 60, w: 110, h: 60, accentColor: const Color(0xFF38BDF8)),
                _ghostCard(left: 40, top: 100, w: 130, h: 50, accentColor: const Color(0xFFA78BFA)),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Select text in the PDF → it lands here',
            style: TextStyle(color: Colors.white.withAlpha(60), fontSize: 13),
          ),
          const SizedBox(height: 4),
          Text(
            'Use the ✏ pen to draw freely',
            style: TextStyle(color: Colors.white.withAlpha(35), fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _ghostCard({
    required double left,
    required double top,
    required double w,
    required double h,
    required Color accentColor,
  }) {
    return Positioned(
      left: left,
      top: top,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
          child: Container(
            width: w,
            height: h,
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(8),
              borderRadius: BorderRadius.circular(10),
              border: Border(
                left: BorderSide(color: accentColor.withAlpha(120), width: 3),
                right: BorderSide(color: Colors.white.withAlpha(15)),
                top: BorderSide(color: Colors.white.withAlpha(15)),
                bottom: BorderSide(color: Colors.white.withAlpha(15)),
              ),
            ),
            padding: const EdgeInsets.all(8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(height: 6, width: w * 0.6, decoration: BoxDecoration(color: accentColor.withAlpha(60), borderRadius: BorderRadius.circular(3))),
                const SizedBox(height: 5),
                Container(height: 4, width: w * 0.9, decoration: BoxDecoration(color: Colors.white.withAlpha(20), borderRadius: BorderRadius.circular(2))),
                const SizedBox(height: 4),
                Container(height: 4, width: w * 0.7, decoration: BoxDecoration(color: Colors.white.withAlpha(15), borderRadius: BorderRadius.circular(2))),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Dot grid painter ───────────────────────────────────────────────────────

class _DotGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withAlpha(15)
      ..style = PaintingStyle.fill;
    const spacing = 28.0;
    for (double x = 0; x < size.width; x += spacing) {
      for (double y = 0; y < size.height; y += spacing) {
        canvas.drawCircle(Offset(x, y), 1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotGridPainter _) => false;
}

// ── Canvas node card (glass style) ────────────────────────────────────────

class _CanvasNodeCard extends ConsumerStatefulWidget {
  const _CanvasNodeCard({
    required this.node,
    required this.workspaceId,
    required this.drawMode,
    required this.onChanged,
  });

  final CanvasNode node;
  final String workspaceId;
  final _DrawMode drawMode;
  final VoidCallback onChanged;

  @override
  ConsumerState<_CanvasNodeCard> createState() => _CanvasNodeCardState();
}

class _CanvasNodeCardState extends ConsumerState<_CanvasNodeCard>
    with SingleTickerProviderStateMixin {
  late double _x;
  late double _y;
  bool _dragging = false;
  late AnimationController _popController;
  late Animation<double> _popAnim;

  @override
  void initState() {
    super.initState();
    _x = widget.node.positionX;
    _y = widget.node.positionY;
    _popController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 360),
    );
    _popAnim = CurvedAnimation(parent: _popController, curve: Curves.elasticOut);
    _popController.forward();
  }

  @override
  void dispose() {
    _popController.dispose();
    super.dispose();
  }

  Color get _accentColor => switch (widget.node.type) {
    'excerpt_card'    => const Color(0xFF38BDF8),
    'timeline'        => const Color(0xFF34D399),
    'research_result' => const Color(0xFFA78BFA),
    _                 => const Color(0xFFFCD34D),
  };

  IconData get _nodeIcon => switch (widget.node.type) {
    'excerpt_card'    => Icons.format_quote,
    'timeline'        => Icons.timeline,
    'research_result' => Icons.auto_awesome,
    _                 => Icons.sticky_note_2_outlined,
  };

  @override
  Widget build(BuildContext context) {
    final content = widget.node.content;
    final accent = _accentColor;

    return Positioned(
      left: _x,
      top: _y,
      child: ScaleTransition(
        scale: _popAnim,
        child: GestureDetector(
          onPanStart: widget.drawMode == _DrawMode.select
              ? (_) => setState(() => _dragging = true)
              : null,
          onPanUpdate: widget.drawMode == _DrawMode.select
              ? (d) => setState(() {
                    _x += d.delta.dx;
                    _y += d.delta.dy;
                  })
              : null,
          onPanEnd: widget.drawMode == _DrawMode.select
              ? (_) => setState(() => _dragging = false)
              : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            transform: Matrix4.identity()
              ..scaleByDouble(_dragging ? 1.04 : 1.0, 1.0, 1.0, 1.0),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
                child: Container(
                  width: widget.node.width.toDouble(),
                  decoration: BoxDecoration(
                    color: Colors.white.withAlpha(10),
                    borderRadius: BorderRadius.circular(14),
                    border: Border(
                      left: BorderSide(color: accent.withAlpha(180), width: 3),
                      right: BorderSide(color: Colors.white.withAlpha(20)),
                      top: BorderSide(color: Colors.white.withAlpha(20)),
                      bottom: BorderSide(color: Colors.white.withAlpha(20)),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: _dragging ? accent.withAlpha(60) : Colors.black.withAlpha(120),
                        blurRadius: _dragging ? 32 : 16,
                        spreadRadius: _dragging ? 2 : 0,
                      ),
                    ],
                  ),
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Header
                      Row(
                        children: [
                          Icon(_nodeIcon, size: 10, color: accent.withAlpha(200)),
                          const SizedBox(width: 4),
                          Text(
                            widget.node.type.replaceAll('_', ' ').toUpperCase(),
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              color: accent.withAlpha(180),
                              letterSpacing: 1,
                            ),
                          ),
                          const Spacer(),
                          GestureDetector(
                            onTap: () async {
                              final api = ref.read(_smartWorkspaceApiProvider);
                              await api.deleteCanvasNode(widget.workspaceId, widget.node.id);
                              widget.onChanged();
                            },
                            child: Icon(Icons.close, size: 12, color: Colors.white.withAlpha(60)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      // Content
                      if (widget.node.type == 'excerpt_card')
                        Text(
                          '"${content['quote'] ?? ''}"',
                          style: TextStyle(
                            fontSize: 11,
                            fontStyle: FontStyle.italic,
                            color: Colors.white.withAlpha(180),
                            height: 1.5,
                          ),
                          maxLines: 5,
                          overflow: TextOverflow.ellipsis,
                        )
                      else
                        Text(
                          (content['text'] as String?) ??
                              (content['summary'] as String?) ??
                              '',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.white.withAlpha(160),
                            height: 1.5,
                          ),
                          maxLines: 6,
                          overflow: TextOverflow.ellipsis,
                        ),
                      // Source pill for excerpts
                      if (widget.node.type == 'excerpt_card' && content['source'] != null) ...[
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.white.withAlpha(12),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: Colors.white.withAlpha(20)),
                          ),
                          child: Text(
                            '📄 ${content['source']}',
                            style: TextStyle(fontSize: 9, color: Colors.white.withAlpha(80)),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── AI selection sheet ─────────────────────────────────────────────────────

class _AiSelectionSheet extends StatelessWidget {
  const _AiSelectionSheet({
    required this.selectedText,
    required this.documentId,
    required this.workspaceId,
    required this.onHighlight,
    required this.onExtractToCanvas,
  });

  final String selectedText;
  final String documentId;
  final String workspaceId;
  final void Function(String color) onHighlight;
  final void Function(String color) onExtractToCanvas;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 3,
            margin: const EdgeInsets.only(bottom: 16, left: 0),
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(30),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Text(
            '"${selectedText.length > 120 ? '${selectedText.substring(0, 120)}…' : selectedText}"',
            style: const TextStyle(
              fontStyle: FontStyle.italic,
              fontSize: 13,
              color: Colors.white70,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Actions',
            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white60, fontSize: 12),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _ActionButton(
                icon: Icons.highlight,
                label: 'Highlight',
                color: const Color(0xFFFCD34D),
                onTap: () => onHighlight('#FDE68A'),
              ),
              _ActionButton(
                icon: Icons.add_to_photos_outlined,
                label: 'Add to Canvas',
                color: const Color(0xFF38BDF8),
                onTap: () => onExtractToCanvas('#BAE6FD'),
              ),
            ],
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: color.withAlpha(25),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withAlpha(80)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: color),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }
}

// ── OCR banner ─────────────────────────────────────────────────────────────

class _OcrBanner extends StatefulWidget {
  const _OcrBanner({
    required this.documentId,
    required this.fileName,
    this.mimeType,
    required this.onOcrTriggered,
  });

  final String documentId;
  final String fileName;
  final String? mimeType;
  final Future<void> Function() onOcrTriggered;

  @override
  State<_OcrBanner> createState() => _OcrBannerState();
}

class _OcrBannerState extends State<_OcrBanner> {
  bool _dismissed = false;
  bool _running = false;

  bool get _isScanned {
    final mime = widget.mimeType ?? '';
    return mime.contains('pdf') || mime.contains('image');
  }

  @override
  Widget build(BuildContext context) {
    if (_dismissed || !_isScanned) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.fromLTRB(8, 8, 8, 0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7).withAlpha(30),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFFBBF24).withAlpha(120)),
      ),
      child: Row(
        children: [
          const Icon(Icons.document_scanner_outlined, size: 16, color: Color(0xFFFBBF24)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _running ? 'Running OCR…' : 'Scanned document — run OCR to enable AI analysis',
              style: const TextStyle(fontSize: 11, color: Color(0xFFFBBF24)),
            ),
          ),
          if (!_running) ...[
            TextButton(
              onPressed: () async {
                setState(() => _running = true);
                await widget.onOcrTriggered();
                setState(() => _dismissed = true);
              },
              child: const Text('Run OCR', style: TextStyle(fontSize: 11, color: Color(0xFFFBBF24))),
            ),
            GestureDetector(
              onTap: () => setState(() => _dismissed = true),
              child: const Icon(Icons.close, size: 14, color: Color(0xFFFBBF24)),
            ),
          ] else
            const SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFFBBF24)),
            ),
        ],
      ),
    );
  }
}

// ── Empty placeholder ──────────────────────────────────────────────────────

class _EmptyDocPlaceholder extends StatelessWidget {
  const _EmptyDocPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.picture_as_pdf_outlined, size: 48, color: Colors.white12),
          SizedBox(height: 8),
          Text(
            'Select a document\nfrom the sidebar',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white24, fontSize: 13),
          ),
        ],
      ),
    );
  }
}
