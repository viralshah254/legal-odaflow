import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/pricing/available_models.dart';
import '../../../core/pricing/local_pricing.dart';
import '../../../core/pricing/credit_pack_hints.dart';
import '../../../core/pricing/plan_benefits.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../widgets/legal_disclaimer.dart';
import '../../credits/credits_repository.dart';
import '../../credits/widgets/credit_usage_meter.dart';
import 'payment_checkout_screen.dart';

final subscriptionPlansProvider =
    FutureProvider.family<List<PricingPlan>, String>((ref, countryCode) async {
      return ref
          .watch(subscriptionsApiProvider)
          .listPlans(countryCode: countryCode);
    });

class SubscriptionsScreen extends ConsumerStatefulWidget {
  const SubscriptionsScreen({super.key});

  @override
  ConsumerState<SubscriptionsScreen> createState() =>
      _SubscriptionsScreenState();
}

class _SubscriptionsScreenState extends ConsumerState<SubscriptionsScreen> {
  String? _checkingOutPlanId;
  String? _checkingOutPackId;
  String? _error;

  Future<void> _checkout(PricingPlan plan, String countryCode) async {
    final l10n = AppLocalizations.of(context);
    if (plan.amount <= 0) {
      context.go('/consumer/issue-checker');
      return;
    }

    setState(() {
      _checkingOutPlanId = plan.planId;
      _error = null;
    });

    try {
      final checkout = await ref
          .read(subscriptionsApiProvider)
          .checkout(planId: plan.planId, countryCode: countryCode);

      if (!mounted) return;

      final checkoutUrl = AppConfig.resolveCheckoutUrl(checkout.checkoutUrl);
      if (checkoutUrl.isEmpty) {
        setState(() => _error = l10n.consumerCheckoutUrlUnavailable);
        return;
      }

      final parsedCheckoutUrl = Uri.tryParse(checkoutUrl);
      if (parsedCheckoutUrl == null || !parsedCheckoutUrl.hasScheme) {
        setState(() => _error = l10n.consumerInvalidCheckoutUrl);
        return;
      }

      final paid = await openPaymentCheckout(
        context,
        checkoutUrl: checkoutUrl,
        title: 'Subscribe — ${plan.planId}',
      );

      if (!mounted) return;

      if (paid == true) {
        ref.invalidate(creditWalletProvider);
        ref.invalidate(consumerCreditPacksProvider(countryCode));
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.consumerSubscriptionActivated)),
        );
      }
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = l10n.consumerUnableToStartCheckout);
    } finally {
      if (mounted) setState(() => _checkingOutPlanId = null);
    }
  }

  Future<void> _buyCredits(String packId, String countryCode) async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _checkingOutPackId = packId;
      _error = null;
    });

    try {
      final checkout = await ref
          .read(consumersApiProvider)
          .createCreditTopupCheckout(
            countryCode: countryCode,
            packId: packId,
          );

      if (!mounted) return;

      final checkoutUrl = AppConfig.resolveCheckoutUrl(checkout.checkoutUrl);
      if (checkoutUrl.isEmpty) {
        setState(() => _error = l10n.consumerCheckoutUrlUnavailable);
        return;
      }

      final parsedCheckoutUrl = Uri.tryParse(checkoutUrl);
      if (parsedCheckoutUrl == null || !parsedCheckoutUrl.hasScheme) {
        setState(() => _error = l10n.consumerInvalidCheckoutUrl);
        return;
      }

      final paid = await openPaymentCheckout(
        context,
        checkoutUrl: checkoutUrl,
        title: 'Add AI budget',
      );

      if (!mounted) return;

      if (paid == true) {
        ref.invalidate(creditWalletProvider);
        ref.invalidate(consumerCreditPacksProvider(countryCode));
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.consumerAiBudgetAddedToYourAccount)),
        );
      }
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = l10n.consumerUnableToStartPurchase);
    } finally {
      if (mounted) setState(() => _checkingOutPackId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    if (!AppConfig.enableSubscriptions) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.consumerPlansAiUsage)),
        body: Center(child: Text(l10n.consumerSubscriptionsAreNotEnabled)),
      );
    }

    // App Store / Google Play build: show read-only usage, no checkout UI.
    if (!AppConfig.enableInAppPurchasing) {
      return _ReadOnlyUsageScreen(l10n: l10n);
    }

    final user = ref.watch(authControllerProvider).session?.user;
    final countryCode = user?.countryCode ?? AppConfig.defaultCountry;
    final plansAsync = ref.watch(subscriptionPlansProvider(countryCode));
    final packsAsync = ref.watch(consumerCreditPacksProvider(countryCode));
    final walletAsync = ref.watch(creditWalletProvider);

    final currentWallet = walletAsync.maybeWhen(
      data: (w) => w,
      orElse: () => null,
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.consumerPlansAiUsage),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/consumer'),
        ),
      ),
      body: plansAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.cloud_off_outlined,
                  size: 48,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                const SizedBox(height: 16),
                Text(
                  error is ApiException
                      ? error.message
                      : l10n.consumerUnableToLoadPlans,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () =>
                      ref.invalidate(subscriptionPlansProvider(countryCode)),
                  icon: const Icon(Icons.refresh, size: 18),
                  label: Text(l10n.commonRetry),
                ),
              ],
            ),
          ),
        ),
        data: (plans) => ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // Hero header
            _ScreenHeader(wallet: currentWallet),
            const SizedBox(height: 20),

            if (_error != null) ...[
              _ErrorBanner(message: _error!),
              const SizedBox(height: 16),
            ],

            // Plan cards
            ...plans.map(
              (plan) => _PlanCard(
                plan: plan,
                isActive: _isActivePlan(plan, currentWallet),
                isCheckingOut: _checkingOutPlanId == plan.planId,
                onCheckout: () => _checkout(plan, countryCode),
              ),
            ),

            const SizedBox(height: 28),

            // Add AI budget section (one-time top-ups)
            _SectionHeader(
              title: l10n.consumerAddAiBudget,
              subtitle: l10n.consumerAddAiBudgetSubtitle,
            ),
            const SizedBox(height: 12),

            ...packsAsync.when(
              loading: () => [
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Center(child: CircularProgressIndicator()),
                ),
              ],
              error: (_, __) => _packTiles(
                fallbackCreditPacks(countryCode),
                countryCode,
              ),
              data: (packs) => _packTiles(
                packs.isEmpty ? fallbackCreditPacks(countryCode) : packs,
                countryCode,
              ),
            ),

            const SizedBox(height: 8),
            const LegalDisclaimer(compact: true),
          ],
        ),
      ),
    );
  }

  List<Widget> _packTiles(List<CreditPack> packs, String countryCode) {
    return packs
        .map(
          (pack) => _BudgetPackTile(
            pack: pack,
            isCheckingOut: _checkingOutPackId == pack.packId,
            onBuy: () => _buyCredits(pack.packId, countryCode),
          ),
        )
        .toList();
  }

  bool _isActivePlan(PricingPlan plan, CreditWalletView? wallet) {
    if (wallet == null) return false;
    final monthly = wallet.planCreditsMonthly;
    final isCurrentPaid = plan.aiCredits == monthly && plan.amount > 0;
    final isCurrentFree = monthly == 0 && plan.amount <= 0;
    return isCurrentPaid || isCurrentFree;
  }
}

