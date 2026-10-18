import 'package:flutter/material.dart';

/// Umbrella wordmark for dark / brand-blue backgrounds.
class UmbrellaLogo extends StatelessWidget {
  const UmbrellaLogo({
    super.key,
    this.height = 36,
    this.semanticLabel = 'Umbrella',
  });

  final double height;
  final String semanticLabel;

  static const String _darkWordmarkAsset =
      'assets/images/umbrella_logo_dark.png';

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: semanticLabel,
      image: true,
      child: Image.asset(
        _darkWordmarkAsset,
        height: height,
        fit: BoxFit.contain,
        filterQuality: FilterQuality.high,
        errorBuilder: (_, __, ___) => Image.asset(
          'assets/images/umbrella_logo.png',
          height: height,
          fit: BoxFit.contain,
        ),
      ),
    );
  }
}
