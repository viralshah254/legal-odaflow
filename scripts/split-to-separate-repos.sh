#!/usr/bin/env bash
# Split legal-by-odaflow monorepo into three sibling repos with root-level files.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PARENT="$(dirname "$ROOT")"

BACKEND_OUT="$PARENT/legal-backend"
WEB_OUT="$PARENT/legal-web"
APP_OUT="$PARENT/legal-app"

copy_tree() {
  local src="$1"
  local dest="$2"
  rm -rf "$dest"
  mkdir -p "$dest"
  rsync -a --exclude node_modules --exclude .next --exclude dist --exclude .git \
    "$src/" "$dest/"
}

write_backend_ci() {
  cat > "$BACKEND_OUT/.github/workflows/ci.yml" <<'EOF'
name: CI

on:
  push:
    branches: [main, master, develop]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - run: npm ci
      - run: npm run prisma:generate
      - run: npm run check:no-mock
      - run: npm run build
      - run: npm test
EOF
}

write_web_ci() {
  cat > "$WEB_OUT/.github/workflows/ci.yml" <<'EOF'
name: CI

on:
  push:
    branches: [main, master, develop]
  pull_request:

jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - run: npm ci
      - run: npm run check:no-mock
      - run: npm run lint
      - run: npm run build
EOF
}

write_app_ci() {
  cat > "$APP_OUT/.github/workflows/ci.yml" <<'EOF'
name: CI

on:
  push:
    branches: [main, master, develop]
  pull_request:

jobs:
  mobile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with:
          channel: stable
          cache: true
      - run: dart run tool/theme/generate_flutter_tokens.dart
      - run: flutter pub get
      - run: flutter analyze
      - run: flutter test
      - run: flutter build apk --release --dart-define=API_URL=https://legal-api.odaflow.com/api/v1
EOF
}

setup_app_theme() {
  mkdir -p "$APP_OUT/tool/theme"
  cp "$ROOT/shared/theme/tokens.json" "$APP_OUT/tool/theme/tokens.json"
  cat > "$APP_OUT/tool/theme/generate_flutter_tokens.dart" <<'DART'
// ignore_for_file: avoid_print
/// Generates lib/core/theme/theme_tokens.dart from tool/theme/tokens.json
/// Run from legal_app root: dart run tool/theme/generate_flutter_tokens.dart
import 'dart:convert';
import 'dart:io';

void main() {
  final root = Directory.current;
  final tokensFile = File('${root.path}/tool/theme/tokens.json');
  final outputFile = File('${root.path}/lib/core/theme/theme_tokens.dart');
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
/// Source: tool/theme/tokens.json
/// Regenerate: dart run tool/theme/generate_flutter_tokens.dart
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
DART
}

init_git_repo() {
  local dir="$1"
  local msg="$2"
  cd "$dir"
  git init -b main
  git add -A
  git commit -m "$msg"
}

split_with_filter_repo() {
  local prefix="$1"
  local out="$2"
  local tmp="$PARENT/.split-work-$$"
  rm -rf "$tmp"
  git clone "$ROOT" "$tmp"
  cd "$tmp"
  git filter-repo --path "$prefix" --path-rename "${prefix}/:" --force
  rm -rf "$out"
  mv "$tmp" "$out"
  rm -rf "$PARENT/.split-work-$$" 2>/dev/null || true
}

echo "==> Splitting from $ROOT"

if command -v git-filter-repo >/dev/null 2>&1; then
  echo "Using git-filter-repo (preserves history)"
  split_with_filter_repo "legal_backend" "$BACKEND_OUT"
  split_with_filter_repo "legal_web" "$WEB_OUT"
  split_with_filter_repo "legal_app" "$APP_OUT"
else
  echo "git-filter-repo not found — copying trees without history (brew install git-filter-repo for history)"
  copy_tree "$ROOT/legal_backend" "$BACKEND_OUT"
  copy_tree "$ROOT/legal_web" "$WEB_OUT"
  copy_tree "$ROOT/legal_app" "$APP_OUT"
  init_git_repo "$BACKEND_OUT" "Initial import: legal backend from monorepo"
  init_git_repo "$WEB_OUT" "Initial import: legal web from monorepo"
  init_git_repo "$APP_OUT" "Initial import: legal app from monorepo"
fi

mkdir -p "$BACKEND_OUT/.github/workflows"
mkdir -p "$WEB_OUT/.github/workflows"
mkdir -p "$APP_OUT/.github/workflows"
write_backend_ci
write_web_ci
write_app_ci
setup_app_theme

# Backend: drop cross-repo contract tests (or re-add via OpenAPI later)
rm -f "$BACKEND_OUT/test/contract/web-api-paths.spec.ts" \
      "$BACKEND_OUT/test/contract/mobile-api-paths.spec.ts" 2>/dev/null || true

if command -v git-filter-repo >/dev/null 2>&1; then
  for dir in "$BACKEND_OUT" "$WEB_OUT" "$APP_OUT"; do
    cd "$dir"
    git add -A
    git diff --cached --quiet || git commit -m "chore: split CI and decouple monorepo paths"
  done
fi

echo ""
echo "Done. Output repos:"
echo "  $BACKEND_OUT"
echo "  $WEB_OUT"
echo "  $APP_OUT"
echo ""
echo "Next: create GitHub repos and push (see SPLIT-REPOS.md)"
