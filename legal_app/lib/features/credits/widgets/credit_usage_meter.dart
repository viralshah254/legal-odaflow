import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/app_config.dart';
import '../../../core/pricing/local_pricing.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../consumer/subscription/payment_checkout_screen.dart';
import '../credits_repository.dart';

class CreditUsageMeter extends ConsumerWidget {
  const CreditUsageMeter({
    super.key,
    this.compact = false,
    this.readOnly = false,
    this.manageOnWebPath = '/app/settings/plan-usage',
  });

  final bool compact;
  final bool readOnly;
  final String manageOnWebPath;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final walletAsync = ref.watch(creditWalletProvider);

    return walletAsync.when(
      loading: () => compact
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : const Card(
              child: Padding(
                padding: EdgeInsets.all(20),
                child: Center(child: CircularProgressIndicator()),
              ),
            ),
      error: (_, __) => compact
          ? const SizedBox.shrink()
          : Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(l10n.commonUnableToLoadAiUsage,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            ),
      data: (wallet) {
        if (compact) {
          return _CompactUsageBadge(wallet: wallet, readOnly: readOnly);
        }
        return _UsageCard(
          wallet: wallet,
          readOnly: readOnly,
          manageOnWebPath: manageOnWebPath,
        );
      },
    );
  }
}

class InsufficientCreditsCta extends ConsumerWidget {
  const InsufficientCreditsCta({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final lower = message.toLowerCase();
    if (!lower.contains('credit') && !lower.contains('subscribe')) {
      return Text(
        message,
        style: const TextStyle(color: AppColors.destructiveLight),
      );
    }

    final isDailyExhaustion =
        lower.contains('daily') || lower.contains('subscribe');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          message,
          style: const TextStyle(color: AppColors.destructiveLight),
        ),
        const SizedBox(height: 12),
        if (AppConfig.enableInAppPurchasing) ...[
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilledButton(
                onPressed: () => context.go('/consumer/subscription'),
                style: FilledButton.styleFrom(
                  backgroundColor:
                      isDailyExhaustion ? AppColors.destructiveLight : null,
                  visualDensity: VisualDensity.compact,
                ),
                child: Text(
                  isDailyExhaustion
                      ? l10n.commonSubscribeNow
                      : l10n.commonAddAiBudget,
                ),
              ),
              TextButton(
                onPressed: () => ref.invalidate(creditWalletProvider),
                child: Text(l10n.commonRefresh),
              ),
            ],
          ),
        ] else ...[
          _WebOnlyNoticeBanner(message: l10n.mobileCreditsExhaustedWebOnly),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: () => ref.invalidate(creditWalletProvider),
              child: Text(l10n.commonRefresh),
            ),
          ),
        ],
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Compact badge — shown in AppBar or tight spaces
// ---------------------------------------------------------------------------

class _CompactUsageBadge extends StatelessWidget {
  const _CompactUsageBadge({required this.wallet, required this.readOnly});

