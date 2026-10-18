import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/oauth_auth_service.dart';
import '../../../core/auth/profile_completion.dart';
import '../../../core/auth/sign_up_metadata.dart';
import '../../../core/auth/sign_up_phone.dart';
import '../../../core/config/app_config.dart';
import '../../../core/device/device_id.dart';
import '../../../core/firebase/firebase_service.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../auth_navigation.dart';
import 'auth_error_banner.dart';
import 'sign_up_jurisdiction_field.dart';
import 'sign_up_phone_field.dart';

class OAuthProfileCompletionForm extends ConsumerStatefulWidget {
  const OAuthProfileCompletionForm({
    super.key,
    required this.profile,
    this.referralCode,
    required this.onComplete,
    required this.onCancel,
  });

  final OAuthProfileCompletionState profile;
  final String? referralCode;
  final VoidCallback onComplete;
  final VoidCallback onCancel;

  @override
  ConsumerState<OAuthProfileCompletionForm> createState() =>
      _OAuthProfileCompletionFormState();
}

class _OAuthProfileCompletionFormState
    extends ConsumerState<OAuthProfileCompletionForm> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _firmNameController = TextEditingController();
  final _phoneController = TextEditingController();

  var _accountType = 'CONSUMER';
  var _practiceType = 'FIRM';
  var _countryCode = AppConfig.defaultCountry;
  String? _jurisdiction;
  var _jurisdictionManuallySet = false;
  var _phoneCountryCode = AppConfig.defaultCountry;
  var _phoneCountryManuallySet = false;
  String? _phoneError;
  var _locationLoading = false;
  var _isSubmitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.profile.name != null && widget.profile.name!.isNotEmpty) {
      _nameController.text = widget.profile.name!;
    }
    _loadStoredCountry();
    _detectLocation();
  }

  Future<void> _loadStoredCountry() async {
    final stored = await ref.read(tokenStorageProvider).getCountryCode();
    if (stored == null || !mounted) return;
    if (AppConfig.supportedCountryCodes.contains(stored)) {
      setState(() {
        _countryCode = stored;
        if (!_phoneCountryManuallySet) {
          _phoneCountryCode = stored;
        }
      });
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _firmNameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _detectLocation() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _locationLoading = true;
      _error = null;
    });
    try {
      final detected =
          await ref.read(detectCountryServiceProvider).detectCountry();
      if (!AppConfig.supportedCountryCodes.contains(detected.countryCode)) {
        setState(() {
          _error = l10n.authNotAvailableInCountry(detected.countryName);
        });
        return;
      }
      await ref
          .read(tokenStorageProvider)
          .saveCountryCode(detected.countryCode);
      setState(() {
        _countryCode = detected.countryCode;
        if (!_phoneCountryManuallySet) {
          _phoneCountryCode = detected.countryCode;
        }
        if (!_jurisdictionManuallySet &&
            detected.jurisdiction != null &&
            detected.jurisdiction!.isNotEmpty) {
          _jurisdiction = detected.jurisdiction;
        }
      });
    } catch (_) {
      setState(() => _error = l10n.authUnableToCheckLocation);
    } finally {
      if (mounted) setState(() => _locationLoading = false);
    }
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    if (!_formKey.currentState!.validate()) {
      setState(() => _error = l10n.errorsValidationFailed);
      return;
    }

    final phoneResult = resolveSignUpPhone(
      _phoneCountryCode,
      _phoneController.text,
    );
    late final String resolvedPhone;
    switch (phoneResult) {
      case SignUpPhoneFailure(:final error):
        setState(() {
          _phoneError = error == SignUpPhoneError.required
              ? l10n.authPhoneRequired
              : l10n.authInvalidPhone;
          _error = _phoneError;
        });
        return;
      case SignUpPhoneSuccess(:final phone):
        resolvedPhone = phone;
    }

    final metadataError = validateSignUpMetadata(
      accountType: _accountType,
      practiceType: _practiceType,
      firmName: _firmNameController.text,
      countryCode: _countryCode,
      confirmCountryMessage: l10n.authConfirmCountryBeforeAccount,
      firmNameRequiredMessage: l10n.authFirmNameRequired,
    );
    if (metadataError != null) {
      setState(() => _error = metadataError);
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
      _phoneError = null;
    });

    try {
      final idToken = await FirebaseService.getIdToken();
      if (idToken == null || idToken.isEmpty) {
        throw StateError(l10n.authSocialSessionExpired);
      }

      final resolvedFirmName = resolveFirmName(
        accountType: _accountType,
        practiceType: _practiceType,
        firmName: _firmNameController.text,
        name: _nameController.text,
        defaultPracticeName: l10n.authMyPractice,
      );

      final deviceFingerprint = await getDeviceId();
      final jurisdiction = _jurisdiction?.trim();
      final outcome = await ref.read(oauthAuthServiceProvider).completeProfile(
            idToken: idToken,
            provider: widget.profile.provider,
            userType: _accountType,
            countryCode: _countryCode,
            jurisdiction: jurisdiction != null && jurisdiction.isNotEmpty
                ? jurisdiction
                : null,
            name: _nameController.text.trim().isEmpty
                ? null
                : _nameController.text.trim(),
            firmName: resolvedFirmName,
            phone: resolvedPhone,
            deviceFingerprint: deviceFingerprint,
            referralCode: widget.referralCode,
          );

      switch (outcome) {
        case OAuthAuthenticated(:final session):
          await ref.read(authControllerProvider.notifier).establishSession(session);
          if (!mounted) return;
          ref.invalidate(countryCodeProvider);
          navigateAfterAuth(context, session.user);
        case OAuthProfileCompletionNeeded():
          setState(() => _error = l10n.authUnableToCreateAccount);
      }
    } on ApiException catch (error) {
      setState(() => _error = error.message);
    } catch (_) {
      setState(() => _error = l10n.authUnableToCreateAccount);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            l10n.authCompleteSignUp,
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            l10n.authCompleteProfileDescription,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: AppColors.mutedForegroundLight,
            ),
          ),
          const SizedBox(height: 20),
          if (_error != null) ...[
            AuthErrorBanner(message: _error!),
            const SizedBox(height: 16),
          ],
          TextFormField(
            initialValue: widget.profile.email,
            readOnly: true,
            enabled: false,
            decoration: InputDecoration(
              labelText: l10n.authEmail,
              prefixIcon: const Icon(Icons.email_outlined),
            ),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _nameController,
            textCapitalization: TextCapitalization.words,
            decoration: InputDecoration(
              labelText: l10n.authFullNameOptional,
              prefixIcon: const Icon(Icons.person_outline),
            ),
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: _accountType,
            decoration: InputDecoration(
              labelText: l10n.authAccountType,
              prefixIcon: const Icon(Icons.badge_outlined),
            ),
            items: [
              DropdownMenuItem(
                value: 'CONSUMER',
                child: Text(l10n.authConsumerOption),
              ),
              DropdownMenuItem(
                value: 'LAWYER',
                child: Text(l10n.authLawyerOption),
              ),
            ],
            onChanged: _isSubmitting
                ? null
                : (value) {
                    if (value == null) return;
                    setState(() => _accountType = value);
                  },
          ),
          if (_accountType == 'LAWYER') ...[
            const SizedBox(height: 16),
            Text(
              l10n.authHowDoYouPractice,
              style: theme.textTheme.titleSmall,
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _PracticeTypeChip(
                    selected: _practiceType == 'SOLO',
                    title: l10n.authJustMe,
                    subtitle: l10n.authSoloIndependent,
                    onTap: _isSubmitting
                        ? null
                        : () => setState(() => _practiceType = 'SOLO'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _PracticeTypeChip(
                    selected: _practiceType == 'FIRM',
                    title: l10n.authLawFirm,
                    subtitle: l10n.authTeamOfLawyers,
                    onTap: _isSubmitting
                        ? null
                        : () => setState(() => _practiceType = 'FIRM'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _firmNameController,
              decoration: InputDecoration(
                labelText: _practiceType == 'FIRM'
                    ? l10n.authFirmName
                    : l10n.authPracticeNameOptional,
                hintText: _practiceType == 'SOLO'
                    ? l10n.authDefaultsToYourName
                    : null,
                prefixIcon: const Icon(Icons.business_outlined),
              ),
              validator: (value) {
                if (_accountType != 'LAWYER' || _practiceType != 'FIRM') {
                  return null;
                }
                if (value == null || value.trim().length < 2) {
                  return l10n.authFirmNameRequired;
                }
                return null;
              },
            ),
            if (_practiceType == 'SOLO') ...[
              const SizedBox(height: 8),
              Text(
                l10n.authSoloWorkspaceHint,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.mutedForegroundLight,
                ),
              ),
            ],
          ],
          const SizedBox(height: 16),
          Text(
            l10n.authCountryJurisdiction,
            style: theme.textTheme.titleSmall,
          ),
          const SizedBox(height: 8),
          if (_locationLoading)
            const LinearProgressIndicator(minHeight: 4)
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: AppConfig.supportedCountryCodes.map((code) {
                final selected = _countryCode == code;
                return ChoiceChip(
                  label: Text(AppConfig.countryNames[code] ?? code),
                  selected: selected,
                  onSelected: _isSubmitting
                      ? null
                      : (value) async {
                          if (!value) return;
                          await ref
                              .read(tokenStorageProvider)
                              .saveCountryCode(code);
                          setState(() {
                            _countryCode = code;
                            _jurisdictionManuallySet = true;
                            _jurisdiction = null;
                            if (!_phoneCountryManuallySet) {
                              _phoneCountryCode = code;
                            }
                          });
                        },
                );
              }).toList(),
            ),
          const SizedBox(height: 8),
          TextButton.icon(
            onPressed: _locationLoading || _isSubmitting
                ? null
                : _detectLocation,
            icon: const Icon(Icons.my_location_outlined, size: 18),
            label: Text(l10n.authCheckDeviceLocation),
          ),
          const SizedBox(height: 12),
          SignUpJurisdictionField(
            countryCode: _countryCode,
            jurisdiction: _jurisdiction,
            enabled: !_isSubmitting,
            onChanged: (value) {
              setState(() {
                _jurisdictionManuallySet = true;
                _jurisdiction = value;
              });
            },
          ),
          const SizedBox(height: 16),
          SignUpPhoneField(
            phoneCountryCode: _phoneCountryCode,
            phoneController: _phoneController,
            errorText: _phoneError,
            enabled: !_isSubmitting,
            onCountryChanged: (code) {
              setState(() {
                _phoneCountryManuallySet = true;
                _phoneCountryCode = code;
              });
            },
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _isSubmitting ? null : _submit,
            child: Text(
              _isSubmitting
                  ? l10n.authCreatingAccountProgress
                  : l10n.authCompleteSignUp,
            ),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: _isSubmitting ? null : widget.onCancel,
            child: Text(l10n.commonCancel),
          ),
        ],
      ),
    );
  }
}

class _PracticeTypeChip extends StatelessWidget {
  const _PracticeTypeChip({
    required this.selected,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final bool selected;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.primary;
    return Material(
      color: selected ? color.withValues(alpha: 0.08) : null,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppColors.radius),
        side: BorderSide(
          color: selected ? color : Theme.of(context).dividerColor,
          width: selected ? 1.5 : 1,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppColors.radius),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: selected ? color : null,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.mutedForegroundLight,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
