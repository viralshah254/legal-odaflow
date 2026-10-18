// ignore_for_file: avoid_print
/// Generates legal_app/lib/core/theme/theme_tokens.dart from tokens.json.
///
/// Run from repo root:
///   dart run shared/theme/generate_flutter_tokens.dart
import 'dart:convert';
import 'dart:io';

void main() {
  final repoRoot = _findRepoRoot();
  final tokensFile = File('${repoRoot.path}/shared/theme/tokens.json');
  final outputFile =
      File('${repoRoot.path}/legal_app/lib/core/theme/theme_tokens.dart');

  if (!tokensFile.existsSync()) {
    stderr.writeln('Missing ${tokensFile.path}');
    exit(1);
  }

  final tokens = jsonDecode(tokensFile.readAsStringSync()) as Map<String, dynamic>;
  final colors = tokens['colors'] as Map<String, dynamic>;
  final radius = tokens['radius'] as Map<String, dynamic>;
  final typography = tokens['typography'] as Map<String, dynamic>;

  final fontFamily = (typography['fontFamily'] as String).split(',').first.trim();
  final radiusPx = radius['defaultPx'] as num;

  String colorConst(String name, String hex) {
    final value = hex.replaceFirst('#', '0xFF');
    return '  static const Color $name = Color($value);';
  }

  final buffer = StringBuffer('''
import 'package:flutter/material.dart';

/// GENERATED FILE — do not edit by hand.
/// Source: shared/theme/tokens.json
/// Regenerate: dart run shared/theme/generate_flutter_tokens.dart
class ThemeTokens {
  ThemeTokens._();

  static const String appName = '${tokens['name']}';
  static const String fontFamily = '$fontFamily';

${colorConst('primaryLight', colors['primaryLight'] as String)}
${colorConst('primaryDark', colors['primaryDark'] as String)}
${colorConst('backgroundLight', colors['backgroundLight'] as String)}
${colorConst('backgroundDark', colors['backgroundDark'] as String)}
${colorConst('foregroundLight', colors['foregroundLight'] as String)}
${colorConst('foregroundDark', colors['foregroundDark'] as String)}
${colorConst('mutedForegroundLight', colors['mutedLight'] as String)}
${colorConst('mutedForegroundDark', colors['mutedDark'] as String)}
${colorConst('destructive', colors['destructive'] as String)}
${colorConst('borderLight', colors['borderLight'] as String)}
${colorConst('borderDark', colors['borderDark'] as String)}
  static const double radius = $radiusPx;
}

class ThemeSpacing {
  ThemeSpacing._();

  static const double xs = 8;
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 20;
  static const double xl = 24;
}
''');

  outputFile.writeAsStringSync(buffer.toString());
  print('Wrote ${outputFile.path}');
}

Directory _findRepoRoot() {
  var dir = Directory.current;
  while (true) {
    if (File('${dir.path}/shared/theme/tokens.json').existsSync()) {
      return dir;
    }
    final parent = dir.parent;
    if (parent.path == dir.path) {
      throw StateError('Could not find repo root (shared/theme/tokens.json)');
    }
    dir = parent;
  }
}