  final CreditWalletView wallet;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    final isLow = wallet.isLow;
    final background = isLow
        ? AppColors.destructiveLight.withValues(alpha: 0.12)
        : colorScheme.primary.withValues(alpha: 0.12);
    final foreground = isLow ? AppColors.destructiveLight : colorScheme.primary;
    final modeLabel =
        wallet.isPremiumMode ? l10n.commonPremium : l10n.commonAuto;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppColors.radius),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            wallet.isPremiumMode ? Icons.workspace_premium : Icons.bolt,
            size: 14,
            color: foreground,
          ),
          const SizedBox(width: 6),
          Text(
            readOnly
                ? '$modeLabel · ${wallet.percentUsed}% used'
                : '${wallet.percentUsed}% · $modeLabel',
            style: TextStyle(
              color: foreground,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Full usage card (ConsumerStatefulWidget for model-preference updates)
// ---------------------------------------------------------------------------

class _UsageCard extends ConsumerStatefulWidget {
  const _UsageCard({
    required this.wallet,
    required this.readOnly,
    required this.manageOnWebPath,
  });

  final CreditWalletView wallet;
  final bool readOnly;
  final String manageOnWebPath;

  @override
  ConsumerState<_UsageCard> createState() => _UsageCardState();
}

class _UsageCardState extends ConsumerState<_UsageCard> {
  bool _updatingModel = false;

  Future<void> _setModelMode(String modelMode, {String? premiumModelId}) async {
    if (_updatingModel) return;
    setState(() => _updatingModel = true);
    try {
      await ref.read(creditsRepositoryProvider).updateAiPreferences(
            modelMode: modelMode,
            premiumModelId: premiumModelId,
          );
      ref.invalidate(creditWalletProvider);
    } catch (_) {
      // Silently ignore; UI will reflect current state on next load.
    } finally {
      if (mounted) setState(() => _updatingModel = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final wallet = widget.wallet;
    final colorScheme = Theme.of(context).colorScheme;
    final resetLabel = _formatResetDate(wallet.cycleEndAt);
    final currency = wallet.currency ?? 'USD';
    final isFree = wallet.isFreeOrMinimal;

    // Budget label: "KES 7,350 / mo AI budget" — hidden for free plan
    final budgetLocal = (!isFree && wallet.aiBudgetUsd > 0)
        ? formatPlanPrice(
            convertUsdToLocal(wallet.aiBudgetUsd, currency),
            currency,
          )
        : null;

    final hasAutoSplit = wallet.autoPercentUsed != null;
    final autoPct = (wallet.autoPercentUsed ?? wallet.percentUsed).clamp(0, 100);
    final premiumPct = (wallet.premiumPercentUsed ?? 0).clamp(0, 100);

    final overallPct = wallet.percentUsed.clamp(0, 100);
    final showCta = wallet.isLow && !widget.readOnly;
    final hasPremiumModels = wallet.availablePremiumModels.isNotEmpty;

    return Card(
      shape: RoundedRectangleBorder(
        side: BorderSide(
          color: wallet.isLow
              ? AppColors.destructiveLight.withValues(alpha: 0.5)
              : colorScheme.outline.withValues(alpha: 0.2),
        ),
        borderRadius: BorderRadius.circular(AppColors.radius),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(
              children: [
                Icon(Icons.auto_awesome, color: colorScheme.primary, size: 20),
                const SizedBox(width: 8),
                Text(l10n.commonAiUsage,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(width: 8),
                _ModeChip(
                  isPremium: wallet.isPremiumMode,
                  premiumModelId: wallet.premiumModelId,
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Free plan: daily credits section
            if (isFree) ...[
              _FreeDailyCreditsSection(
                wallet: wallet,
                readOnly: widget.readOnly,
              ),
            ] else ...[
              // Large usage percentage
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(l10n.commonUsagePercent('$overallPct'),
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: wallet.isLow
                              ? AppColors.destructiveLight
                              : colorScheme.onSurface,
                        ),
                  ),
                  const SizedBox(width: 8),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(l10n.commonUsed,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                    ),
                  ),
                ],
              ),

              // Budget + reset line
              if (budgetLocal != null) ...[
                const SizedBox(height: 2),
                Text(l10n.commonBudgetCycleSuffix(budgetLocal),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                ),
              ],
              if (resetLabel != null) ...[
                const SizedBox(height: 2),
                Text(l10n.commonResetsOn(resetLabel),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.mutedForegroundLight,
                      ),
                ),
              ],

              const SizedBox(height: 14),

              // Usage bars
              if (hasAutoSplit) ...[
                _UsageBar(
                  label: l10n.commonAuto,
                  percent: autoPct / 100,
                  color: colorScheme.primary,
                  labelColor: colorScheme.onSurfaceVariant,
                  value: '$autoPct%',
                ),
                const SizedBox(height: 8),
                _UsageBar(
                  label: l10n.commonPremium,
                  percent: premiumPct / 100,
                  color: Colors.amber.shade600,
                  labelColor: colorScheme.onSurfaceVariant,
                  value: '$premiumPct%',
                ),
                if (wallet.premiumAllowanceCredits != null &&
                    wallet.premiumAllowanceRemaining != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    l10n.commonPremiumAllowanceLine(
                      '${wallet.premiumCreditsUsedThisCycle ?? (wallet.premiumAllowanceCredits! - wallet.premiumAllowanceRemaining!)}',
                      '${wallet.premiumAllowanceCredits}',
                      '${wallet.premiumAllowanceRemaining}',
                    ),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                  ),
                ],
              ] else ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: LinearProgressIndicator(
                    value: overallPct / 100,
                    minHeight: 8,
                    backgroundColor: colorScheme.primary.withValues(alpha: 0.12),
                    color: wallet.isLow
                        ? AppColors.destructiveLight
                        : colorScheme.primary,
                  ),
                ),
              ],

              // Model selector — two-step: Auto/Premium toggle then model picker
              if (!widget.readOnly && hasPremiumModels) ...[
                const SizedBox(height: 14),
                Text(l10n.commonAiModel,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.5,
                      ),
                ),
                const SizedBox(height: 8),
                // Step 1: Auto / Premium mode toggle
                Row(
                  children: [
                    Expanded(
                      child: _ModeToggleButton(
                        label: l10n.commonAuto,
                        subtitle: wallet.autoModelName,
                        icon: Icons.bolt,
                        isSelected: !wallet.isPremiumMode,
                        isLoading: _updatingModel && !wallet.isPremiumMode,
                        onTap: () => _setModelMode('AUTO'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _ModeToggleButton(
                        label: l10n.commonPremium,
                        subtitle: wallet.isPremiumMode
                            ? wallet.premiumModelId
                            : null,
                        icon: Icons.workspace_premium,
                        premiumStyle: true,
                        isSelected: wallet.isPremiumMode,
                        isLoading: _updatingModel && wallet.isPremiumMode,
                        onTap: () {
                          // Switch to PREMIUM with currently-set model or first available
                          final modelId = wallet.premiumModelId?.isNotEmpty == true
                              ? wallet.premiumModelId!
                              : wallet.availablePremiumModels.first.modelId;
                          _setModelMode('PREMIUM', premiumModelId: modelId);
                        },
                      ),
                    ),
                  ],
                ),
                // Step 2: Model picker (only visible in Premium mode)
                if (wallet.isPremiumMode) ...[
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: wallet.availablePremiumModels.map((model) {
                      final isActive = wallet.premiumModelId == model.modelId;
                      final tierLabel = switch (model.costTier) {
                        AiModelCostTier.fast => 'Fast',
                        AiModelCostTier.standard => 'Standard',
                        AiModelCostTier.heavy => 'Heavy',
                        AiModelCostTier.ultra => 'Ultra',
                        null => '',
                      };
                      return _SelectableModelChip(
                        label: model.label,
                        subtitle: tierLabel,
                        icon: Icons.smart_toy_outlined,
                        isSelected: isActive,
                        isLoading: _updatingModel && isActive,
                        onTap: () => _setModelMode(
                          'PREMIUM',
                          premiumModelId: model.modelId,
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ],

              // CTAs — only when budget is nearly exhausted (< 10% remaining)
              if (showCta) ...[
                const SizedBox(height: 16),
                if (AppConfig.enableInAppPurchasing) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.destructiveLight.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(AppColors.radius),
                      border: Border.all(
                        color: AppColors.destructiveLight.withValues(alpha: 0.25),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l10n.commonAlmostOutOfAiBudget,
                          style:
                              Theme.of(context).textTheme.labelMedium?.copyWith(
                                    color: AppColors.destructiveLight,
                                    fontWeight: FontWeight.w600,
                                  ),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            FilledButton(
                              style: FilledButton.styleFrom(
                                backgroundColor: AppColors.destructiveLight,
                                foregroundColor: Colors.white,
                                visualDensity: VisualDensity.compact,
                              ),
                              onPressed: () =>
                                  context.go('/consumer/subscription'),
                              child: Text(l10n.commonAddAiBudget),
                            ),
                            OutlinedButton(
                              style: OutlinedButton.styleFrom(
                                visualDensity: VisualDensity.compact,
                              ),
                              onPressed: () =>
                                  context.go('/consumer/subscription'),
                              child: Text(l10n.commonViewPlans),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ] else ...[
                  _WebOnlyNoticeBanner(
                    message: l10n.mobileCreditsExhaustedWebOnly,
                  ),
                ],
              ],
            ],

            // Read-only: web link to full usage dashboard (only when in-app purchasing is available)
            if (widget.readOnly && AppConfig.enableInAppPurchasing) ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () =>
                    _openManageOnWeb(context, widget.manageOnWebPath),
                icon: const Icon(Icons.open_in_browser, size: 18),
                label: Text(l10n.commonPlanUsageOnWeb),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String? _formatResetDate(DateTime? cycleEndAt) {
    if (cycleEndAt == null) return null;
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    final local = cycleEndAt.toLocal();
    return '${months[local.month - 1]} ${local.day}';
  }
}

// ---------------------------------------------------------------------------
// Daily free credits section — shown when user is on the free plan
// ---------------------------------------------------------------------------

class _FreeDailyCreditsSection extends StatelessWidget {
  const _FreeDailyCreditsSection({
    required this.wallet,
    required this.readOnly,
  });

  final CreditWalletView wallet;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    final isExhausted = wallet.balance <= 0;
    final daily = wallet.planCreditsMonthly > 0 ? wallet.planCreditsMonthly : 5;
    final remaining = wallet.balance.clamp(0, daily);
    final progress = daily > 0 ? remaining / daily : 0.0;

    final containerColor = isExhausted
        ? AppColors.destructiveLight.withValues(alpha: 0.07)
        : colorScheme.primary.withValues(alpha: 0.06);
    final borderColor = isExhausted
        ? AppColors.destructiveLight.withValues(alpha: 0.30)
        : colorScheme.primary.withValues(alpha: 0.15);
    final accentColor =
        isExhausted ? AppColors.destructiveLight : colorScheme.primary;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: containerColor,
        borderRadius: BorderRadius.circular(AppColors.radius),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row: icon + label + credit count
          Row(
            children: [
              Icon(
                isExhausted ? Icons.hourglass_empty : Icons.bolt,
                size: 16,
                color: accentColor,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  isExhausted
                      ? l10n.creditsFreeDailyExhausted
                      : l10n.creditsFreeDailyTitle,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: accentColor,
                      ),
                ),
              ),
              Text(
                '$remaining / $daily',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: accentColor,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Progress bar
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress.toDouble(),
              minHeight: 6,
              backgroundColor: accentColor.withValues(alpha: 0.15),
              valueColor: AlwaysStoppedAnimation<Color>(accentColor),
            ),
          ),
          const SizedBox(height: 8),

          // Sub-label
          Text(
            isExhausted
                ? l10n.creditsFreeDailyExhaustedSubtitle
                : l10n.creditsFreeDailySubtitle,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
          ),

          if (!readOnly) ...[
            const SizedBox(height: 12),
            if (AppConfig.enableInAppPurchasing) ...[
              Row(
                children: [
                  FilledButton(
                    onPressed: () => context.go('/consumer/subscription'),
                    style: FilledButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                      backgroundColor:
                          isExhausted ? AppColors.destructiveLight : null,
                    ),
                    child: Text(l10n.commonSubscribeNow),
                  ),
                  if (!isExhausted) ...[
                    const SizedBox(width: 8),
                    TextButton(
                      onPressed: () => context.go('/consumer/subscription'),
                      style: TextButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                      ),
                      child: Text(l10n.commonViewPlans),
                    ),
                  ],
                ],
              ),
            ] else ...[
              _WebOnlyNoticeBanner(
                message: l10n.mobileCreditsExhaustedWebOnly,
              ),
            ],
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Mode toggle button — large Auto / Premium segment
// ---------------------------------------------------------------------------

class _ModeToggleButton extends StatelessWidget {
  const _ModeToggleButton({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.isLoading,
    required this.onTap,
    this.subtitle,
    this.premiumStyle = false,
  });

  final String label;
  final IconData icon;
  final bool isSelected;
  final bool isLoading;
  final VoidCallback onTap;
  final String? subtitle;
  final bool premiumStyle;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isPremiumButton = premiumStyle;
    final selectedBg = isPremiumButton
        ? Colors.amber.shade600.withValues(alpha: 0.12)
        : colorScheme.primary.withValues(alpha: 0.12);
    final selectedFg =
        isPremiumButton ? Colors.amber.shade700 : colorScheme.primary;
    final selectedBorder = isPremiumButton
        ? Colors.amber.shade600.withValues(alpha: 0.5)
        : colorScheme.primary.withValues(alpha: 0.4);

    final bg = isSelected
        ? selectedBg
        : colorScheme.surfaceContainerHighest.withValues(alpha: 0.4);
    final fg = isSelected ? selectedFg : colorScheme.onSurfaceVariant;
    final border = isSelected
        ? selectedBorder
        : colorScheme.outline.withValues(alpha: 0.15);

    return GestureDetector(
      onTap: isSelected ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: border, width: isSelected ? 1.5 : 1),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (isLoading)
              SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(strokeWidth: 1.5, color: fg),
              )
            else
              Icon(icon, size: 14, color: fg),
            const SizedBox(width: 6),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight:
                          isSelected ? FontWeight.w700 : FontWeight.w500,
                      color: fg,
                    ),
                  ),
                  if (subtitle != null && subtitle!.isNotEmpty) ...[
                    Text(
                      subtitle!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 10,
                        color: fg.withValues(alpha: 0.7),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Selectable model chip — tappable with active state and optional cost label
// ---------------------------------------------------------------------------

class _SelectableModelChip extends StatelessWidget {
  const _SelectableModelChip({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.isLoading,
    required this.onTap,
    this.subtitle,
  });

  final String label;
  final IconData icon;
  final bool isSelected;
  final bool isLoading;
  final VoidCallback onTap;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final bg = isSelected
        ? colorScheme.primary.withValues(alpha: 0.12)
        : colorScheme.surfaceContainerHighest.withValues(alpha: 0.5);
    final fg = isSelected ? colorScheme.primary : colorScheme.onSurfaceVariant;
    final border = isSelected
        ? colorScheme.primary.withValues(alpha: 0.4)
        : colorScheme.outline.withValues(alpha: 0.2);

    return GestureDetector(
      onTap: isSelected ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: border, width: isSelected ? 1.5 : 1),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isLoading)
              SizedBox(
                width: 12,
                height: 12,
                child: CircularProgressIndicator(
                  strokeWidth: 1.5,
                  color: fg,
                ),
              )
            else
              Icon(icon, size: 12, color: fg),
            const SizedBox(width: 5),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    color: fg,
                  ),
                ),
                if (subtitle != null && subtitle!.isNotEmpty)
                  Text(
                    subtitle!,
                    style: TextStyle(
                      fontSize: 10,
                      color: fg.withValues(alpha: 0.65),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Usage bar row: "Auto   ████████░░░░   54%"
// ---------------------------------------------------------------------------

class _UsageBar extends StatelessWidget {
  const _UsageBar({
    required this.label,
    required this.percent,
    required this.color,
    required this.labelColor,
    required this.value,
  });

  final String label;
  final double percent;
  final Color color;
  final Color labelColor;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox(
          width: 60,
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: labelColor,
                  fontWeight: FontWeight.w500,
                ),
          ),
        ),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: percent.clamp(0.0, 1.0),
              minHeight: 7,
              backgroundColor: color.withValues(alpha: 0.12),
              color: color,
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 34,
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: labelColor,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Mode chip: "Auto" or "GPT-4o" / "Premium"
// ---------------------------------------------------------------------------

class _ModeChip extends StatelessWidget {
  const _ModeChip({required this.isPremium, this.premiumModelId});

  final bool isPremium;
  final String? premiumModelId;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    final label = isPremium
        ? (premiumModelId ?? l10n.commonPremium)
        : l10n.commonAuto;
    final bg = isPremium
        ? Colors.amber.shade600.withValues(alpha: 0.15)
        : colorScheme.primary.withValues(alpha: 0.12);
    final fg = isPremium ? Colors.amber.shade700 : colorScheme.primary;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg),
      ),
    );
  }
}

Future<void> _openManageOnWeb(BuildContext context, String path) {
  final base = AppConfig.webBaseUrl.replaceAll(RegExp(r'/+$'), '');
  final normalizedPath = path.startsWith('/') ? path : '/$path';
  final url = '$base$normalizedPath';
  return openPaymentCheckout(context, checkoutUrl: url, title: 'Plan & usage');
}

// ---------------------------------------------------------------------------
// Shared informational banner for web-only notice
// ---------------------------------------------------------------------------

class _WebOnlyNoticeBanner extends StatelessWidget {
  const _WebOnlyNoticeBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Theme.of(context)
            .colorScheme
            .surfaceContainerHighest
            .withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(AppColors.radius),
        border: Border.all(
          color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.laptop_outlined,
            size: 16,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color:
                        Theme.of(context).colorScheme.onSurfaceVariant,
                    height: 1.45,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
