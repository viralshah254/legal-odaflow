import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/brand/umbrella_logo.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/theme_tokens.dart';
import '../../l10n/app_localizations.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final headlineLines = l10n.marketingWelcomeHeadline.split('\n');
    final primaryLine = headlineLines.first;
    final accentLine =
        headlineLines.length > 1 ? headlineLines.sublist(1).join('\n') : null;

    return Scaffold(
      backgroundColor: AppColors.logoBlue,
      body: Stack(
        fit: StackFit.expand,
        children: [
          const _WelcomeBackground(),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Spacer(flex: 2),
                  const Center(child: UmbrellaLogo(height: 40)),
                  const SizedBox(height: 40),
                  Text(
                    primaryLine,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.displaySmall?.copyWith(
                      color: ThemeTokens.foregroundDark,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -1.2,
                      height: 1.05,
                      fontSize: 34,
                    ),
                  ),
                  if (accentLine != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      accentLine,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        color: AppColors.logoAccent,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.4,
                        height: 1.2,
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  Text(
                    l10n.marketingWelcomeSubtext,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: ThemeTokens.mutedForegroundDark,
                      height: 1.55,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 32),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    clipBehavior: Clip.none,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _FeatureChip(
                          icon: Icons.bolt_rounded,
                          label: l10n.marketingInstantAnswers,
                        ),
                        const SizedBox(width: 10),
                        _FeatureChip(
                          icon: Icons.lock_outline_rounded,
                          label: l10n.marketingPrivate,
                        ),
                        const SizedBox(width: 10),
                        _FeatureChip(
                          icon: Icons.public_rounded,
                          label: l10n.marketingAnywhereChip,
                        ),
                      ],
                    ),
                  ),
                  const Spacer(flex: 3),
                  FilledButton(
                    onPressed: () => context.go('/auth'),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.logoAccent,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 17),
                      elevation: 0,
                      shadowColor: AppColors.logoAccent.withValues(alpha: 0.45),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(ThemeTokens.radius),
                      ),
                    ),
                    child: Text(
                      l10n.marketingGetStarted,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                        letterSpacing: 0.1,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _TryFreeCallout(
                    label: l10n.marketingTryForFree,
                    onTap: () =>
                        context.go('/consumer/issue-checker?preview=true'),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    l10n.marketingBuiltForEveryone,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: ThemeTokens.mutedForegroundDark.withValues(
                        alpha: 0.55,
                      ),
                      fontSize: 11,
                      letterSpacing: 0.2,
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _WelcomeBackground extends StatelessWidget {
  const _WelcomeBackground();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppColors.logoBlue,
            AppColors.logoBlueElevated,
            AppColors.logoBlue,
          ],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -80,
            left: MediaQuery.sizeOf(context).width * 0.5 - 160,
            child: Container(
              width: 320,
              height: 320,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppColors.logoAccent.withValues(alpha: 0.18),
                    AppColors.logoAccent.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: 120,
            right: -40,
            child: Container(
              width: 180,
              height: 180,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.logoAccent.withValues(alpha: 0.06),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TryFreeCallout extends StatelessWidget {
  const _TryFreeCallout({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    var title = label;
    String? subtitle;
    final parts = label.split(' — ');
    if (parts.length >= 2) {
      title = parts.first.trim();
      subtitle = parts.sublist(1).join(' — ').trim();
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(ThemeTokens.radius),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(ThemeTokens.radius),
            color: Colors.white.withValues(alpha: 0.06),
            border: Border.all(
              color: AppColors.logoAccent.withValues(alpha: 0.38),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.logoAccent.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.explore_outlined,
                  size: 22,
                  color: AppColors.logoAccent,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: ThemeTokens.foregroundDark,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.1,
                        height: 1.2,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: TextStyle(
                          color: ThemeTokens.mutedForegroundDark.withValues(
                            alpha: 0.9,
                          ),
                          fontSize: 13,
                          height: 1.25,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Icon(
                Icons.arrow_forward_rounded,
                size: 18,
                color: AppColors.logoAccent.withValues(alpha: 0.85),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FeatureChip extends StatelessWidget {
  const _FeatureChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.logoBlueSurface.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: ThemeTokens.borderDark.withValues(alpha: 0.75),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.logoAccent),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: ThemeTokens.mutedForegroundDark,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
