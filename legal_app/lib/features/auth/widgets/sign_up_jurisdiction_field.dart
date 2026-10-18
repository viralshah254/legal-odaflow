import 'package:flutter/material.dart';

import '../../../core/geo/jurisdiction_options.dart';
import '../../../l10n/app_localizations.dart';

class SignUpJurisdictionField extends StatelessWidget {
  const SignUpJurisdictionField({
    super.key,
    required this.countryCode,
    required this.jurisdiction,
    required this.onChanged,
    this.enabled = true,
  });

  final String? countryCode;
  final String? jurisdiction;
  final ValueChanged<String?> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (!JurisdictionOptions.hasDropdown(countryCode)) {
      return const SizedBox.shrink();
    }

    final options = JurisdictionOptions.forCountry(countryCode)!;
    final selected = jurisdiction != null && jurisdiction!.isNotEmpty
        ? jurisdiction
        : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<String>(
          key: ValueKey('$countryCode-$selected'),
          initialValue: selected != null && options.contains(selected) ? selected : null,
          isExpanded: true,
          decoration: InputDecoration(
            labelText: l10n.lawyerJurisdictionOptional,
            hintText: l10n.lawyerSelectJurisdiction,
          ),
          items: options
              .map(
                (entry) => DropdownMenuItem(
                  value: entry,
                  child: Text(entry, overflow: TextOverflow.ellipsis),
                ),
              )
              .toList(),
          onChanged: enabled ? onChanged : null,
        ),
      ],
    );
  }
}
