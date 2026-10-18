import '../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/credits_api.dart';
import '../../core/providers/app_providers.dart';
import '../../core/widgets/app_error_view.dart';
import '../credits/widgets/credit_usage_meter.dart';

// ---------------------------------------------------------------------------
// Provider: loads and caches the budget policy
// ---------------------------------------------------------------------------

final _budgetPolicyProvider = FutureProvider.autoDispose<AiBudgetPolicy>((ref) async {
  final user = ref.watch(authControllerProvider).session?.user;
  return ref
      .watch(creditsApiProvider)
      .getAiBudgetPolicy(tenantId: user?.tenantId);
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class AiUsageSettingsScreen extends ConsumerStatefulWidget {
  const AiUsageSettingsScreen({super.key, this.isLawyerMode = false});

  final bool isLawyerMode;

  @override
  ConsumerState<AiUsageSettingsScreen> createState() =>
      _AiUsageSettingsScreenState();
}

class _AiUsageSettingsScreenState extends ConsumerState<AiUsageSettingsScreen> {
  final _budgetController = TextEditingController();
  late int _alertAtPercent;
  late bool _hardStopEnabled;
  late bool _budgetEnabled;
  bool _saving = false;
  String? _saveError;
  bool _loaded = false;

  @override
  void dispose() {
    _budgetController.dispose();
    super.dispose();
  }

  void _initFromPolicy(AiBudgetPolicy policy) {
    if (_loaded) return;
    _loaded = true;
    _budgetEnabled = policy.monthlyBudgetUsd > 0;
    _budgetController.text =
        _budgetEnabled ? policy.monthlyBudgetUsd.toStringAsFixed(0) : '';
    _alertAtPercent = policy.alertAtPercent;
    _hardStopEnabled = policy.hardStopEnabled;
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _saving = true;
      _saveError = null;
    });

    try {
      final user = ref.read(authControllerProvider).session?.user;
      final monthlyBudget = _budgetEnabled
          ? double.tryParse(_budgetController.text.trim()) ?? 0
          : 0.0;

      await ref.read(creditsApiProvider).updateAiBudgetPolicy(
            tenantId: user?.tenantId,
            monthlyBudgetUsd: monthlyBudget,
            alertAtPercent: _alertAtPercent,
            hardStopEnabled: _hardStopEnabled,
          );

      ref.invalidate(_budgetPolicyProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.settingsSaved)),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _saveError = e.toString());
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    final backRoute =
        widget.isLawyerMode ? '/lawyer/settings' : '/consumer/settings';
    final policyAsync = ref.watch(_budgetPolicyProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.dashboardAiUsagePlan),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go(backRoute),
        ),
      ),
      body: policyAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => AppErrorView(
          message: e.toString(),
          onRetry: () => ref.invalidate(_budgetPolicyProvider),
        ),
        data: (policy) {
          _initFromPolicy(policy);
          return _buildBody(context, l10n, colorScheme);
        },
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    AppLocalizations l10n,
    ColorScheme colorScheme,
  ) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Description
        Text(
          l10n.settingsAiUsageSettingsDescription,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
        ),
        const SizedBox(height: 20),

        // Usage meter
        CreditUsageMeter(manageOnWebPath: '/app/settings/plan-usage'),
        const SizedBox(height: 28),

        // ----------------------------------------------------------------
        // Spend limits section
        // ----------------------------------------------------------------
        _SectionHeader(
          icon: Icons.tune_outlined,
          title: 'AI spend limits',
          subtitle:
              'Set a monthly budget. AI requests are never blocked by default — '
              'this is informational unless you enable hard stop.',
        ),
        const SizedBox(height: 16),

        // Monthly budget toggle
        _SettingsCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Monthly spending limit',
                          style: Theme.of(context)
                              .textTheme
                              .titleSmall
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Set a USD cap for AI usage this month',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: colorScheme.onSurfaceVariant,
                              ),
                        ),
                      ],
                    ),
                  ),
                  Switch(
                    value: _budgetEnabled,
                    onChanged: (v) => setState(() {
                      _budgetEnabled = v;
                      if (!v) _budgetController.clear();
                    }),
                  ),
                ],
              ),
              if (_budgetEnabled) ...[
                const SizedBox(height: 12),
                TextField(
                  controller: _budgetController,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}')),
                  ],
                  decoration: InputDecoration(
                    border: const OutlineInputBorder(),
                    labelText: 'Monthly limit (USD)',
                    prefixText: '\$ ',
                    hintText: '50',
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),

        // Alert threshold
        if (_budgetEnabled) ...[
          _SettingsCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Alert threshold',
                      style: Theme.of(context)
                          .textTheme
                          .titleSmall
                          ?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: colorScheme.primaryContainer,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '$_alertAtPercent%',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: colorScheme.onPrimaryContainer,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Notify me when I reach $_alertAtPercent% of my monthly limit',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                ),
                Slider(
                  value: _alertAtPercent.toDouble(),
                  min: 10,
                  max: 100,
                  divisions: 9,
                  onChanged: (v) =>
                      setState(() => _alertAtPercent = v.round()),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],

        // Hard stop toggle
        _SettingsCard(
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Hard stop when limit reached',
                      style: Theme.of(context)
                          .textTheme
                          .titleSmall
                          ?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _hardStopEnabled
                          ? 'AI requests will be blocked once the limit is hit'
                          : 'AI requests continue past the limit (recommended)',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: _hardStopEnabled
                                ? colorScheme.error
                                : colorScheme.onSurfaceVariant,
                          ),
                    ),
                  ],
                ),
              ),
                  Switch(
                    value: _hardStopEnabled,
                    activeThumbColor: colorScheme.error,
                    onChanged: (v) => setState(() => _hardStopEnabled = v),
                  ),
            ],
          ),
        ),

        if (_hardStopEnabled) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: colorScheme.errorContainer.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.warning_amber_outlined,
                  size: 18,
                  color: colorScheme.onErrorContainer,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Hard stop is on. AI will be blocked once your monthly limit is reached. '
                    'You can disable this at any time.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colorScheme.onErrorContainer,
                        ),
                  ),
                ),
              ],
            ),
          ),
        ],

        const SizedBox(height: 24),

        if (_saveError != null) ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: colorScheme.errorContainer.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              _saveError!,
              style: TextStyle(color: colorScheme.onErrorContainer),
            ),
          ),
          const SizedBox(height: 12),
        ],

        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: _saving ? null : _save,
            icon: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.save_outlined, size: 18),
            label: Text(_saving ? 'Saving…' : 'Save settings'),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Local widgets
// ---------------------------------------------------------------------------

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: colorScheme.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 18, color: colorScheme.primary),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context)
                    .textTheme
                    .titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: child,
    );
  }
}
