import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/auth/phone_countries.dart';
import '../../../l10n/app_localizations.dart';

class SignUpPhoneField extends StatelessWidget {
  const SignUpPhoneField({
    super.key,
    required this.phoneCountryCode,
    required this.phoneController,
    required this.onCountryChanged,
    this.errorText,
    this.enabled = true,
  });

  final String phoneCountryCode;
  final TextEditingController phoneController;
  final ValueChanged<String> onCountryChanged;
  final String? errorText;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final country = PhoneCountries.forIso2(phoneCountryCode);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.authPhone,
          style: Theme.of(context).textTheme.labelLarge,
        ),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 132,
              child: DropdownButtonFormField<String>(
                key: ValueKey(phoneCountryCode),
                initialValue: phoneCountryCode,
                isExpanded: true,
                decoration: const InputDecoration(
                  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
                items: PhoneCountries.all
                    .map(
                      (entry) => DropdownMenuItem(
                        value: entry.iso2,
                        child: Text(
                          '+${entry.dialCode}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(),
                onChanged: enabled
                    ? (value) {
                        if (value != null) onCountryChanged(value);
                      }
                    : null,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextFormField(
                controller: phoneController,
                enabled: enabled,
                keyboardType: TextInputType.phone,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[\d\s\-()+ ]')),
                ],
                decoration: InputDecoration(
                  hintText: country.example,
                  errorText: errorText,
                ),
              ),
            ),
          ],
        ),
        if (errorText == null) ...[
          const SizedBox(height: 6),
          Text(
            l10n.authPhoneHint,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ],
      ],
    );
  }
}
