import '../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/consent/ai_inference_consent_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_card.dart';
import '../../core/widgets/app_page_header.dart';
import '../../core/widgets/app_section_header.dart';

class PrivacySecurityScreen extends StatefulWidget {
  const PrivacySecurityScreen({super.key, this.isLawyerMode = false});

  final bool isLawyerMode;

  @override
  State<PrivacySecurityScreen> createState() => _PrivacySecurityScreenState();
}

class _PrivacySecurityScreenState extends State<PrivacySecurityScreen> {
  bool _aiConsentGranted = false;

  @override
  void initState() {
    super.initState();
    _loadConsentStatus();
  }

  Future<void> _loadConsentStatus() async {
    final granted = await AiInferenceConsentStorage.hasGranted();
    if (mounted) setState(() => _aiConsentGranted = granted);
  }

  Future<void> _resetAiConsent(AppLocalizations l10n) async {
    await AiInferenceConsentStorage.reset();
    if (mounted) {
      setState(() => _aiConsentGranted = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.aiConsentSettingsDescription)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final muted =
        isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;
    final backRoute =
        widget.isLawyerMode ? '/lawyer/settings' : '/consumer/settings';

    final protections = [
      (
        icon: Icons.lock_outline,
        color: const Color(0xFF226FEF),
        title: l10n.settingsPrivacySecureTokenStorage,
        body: l10n.settingsPrivacySecureTokenStorageBody,
      ),
      (
        icon: Icons.privacy_tip_outlined,
        color: const Color(0xFF8B5CF6),
        title: l10n.settingsPrivacyConsentControlled,
        body: l10n.settingsPrivacyConsentControlledBody,
      ),
      (
        icon: Icons.visibility_off_outlined,
        color: const Color(0xFF14B8A6),
        title: l10n.settingsPrivacySensitiveDataUx,
        body: l10n.settingsPrivacySensitiveDataUxBody,
      ),
      (
        icon: Icons.fingerprint,
        color: const Color(0xFF10B981),
        title: l10n.settingsPrivacyBiometricsReadiness,
        body: l10n.settingsPrivacyBiometricsReadinessBody,
      ),
    ];

    final compliance = [
      (
        icon: Icons.shield_outlined,
        color: const Color(0xFF226FEF),
        title: 'End-to-end encryption',
        body:
            'All legal documents and communications are encrypted in transit and at rest.',
        route: null as String?,
      ),
      (
        icon: Icons.policy_outlined,
        color: const Color(0xFFF59E0B),
        title: 'Zero data-broker policy',
        body:
            'Your legal data is never sold or shared with third-party advertisers.',
        route: null as String?,
      ),
      (
        icon: Icons.delete_outline,
        color: const Color(0xFFEF4444),
        title: l10n.settingsPrivacyRightToErasure,
        body: l10n.settingsPrivacyRightToErasureBody,
        route: widget.isLawyerMode
            ? '/lawyer/settings/delete-account'
            : '/consumer/settings/delete-account',
      ),
    ];

    return Scaffold(
      backgroundColor: isDark ? AppColors.logoBlue : null,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(l10n.settingsPrivacySecurity),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go(backRoute),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 96),
        children: [
          AppPageHeader(
            title: l10n.settingsMobilePrivacyControls,
            subtitle: l10n
                .settingsReviewHowUmbrellaProtectsLegalDataOnThisDevice,
            padding: const EdgeInsets.fromLTRB(0, 16, 0, 16),
          ),
          const AppSectionHeader(title: 'On-device protections'),
          ...protections.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: AppCard(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AppIconBadge(
                      icon: item.icon,
                      color: item.color,
                      size: 38,
                      iconSize: 18,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.title,
                              style: tt.bodyMedium?.copyWith(
                                  fontWeight: FontWeight.w600)),
                          const SizedBox(height: 4),
                          Text(item.body,
                              style:
                                  tt.bodySmall?.copyWith(color: muted)),
                        ],
                      ),
                    ),
                    Icon(Icons.check_circle,
                        color: const Color(0xFF10B981), size: 18),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          const AppSectionHeader(title: 'Data & compliance'),
          ...compliance.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: AppCard(
                onTap: item.route == null ? null : () => context.go(item.route!),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AppIconBadge(
                      icon: item.icon,
                      color: item.color,
                      size: 38,
                      iconSize: 18,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.title,
                              style: tt.bodyMedium?.copyWith(
                                  fontWeight: FontWeight.w600)),
                          const SizedBox(height: 4),
                          Text(item.body,
                              style:
                                  tt.bodySmall?.copyWith(color: muted)),
                        ],
                      ),
                    ),
                    if (item.route != null)
                      Icon(Icons.chevron_right, color: muted, size: 18),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          // AI inference consent — required by App Store guidelines 5.1.1/5.1.2
          AppCard(
            onTap: _aiConsentGranted
                ? () async {
                    await showDialog(
                      context: context,
                      builder: (_) => AlertDialog(
                        title: Text(l10n.aiConsentSettingsTitle),
                        content: Text(l10n.aiConsentSettingsDescription),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.of(context).pop(),
                            child: Text(l10n.commonClose),
                          ),
                          FilledButton(
                            onPressed: () async {
                              Navigator.of(context).pop();
                              await _resetAiConsent(l10n);
                            },
                            child: const Text('Reset consent'),
                          ),
                        ],
                      ),
                    );
                  }
                : null,
            child: Row(
              children: [
                AppIconBadge(
                  icon: Icons.smart_toy_outlined,
                  color: const Color(0xFF8B5CF6),
                  size: 38,
                  iconSize: 18,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l10n.aiConsentSettingsTitle,
                          style: tt.bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      Text(
                        _aiConsentGranted
                            ? 'Granted — tap to review or reset'
                            : 'Not yet granted — shown before first AI use',
                        style: tt.bodySmall?.copyWith(color: muted),
                      ),
                    ],
                  ),
                ),
                if (_aiConsentGranted)
                  Icon(Icons.chevron_right, color: muted, size: 18),
              ],
            ),
          ),
          const SizedBox(height: 10),
          // Data consent deep-link
          AppCard(
            onTap: () => context.go(widget.isLawyerMode
                ? '/lawyer/settings/data-consent'
                : '/consumer/settings/data-consent'),
            child: Row(
              children: [
                AppIconBadge(
                  icon: Icons.tune_outlined,
                  color: cs.primary,
                  size: 38,
                  iconSize: 18,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Training consent settings',
                          style: tt.bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      Text(
                          'Manage how your data is used to improve AI models.',
                          style: tt.bodySmall?.copyWith(color: muted)),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, color: muted, size: 18),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
