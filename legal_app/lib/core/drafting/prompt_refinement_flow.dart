import 'package:flutter/material.dart';

import '../network/ai_api.dart';
import '../../features/lawyer/docu_draft/widgets/prompt_refine_sheet.dart';

/// Calls the refine API and optionally shows the preview sheet.
/// Returns null when the user dismisses the sheet without continuing.
Future<String?> runPromptRefinementFlow({
  required BuildContext context,
  required AiApi ai,
  required String prompt,
  required String purpose,
  String? tenantId,
  String? countryCode,
  String? jurisdiction,
  String? practiceArea,
  String? outputLanguage,
  List<String>? knowledgeSources,
}) async {
  final trimmed = prompt.trim();
  if (trimmed.isEmpty) return null;

  try {
    final result = await ai.refinePrompt(
      prompt: trimmed,
      purpose: purpose,
      tenantId: tenantId,
      countryCode: countryCode,
      jurisdiction: jurisdiction,
      practiceArea: practiceArea,
      outputLanguage: outputLanguage,
      knowledgeSources: knowledgeSources,
    );

    if (result.skipped || !context.mounted) {
      return trimmed;
    }

    return await showPromptRefineSheet(
      context: context,
      originalPrompt: result.originalPrompt,
      refinedPrompt: result.refinedPrompt,
      hints: result.hints,
    );
  } catch (_) {
    return trimmed;
  }
}
