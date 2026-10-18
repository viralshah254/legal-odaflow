import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers/app_providers.dart';
import '../features/credits/credits_repository.dart';

/// Auto / Premium model picker, mirroring the web AiModelPicker component.
///
/// Reads the saved preference from [creditWalletProvider] and persists
/// changes via [CreditsRepository.updateAiPreferences].
class AiModelPicker extends ConsumerStatefulWidget {
  const AiModelPicker({
    super.key,
    this.onChanged,
    /// When non-null, the widget is driven externally and won't sync initial
    /// values from the wallet on the first build.
    this.initialMode,
    this.initialPremiumModelId,
    this.compact = false,
  });

  /// Called whenever the mode or model selection changes.
  /// [mode] is `'AUTO'` or `'PREMIUM'`.
  final void Function(String mode, String? premiumModelId)? onChanged;

  final String? initialMode;
  final String? initialPremiumModelId;

  /// When true, omits the Auto/Premium usage progress bars.
  final bool compact;

  @override
  ConsumerState<AiModelPicker> createState() => _AiModelPickerState();
}

class _AiModelPickerState extends ConsumerState<AiModelPicker> {
  String _mode = 'PREMIUM';
  String _premiumModelId = 'gpt-5.6-sol';
  bool _saving = false;
  bool _hydrated = false;

  static const _fallbackModels = <AiModelOption>[
    AiModelOption(modelId: 'gpt-5.6-sol', label: 'GPT-5.6 Sol (Premium)'),
    AiModelOption(modelId: 'gpt-5.6-terra', label: 'GPT-5.6 Terra'),
    AiModelOption(modelId: 'gpt-5.6-luna', label: 'GPT-5.6 Luna'),
  ];

  @override
  void initState() {
    super.initState();
    if (widget.initialMode != null) {
      _mode = widget.initialMode!;
      _hydrated = true;
    }
    if (widget.initialPremiumModelId != null) {
      _premiumModelId = widget.initialPremiumModelId!;
    }
  }

  void _hydrateFromWallet(CreditWalletView wallet) {
    if (_hydrated) return;
    _hydrated = true;
    final serverMode = wallet.aiModelMode?.toUpperCase();
    setState(() {
      // Default to PREMIUM when no preference has been saved yet.
      _mode = (serverMode == 'AUTO' || serverMode == 'PREMIUM') ? serverMode! : 'PREMIUM';
      if (wallet.premiumModelId != null && wallet.premiumModelId!.isNotEmpty) {
        _premiumModelId = wallet.premiumModelId!;
      }
    });
  }

  Future<void> _save({required String mode, required String modelId}) async {
    setState(() => _saving = true);
    try {
      await ref.read(creditsRepositoryProvider).updateAiPreferences(
            modelMode: mode,
            premiumModelId: mode == 'PREMIUM' ? modelId : null,
          );
      ref.invalidate(creditWalletProvider);
    } catch (_) {
      // Non-blocking — keep local state optimistic.
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _setMode(String mode) {
    setState(() => _mode = mode);
    _save(mode: mode, modelId: _premiumModelId);
    widget.onChanged?.call(mode, mode == 'PREMIUM' ? _premiumModelId : null);
  }

  void _setModel(String modelId) {
    setState(() => _premiumModelId = modelId);
    _save(mode: _mode, modelId: modelId);
    widget.onChanged?.call(_mode, modelId);
  }

  @override
  Widget build(BuildContext context) {
    final walletAsync = ref.watch(creditWalletProvider);
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    walletAsync.whenData(_hydrateFromWallet);

    final models = walletAsync.whenOrNull(
          data: (w) => w.availablePremiumModels.isNotEmpty
              ? w.availablePremiumModels
              : _fallbackModels,
        ) ??
        _fallbackModels;

    // Ensure selected model id is valid.
    if (models.every((m) => m.modelId != _premiumModelId)) {
      _premiumModelId = models.first.modelId;
    }

    final activeModel = models.firstWhere(
      (m) => m.modelId == _premiumModelId,
      orElse: () => models.first,
    );

    final autoPercent = walletAsync.whenOrNull(data: (w) => w.autoPercentUsed);
    final premiumPercent =
        walletAsync.whenOrNull(data: (w) => w.premiumPercentUsed);
    final autoModelName =
        walletAsync.whenOrNull(data: (w) => w.autoModelName);
    final balance = walletAsync.whenOrNull(data: (w) => w.balance) ?? 0;
    final msgsLeft = activeModel.estimatedCreditsTypical > 0
        ? balance ~/ activeModel.estimatedCreditsTypical
        : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Usage bars
        if (!widget.compact && (autoPercent != null || premiumPercent != null))
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              children: [
                _usageBar(
                  context,
                  label: 'Auto ${autoPercent ?? 0}%',
                  percent: (autoPercent ?? 0) / 100,
                  color: Colors.blue,
                  icon: Icons.bolt,
                ),
                const SizedBox(width: 12),
                _usageBar(
                  context,
                  label: 'Premium ${premiumPercent ?? 0}%',
                  percent: (premiumPercent ?? 0) / 100,
                  color: Colors.amber,
                  icon: Icons.workspace_premium,
                ),
              ],
            ),
          ),

        // Mode toggle
        Row(
          children: [
            _modeButton(
              context,
              label: 'Auto',
              icon: Icons.bolt,
              selected: _mode == 'AUTO',
              onTap: () => _setMode('AUTO'),
            ),
            const SizedBox(width: 8),
            _modeButton(
              context,
              label: 'Premium',
              icon: Icons.workspace_premium,
              selected: _mode == 'PREMIUM',
              onTap: () => _setMode('PREMIUM'),
            ),
            if (_saving) ...[
              const SizedBox(width: 10),
              SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(
                  strokeWidth: 1.5,
                  color: colorScheme.onSurface.withValues(alpha: 0.4),
                ),
              ),
            ],
          ],
        ),

