import 'package:flutter/material.dart';
import 'theme_tokens.dart';

/// Shared color constants aligned with legal_web `globals.css`.
class AppColors {
  AppColors._();

  // Logo palette (umbrella_logo_source.png)
  static const Color logoBlue = Color(0xFF020E24);
  static const Color logoBlueElevated = Color(0xFF041026);
  static const Color logoBlueSurface = Color(0xFF0D1931);
  static const Color logoAccent = Color(0xFF226FEF);

  // Primary
  static const Color primaryLight = ThemeTokens.primaryLight;
  static const Color primaryDark = ThemeTokens.primaryDark;

  // Background
  static const Color backgroundLight = ThemeTokens.backgroundLight;
  static const Color backgroundDark = ThemeTokens.backgroundDark;

  // Foreground
  static const Color foregroundLight = ThemeTokens.foregroundLight;
  static const Color foregroundDark = ThemeTokens.foregroundDark;

  // Muted
  static const Color mutedLight = Color(0xFFF1F5F9);
  static const Color mutedDark = logoBlueElevated;
  static const Color mutedForegroundLight = ThemeTokens.mutedForegroundLight;
  static const Color mutedForegroundDark = ThemeTokens.mutedForegroundDark;

  // Borders & inputs
  static const Color borderLight = ThemeTokens.borderLight;
  static const Color borderDark = ThemeTokens.borderDark;

  // Semantic
  static const Color destructiveLight = ThemeTokens.destructive;
  static const Color destructiveDark = Color(0xFF7F1D1D);

  static const double radius = ThemeTokens.radius;
}
