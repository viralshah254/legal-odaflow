import 'package:flutter/material.dart';

import '../../../core/auth/social_auth_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';

class SocialAuthButtons extends StatelessWidget {
  const SocialAuthButtons({
    super.key,
    required this.onProviderTap,
    this.disabled = false,
    this.loadingProvider,
    this.showDivider = true,
    this.dividerLabel,
  });

  final ValueChanged<SocialAuthProvider> onProviderTap;
  final bool disabled;
  final SocialAuthProvider? loadingProvider;
  final bool showDivider;
  final String? dividerLabel;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isLoading = loadingProvider != null;
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SocialButton(
          onPressed: disabled || isLoading
              ? null
              : () => onProviderTap(SocialAuthProvider.google),
          icon: const _GoogleIcon(),
          label: loadingProvider == SocialAuthProvider.google
              ? l10n.authSigningInWithGoogle
              : l10n.authContinueWithGoogle,
          isLoading: loadingProvider == SocialAuthProvider.google,
          dimmed: isLoading && loadingProvider != SocialAuthProvider.google,
        ),
        const SizedBox(height: 12),
        _SocialButton(
          onPressed: disabled || isLoading
              ? null
              : () => onProviderTap(SocialAuthProvider.apple),
          icon: Icon(
            Icons.apple,
            size: 22,
            color: theme.colorScheme.onSurface,
          ),
          label: loadingProvider == SocialAuthProvider.apple
              ? l10n.authSigningInWithApple
              : l10n.authContinueWithApple,
          isLoading: loadingProvider == SocialAuthProvider.apple,
          dimmed: isLoading && loadingProvider != SocialAuthProvider.apple,
        ),
        if (showDivider) ...[
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(child: Divider(color: theme.dividerColor)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  dividerLabel ?? l10n.authOrContinueWithEmail,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: AppColors.mutedForegroundLight,
                    letterSpacing: 0.3,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              Expanded(child: Divider(color: theme.dividerColor)),
            ],
          ),
          const SizedBox(height: 24),
        ],
      ],
    );
  }
}

class _SocialButton extends StatelessWidget {
  const _SocialButton({
    required this.onPressed,
    required this.icon,
    required this.label,
    required this.isLoading,
    this.dimmed = false,
  });

  final VoidCallback? onPressed;
  final Widget icon;
  final String label;
  final bool isLoading;
  final bool dimmed;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return AnimatedOpacity(
      duration: const Duration(milliseconds: 180),
      opacity: dimmed ? 0.45 : 1,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
          side: BorderSide(color: theme.dividerColor),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radius),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (isLoading)
              SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: theme.colorScheme.primary,
                ),
              )
            else
              icon,
            const SizedBox(width: 12),
            Flexible(
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GoogleIcon extends StatelessWidget {
  const _GoogleIcon();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 20,
      height: 20,
      child: CustomPaint(painter: _GoogleLogoPainter()),
    );
  }
}

class _GoogleLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    void arc(Color color, double start, double sweep) {
      final paint = Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = w * 0.18
        ..strokeCap = StrokeCap.round;
      canvas.drawArc(
        Rect.fromLTWH(w * 0.08, h * 0.08, w * 0.84, h * 0.84),
        start,
        sweep,
        false,
        paint,
      );
    }

    arc(const Color(0xFF4285F4), -0.45, 1.35);
    arc(const Color(0xFF34A853), 0.9, 1.05);
    arc(const Color(0xFFFBBC05), 2.0, 0.95);
    arc(const Color(0xFFEA4335), 3.0, 1.05);

    canvas.drawRect(
      Rect.fromLTWH(w * 0.48, h * 0.46, w * 0.42, h * 0.12),
      Paint()..color = const Color(0xFF4285F4),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
