import 'package:flutter/material.dart';
import 'package:showcaseview/showcaseview.dart';

import '../theme/app_colors.dart';

/// Subtle dim — dashboard stays readable behind tour overlays.
const kTutorialOverlayOpacity = 0.22;

const kTutorialOverlayColor = Colors.black;

/// Blur darkens dark-mode UI disproportionately; keep at 0 on mobile.
const kTutorialBlurValue = 0.0;

/// Branded showcase tooltip aligned with Umbrella web tour styling.
class UmbrellaShowcase extends StatelessWidget {
  const UmbrellaShowcase({
    super.key,
    required this.showcaseKey,
    required this.title,
    required this.description,
    required this.child,
    this.onBarrierClick,
    this.onTargetClick,
  });

  final GlobalKey showcaseKey;
  final String title;
  final String description;
  final Widget child;
  final VoidCallback? onBarrierClick;
  final VoidCallback? onTargetClick;

  static TextStyle _titleStyle(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return TextStyle(
      fontSize: 15,
      fontWeight: FontWeight.w600,
      color: isDark ? AppColors.foregroundDark : AppColors.foregroundLight,
      height: 1.3,
    );
  }

  static TextStyle _descriptionStyle(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w400,
      color: isDark
          ? AppColors.mutedForegroundDark
          : AppColors.mutedForegroundLight,
      height: 1.45,
    );
  }

  static Color _tooltipBackground(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.logoBlueSurface
        : Colors.white;
  }

  @override
  Widget build(BuildContext context) {
    return Showcase(
      key: showcaseKey,
      title: title,
      description: description,
      titleTextStyle: _titleStyle(context),
      descTextStyle: _descriptionStyle(context),
      tooltipBackgroundColor: _tooltipBackground(context),
      tooltipBorderRadius: BorderRadius.circular(AppColors.radius),
      targetBorderRadius: BorderRadius.circular(AppColors.radius),
      tooltipPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      overlayColor: kTutorialOverlayColor,
      overlayOpacity: kTutorialOverlayOpacity,
      onBarrierClick: onBarrierClick,
      onTargetClick: onTargetClick,
      child: child,
    );
  }
}

/// Shared ShowCaseWidget configuration for app shells.
class UmbrellaShowcaseScope extends StatelessWidget {
  const UmbrellaShowcaseScope({
    super.key,
    required this.builder,
    this.onFinish,
  });

  final WidgetBuilder builder;
  final VoidCallback? onFinish;

  @override
  Widget build(BuildContext context) {
    return ShowCaseWidget(
      blurValue: kTutorialBlurValue,
      autoPlayDelay: const Duration(milliseconds: 400),
      onFinish: onFinish,
      builder: builder,
    );
  }
}
