import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';

/// Wraps [child] and shows it only when the user has [cost] or more credits.
/// When credits are insufficient, renders a lock card with cost info and a
/// "Top up" CTA. The widget rebuilds automatically when [creditWalletProvider]
/// updates (e.g., after checkout).
class CreditGate extends ConsumerWidget {
  const CreditGate({
    super.key,
    required this.cost,
    required this.feature,
    required this.child,
    this.featureIcon = Icons.bolt,
  });

  final int cost;
  final String feature;
  final Widget child;
  final IconData featureIcon;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // If subscriptions are disabled, always show the child.
    if (!AppConfig.enableSubscriptions) return child;
    // If in-app purchasing is disabled (App Store / Play Store build), always
    // show the child — purchasing happens on web only.
    if (!AppConfig.enableInAppPurchasing) return child;

    final walletAsync = ref.watch(creditWalletProvider);

    return walletAsync.when(
      // While loading, show a muted version of the child
      loading: () => Opacity(opacity: 0.5, child: child),
      // On error, optimistically show the child (don't block on wallet error)
      error: (_, __) => child,
      data: (wallet) {
        final balance = wallet.balance;
        if (balance >= cost) return child;
        return _LockCard(
          cost: cost,
          balance: balance,
          feature: feature,
          featureIcon: featureIcon,
        );
      },
    );
  }
}

class _LockCard extends StatelessWidget {
  const _LockCard({
    required this.cost,
    required this.balance,
    required this.feature,
    required this.featureIcon,
  });

  final int cost;
  final int balance;
  final String feature;
  final IconData featureIcon;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final primary = Theme.of(context).colorScheme.primary;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context)
            .colorScheme
            .surfaceContainerHighest
            .withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(AppColors.radius + 4),
        border: Border.all(
          color: primary.withValues(alpha: 0.25),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Stack(
            alignment: Alignment.topRight,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: primary.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(featureIcon, color: primary, size: 28),
              ),
              Container(
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.errorContainer,
                  shape: BoxShape.circle,
                ),
                padding: const EdgeInsets.all(3),
                child: Icon(
                  Icons.lock,
                  size: 12,
                  color: Theme.of(context).colorScheme.error,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            feature,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: 6),
          Text(
            'Requires $cost ${cost == 1 ? 'credit' : 'credits'}',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 4),
          Text(
            'You have $balance ${balance == 1 ? 'credit' : 'credits'}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => context.push('/consumer/subscription'),
                  icon: const Icon(Icons.bolt, size: 16),
                  label: Text(l10n.commonTopUpCredits),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => context.push('/consumer/subscription'),
            child: Text(l10n.commonViewPlans),
          ),
        ],
      ),
    );
  }
}