        // Model selector (Premium only)
        if (_mode == 'PREMIUM') ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              border: Border.all(color: colorScheme.outline.withValues(alpha: 0.5)),
              borderRadius: BorderRadius.circular(8),
              color: colorScheme.surface,
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _premiumModelId,
                isExpanded: true,
                style: textTheme.bodySmall,
                items: models.map((m) {
                  return DropdownMenuItem(
                    value: m.modelId,
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(m.label, style: textTheme.bodySmall),
                        ),
                        const SizedBox(width: 6),
                        _TierChip(tier: m.costTier),
                      ],
                    ),
                  );
                }).toList(),
                onChanged: _saving ? null : (v) => _setModel(v!),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              _TierChip(tier: activeModel.costTier),
              const SizedBox(width: 8),
              if (msgsLeft != null)
                Text(
                  '~$msgsLeft messages remaining',
                  style: textTheme.labelSmall?.copyWith(
                    color: colorScheme.onSurface.withValues(alpha: 0.55),
                  ),
                ),
            ],
          ),
        ],

        // Auto hint
        if (_mode == 'AUTO') ...[
          const SizedBox(height: 6),
          Text(
            autoModelName != null
                ? 'Auto uses the best-value model. Currently: $autoModelName.'
                : 'Auto uses the best-value model for each task.',
            style: textTheme.labelSmall?.copyWith(
              color: colorScheme.onSurface.withValues(alpha: 0.55),
            ),
          ),
        ],
      ],
    );
  }

  Widget _modeButton(
    BuildContext context, {
    required String label,
    required IconData icon,
    required bool selected,
    required VoidCallback onTap,
  }) {
    final colorScheme = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: _saving ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? colorScheme.primary : colorScheme.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: selected
                ? colorScheme.primary
                : colorScheme.outline.withValues(alpha: 0.4),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: selected
                  ? colorScheme.onPrimary
                  : colorScheme.onSurface.withValues(alpha: 0.7),
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: selected
                        ? colorScheme.onPrimary
                        : colorScheme.onSurface.withValues(alpha: 0.7),
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _usageBar(
    BuildContext context, {
    required String label,
    required double percent,
    required Color color,
    required IconData icon,
  }) {
    final colorScheme = Theme.of(context).colorScheme;
    return Expanded(
      child: Row(
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: colorScheme.onSurface.withValues(alpha: 0.6),
                      ),
                ),
                const SizedBox(height: 2),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: percent.clamp(0, 1),
                    minHeight: 4,
                    backgroundColor: colorScheme.outline.withValues(alpha: 0.2),
                    color: color,
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

/// Small colored chip displaying the model cost tier (Fast / Standard / Heavy / Ultra).
class _TierChip extends StatelessWidget {
  const _TierChip({required this.tier});
  final AiModelCostTier? tier;

  @override
  Widget build(BuildContext context) {
    final (label, bg, fg) = switch (tier) {
      AiModelCostTier.fast => ('Fast', const Color(0xFFD1FAE5), const Color(0xFF065F46)),
      AiModelCostTier.standard => ('Standard', const Color(0xFFDBEAFE), const Color(0xFF1E40AF)),
      AiModelCostTier.heavy => ('Heavy', const Color(0xFFFEF3C7), const Color(0xFF92400E)),
      AiModelCostTier.ultra => ('Ultra', const Color(0xFFFEE2E2), const Color(0xFF991B1B)),
      null => ('', Colors.transparent, Colors.transparent),
    };
    if (tier == null) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: fg,
          height: 1.2,
        ),
      ),
    );
  }
}