// ---------------------------------------------------------------------------
// Screen header — current usage summary
// ---------------------------------------------------------------------------

class _ScreenHeader extends StatelessWidget {
  const _ScreenHeader({this.wallet});

  final CreditWalletView? wallet;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.consumerPlansAiUsage,
          style: Theme.of(context)
              .textTheme
              .headlineSmall
              ?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        Text(
          '${l10n.consumerAllPlansGiveYou70OfYourPaymentAsAiModelBudget} ${l10n.consumerChoosePlanOrTopUp}',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
        ),
        if (wallet != null && wallet!.percentUsed > 0) ...[
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: colorScheme.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(AppColors.radius),
              border: Border.all(color: colorScheme.outline.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                Icon(Icons.bolt, size: 16, color: colorScheme.primary),
                const SizedBox(width: 8),
                Text(
                  l10n.consumerPercentBudgetUsed('${wallet!.percentUsed}'),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colorScheme.primary,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Plan card
// ---------------------------------------------------------------------------

class _PlanCard extends StatefulWidget {
  const _PlanCard({
    required this.plan,
    required this.isActive,
    required this.isCheckingOut,
    required this.onCheckout,
  });

  final PricingPlan plan;
  final bool isActive;
  final bool isCheckingOut;
  final VoidCallback onCheckout;

  @override
  State<_PlanCard> createState() => _PlanCardState();
}

class _PlanCardState extends State<_PlanCard> {
  bool _modelsExpanded = false;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    final plan = widget.plan;
    final isPlus = plan.planId.contains('plus');
    final isPro = plan.planId.contains('pro');
    final isHighlighted = isPlus || isPro;
    final isFree = plan.amount <= 0;
    final tagline = planTagline(l10n, plan);
    final bullets = getPlanBenefitBullets(l10n, plan);
    final planLabel = _humanPlanLabel(l10n, plan.planId);

    // AI budget line: 70% of the plan price in local currency
    final aiBudgetLabel = !isFree
        ? formatAiBudgetLocal(aiBudgetUsdFromPrice(plan.amount), plan.currency)
        : null;

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Card(
        shape: RoundedRectangleBorder(
          side: isHighlighted
              ? BorderSide(color: colorScheme.primary, width: 2)
              : BorderSide(color: colorScheme.outline.withValues(alpha: 0.15)),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Title row
              Row(
                children: [
                  Expanded(
                    child: Text(
                      planLabel,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                      ),
                    ),
                  ),
                  if (widget.isActive)
                    _PlanBadge(
                      label: l10n.commonCurrentPlan,
                      color: Colors.green,
                    )
                  else if (isHighlighted)
                    _PlanBadge(
                      label: l10n.consumerPopular,
                      color: colorScheme.primary,
                    ),
                ],
              ),

              if (tagline.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  tagline,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                ),
              ],

              const SizedBox(height: 12),

              // Price
              Text(
                formatPlanPrice(plan.amount, plan.currency) +
                    (plan.amount > 0 ? ' / mo' : ''),
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),

              // AI budget callout for paid plans
              if (aiBudgetLabel != null) ...[
                const SizedBox(height: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: colorScheme.primary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.auto_awesome,
                          size: 13, color: colorScheme.primary),
                      const SizedBox(width: 6),
                      Text(l10n.consumerAibudgetlabelMoAiModelBudget(aiBudgetLabel),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: colorScheme.primary,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 16),

              // Feature bullets
              ...bullets.map(
                (bullet) => Padding(
                  padding: const EdgeInsets.only(bottom: 7),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        bullet.included
                            ? Icons.check_circle_outline
                            : Icons.lock_outline,
                        size: 16,
                        color: bullet.included
                            ? colorScheme.primary
                            : colorScheme.onSurfaceVariant,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          bullet.text,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: bullet.included
                                        ? null
                                        : colorScheme.onSurfaceVariant,
                                  ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 12),

              // Available models section
              _ModelsSection(
                isPlusOrAbove: !isFree,
                expanded: _modelsExpanded,
                onToggle: () =>
                    setState(() => _modelsExpanded = !_modelsExpanded),
              ),

              const SizedBox(height: 16),

              // CTA button
              SizedBox(
                width: double.infinity,
                child: widget.isActive
                    ? OutlinedButton(
                        onPressed: null,
                        child: Text(l10n.commonCurrentPlan),
                      )
                    : FilledButton(
                        onPressed: widget.isCheckingOut
                            ? null
                            : widget.onCheckout,
                        child: widget.isCheckingOut
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Text(isFree
                                ? l10n.consumerStartFree
                                : l10n.consumerUpgradeToPlan(planLabel)),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _humanPlanLabel(AppLocalizations l10n, String planId) {
    final lower = planId.toLowerCase();
    if (lower.contains('pro')) return l10n.consumerPlanPro;
    if (lower.contains('plus')) return l10n.consumerPlanPlus;
    if (lower.contains('starter')) return l10n.consumerPlanStarter;
    if (lower.contains('free')) return l10n.consumerPlanFree;
    return planId
        .replaceAll('_', ' ')
        .split(' ')
        .map((w) => w.isEmpty ? '' : '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');
  }
}

// ---------------------------------------------------------------------------
// Models section inside plan card
// ---------------------------------------------------------------------------

class _ModelsSection extends StatelessWidget {
  const _ModelsSection({
    required this.isPlusOrAbove,
    required this.expanded,
    required this.onToggle,
  });

  final bool isPlusOrAbove;
  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: onToggle,
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                Icon(Icons.smart_toy_outlined,
                    size: 14, color: colorScheme.onSurfaceVariant),
                const SizedBox(width: 6),
                Text(l10n.consumerAvailableModels,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const Spacer(),
                Icon(
                  expanded ? Icons.expand_less : Icons.expand_more,
                  size: 16,
                  color: colorScheme.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
        if (expanded) ...[
          const SizedBox(height: 10),
          // Auto models (always available)
          _ModelGroup(
            label: l10n.consumerAuto,
            models: kAutoModels,
            locked: false,
          ),
          const SizedBox(height: 8),
          // Premium models (Plus+ only)
          _ModelGroup(
            label: l10n.consumerPremium,
            models: kPremiumModels,
            locked: !isPlusOrAbove,
          ),
        ],
      ],
    );
  }
}

class _ModelGroup extends StatelessWidget {
  const _ModelGroup({
    required this.label,
    required this.models,
    required this.locked,
  });

  final String label;
  final List<AiModel> models;
  final bool locked;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            if (locked)
              Icon(Icons.lock_outline, size: 11, color: colorScheme.onSurfaceVariant),
            if (!locked)
              Icon(Icons.check_circle, size: 11, color: Colors.green.shade600),
            const SizedBox(width: 4),
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: locked
                        ? colorScheme.onSurfaceVariant
                        : Colors.green.shade700,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: models.map((m) => _ModelChip(model: m, locked: locked)).toList(),
        ),
      ],
    );
  }
}

class _ModelChip extends StatelessWidget {
  const _ModelChip({required this.model, required this.locked});

  final AiModel model;
  final bool locked;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final bg = locked
        ? colorScheme.surfaceContainerHighest.withValues(alpha: 0.5)
        : colorScheme.primary.withValues(alpha: 0.08);
    final fg = locked ? colorScheme.onSurfaceVariant : colorScheme.primary;

    return Tooltip(
      message: model.description,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: locked
                ? colorScheme.outline.withValues(alpha: 0.25)
                : colorScheme.primary.withValues(alpha: 0.2),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (locked) ...[
              Icon(Icons.lock_outline, size: 10, color: fg),
              const SizedBox(width: 4),
            ],
            Text(
              model.name,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: fg,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Budget pack tile
// ---------------------------------------------------------------------------

class _BudgetPackTile extends StatelessWidget {
  const _BudgetPackTile({
    required this.pack,
    required this.isCheckingOut,
    required this.onBuy,
  });

  final CreditPack pack;
  final bool isCheckingOut;
  final VoidCallback onBuy;

  /// USD value of AI model access this pack adds: credits × $0.06/credit.
  String _packBudgetUsdLabel() {
    final budgetUsd = pack.credits * 0.06;
    return '\$${budgetUsd.toStringAsFixed(2)}';
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    final priceLabel = formatPlanPrice(pack.amount, pack.currency);
    final packLabel = pack.label.isNotEmpty ? pack.label : l10n.consumerTopUp;
    final budgetUsdLabel = _packBudgetUsdLabel();
    final valueHint = getCreditPackValueHint(pack.credits);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Card(
        shape: RoundedRectangleBorder(
          side: BorderSide(color: colorScheme.outline.withValues(alpha: 0.15)),
          borderRadius: BorderRadius.circular(AppColors.radius),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.amber.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.bolt, color: Colors.amber.shade700),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title: "KES 653 · Starter top-up"
                    Text('$priceLabel · $packLabel',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 3),
                    // Subtitle 1: "~$3.49 AI model budget added to your wallet"
                    Text('~$budgetUsdLabel AI model budget added to your wallet',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: colorScheme.primary,
                            fontWeight: FontWeight.w500,
                          ),
                    ),
                    // Subtitle 2: value hint (credit count as context)
                    if (valueHint.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        valueHint,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: colorScheme.onSurfaceVariant,
                            ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 12),
              isCheckingOut
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : FilledButton(
                      onPressed: onBuy,
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                        visualDensity: VisualDensity.compact,
                      ),
                      child: Text(l10n.consumerBuy),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shared small widgets
// ---------------------------------------------------------------------------

class _PlanBadge extends StatelessWidget {
  const _PlanBadge({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.13),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context)
            .colorScheme
            .errorContainer
            .withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        message,
        style: TextStyle(
            color: Theme.of(context).colorScheme.onErrorContainer),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Read-only screen shown when ENABLE_IN_APP_PURCHASING=false (store builds).
// Displays current usage and informs users to top up on the web app.
// ---------------------------------------------------------------------------

class _ReadOnlyUsageScreen extends ConsumerWidget {
  const _ReadOnlyUsageScreen({required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.settingsAiUsagePlan),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/consumer'),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const CreditUsageMeter(readOnly: true),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              color: Theme.of(context)
                  .colorScheme
                  .surfaceContainerHighest
                  .withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: Theme.of(context)
                    .colorScheme
                    .outline
                    .withValues(alpha: 0.3),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.laptop_outlined,
                  size: 18,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    l10n.consumerCreditsDesktopOnly,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                          height: 1.45,
                        ),
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
