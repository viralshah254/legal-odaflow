import 'package:flutter/material.dart';

/// Premium routing is managed by the server; callers retain source compatibility.
class AiModelPicker extends StatelessWidget {
  const AiModelPicker({super.key, this.onChanged, this.initialMode,
    this.initialPremiumModelId, this.compact = false});
  final void Function(String mode, String? premiumModelId)? onChanged;
  final String? initialMode;
  final String? initialPremiumModelId;
  final bool compact;
  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
