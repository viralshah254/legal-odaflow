import 'package:firebase_auth/firebase_auth.dart' as fb_auth;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/firebase_auth_errors.dart';
import '../../core/auth/password_breach.dart';
import '../../core/auth/password_policy.dart';
import '../../core/auth/sign_up_metadata.dart';
import '../../core/auth/referral_storage.dart';
import '../../core/auth/sign_up_phone.dart';
import '../../core/config/app_config.dart';
import '../../core/device/device_id.dart';
import '../../core/network/api_client.dart';
import '../../core/providers/app_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../l10n/app_localizations.dart';
import 'auth_navigation.dart';
import 'widgets/auth_choice_card.dart';
import 'widgets/auth_error_banner.dart';
import 'widgets/auth_terms_footer.dart';
import 'widgets/sign_up_jurisdiction_field.dart';
import 'widgets/sign_up_phone_field.dart';

enum _AccountPath { individual, lawFirm }

enum _IndividualRole { client, lawyer }

class SignUpScreen extends ConsumerStatefulWidget {
  const SignUpScreen({super.key, this.initialEmail, this.initialReferralCode});

  final String? initialEmail;
  final String? initialReferralCode;

  @override
  ConsumerState<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends ConsumerState<SignUpScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _firmNameController = TextEditingController();
  final _phoneController = TextEditingController();

  var _step = 0;
  var _accountPath = _AccountPath.individual;
  var _individualRole = _IndividualRole.client;
  var _locationLoading = false;
  String? _countryCode;
  String? _countryName;
  String? _jurisdiction;
  var _jurisdictionManuallySet = false;
  var _phoneCountryCode = AppConfig.defaultCountry;
  var _phoneCountryManuallySet = false;
  String? _phoneError;
  String? _referralCode;
  String? _error;
  var _isSubmitting = false;

  static const _lastStep = 1;

  bool get _isLawyer =>
      _accountPath == _AccountPath.lawFirm ||
      _individualRole == _IndividualRole.lawyer;

  bool get _emailLocked =>
      widget.initialEmail != null && widget.initialEmail!.trim().isNotEmpty;

  @override
  void initState() {
    super.initState();
    final email = widget.initialEmail?.trim();
    if (email != null && email.isNotEmpty) {
      _emailController.text = email;
    } else {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.go('/auth');
      });
    }
    _loadStoredCountry();
    _loadReferralCode();
  }

  Future<void> _loadReferralCode() async {
    final urlRef = widget.initialReferralCode;
    if (urlRef != null && urlRef.trim().isNotEmpty) {
      await persistReferralCode(urlRef);
    }
    final resolved = await resolveReferralCode(urlRef);
    if (!mounted || resolved == null) return;
    setState(() => _referralCode = resolved);
  }

  Future<void> _loadStoredCountry() async {
    final stored = await ref.read(tokenStorageProvider).getCountryCode();
    if (stored == null || !mounted) return;
    setState(() {
      _countryCode = stored;
      _countryName = AppConfig.countryNames[stored] ?? stored;
      if (!_phoneCountryManuallySet) {
        _phoneCountryCode = stored;
      }
    });
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _firmNameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _goToStep(int step) {
    final clamped = step.clamp(0, _lastStep);
    setState(() {
      _step = clamped;
      _error = null;
    });
  }

  void _goBack() {
    if (_isSubmitting) return;
    if (_step > 0) {
      _goToStep(_step - 1);
      return;
    }
    context.go('/auth');
  }

  Future<void> _detectLocation() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _locationLoading = true;
      _error = null;
    });

    try {
      final detected = await ref
          .read(detectCountryServiceProvider)
          .detectCountry();
      if (!AppConfig.supportedCountryCodes.contains(detected.countryCode)) {
        setState(() {
          _countryCode = null;
          _countryName = detected.countryName;
          _error = l10n.authNotAvailableInCountry(detected.countryName);
        });
        return;
      }
      await ref
          .read(tokenStorageProvider)
          .saveCountryCode(detected.countryCode);
      setState(() {
        _countryCode = detected.countryCode;
        _countryName = detected.countryName;
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

  Future<void> _selectCountry(String code) async {
    await ref.read(tokenStorageProvider).saveCountryCode(code);
    setState(() {
      _countryCode = code;
      _countryName = AppConfig.countryNames[code] ?? code;
      _error = null;
      _jurisdictionManuallySet = true;
      _jurisdiction = null;
      if (!_phoneCountryManuallySet) {
        _phoneCountryCode = code;
      }
    });
  }

  void _onPhoneCountryChanged(String code) {
    setState(() {
      _phoneCountryManuallySet = true;
      _phoneCountryCode = code;
    });
  }

  void _onJurisdictionChanged(String? value) {
    setState(() {
      _jurisdictionManuallySet = true;
      _jurisdiction = value;
    });
  }

  void _navigateAfterAuth() {
    ref.invalidate(countryCodeProvider);
    final session = ref.read(authControllerProvider).session;
    if (session == null) {
      setState(() => _error = AppLocalizations.of(context).authUnableToCreateAccount);
      return;
    }
    navigateAfterAuth(context, session.user);
  }

  void _navigateToSignIn() {
    context.go('/auth');
  }

  bool _isDuplicateEmailError(String? message, AppLocalizations l10n) {
    if (message == null) return false;
    return message == l10n.authEmailAlreadyInUse ||
        message.toLowerCase().contains('already exists');
  }

  bool _validateProfileForm(AppLocalizations l10n) {
    final formState = _formKey.currentState;
    if (formState == null) {
      setState(() => _error = l10n.errorsValidationFailed);
      return false;
    }
    if (!formState.validate()) {
      setState(() => _error = l10n.errorsValidationFailed);
      return false;
    }
    return true;
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    final countryCode = _countryCode;
    if (countryCode == null || countryCode.isEmpty) {
      setState(() => _error = l10n.authConfirmCountryBeforeAccount);
      return;
    }

    if (!_validateProfileForm(l10n)) return;

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
    setState(() => _phoneError = null);

    final userType = _isLawyer ? 'LAWYER' : 'CONSUMER';
    final firmName = _accountPath == _AccountPath.lawFirm
        ? _firmNameController.text.trim()
        : null;

    final metadataError = validateSignUpMetadata(
      accountType: userType,
      practiceType: _accountPath == _AccountPath.lawFirm ? 'FIRM' : 'SOLO',
      firmName: firmName,
      countryCode: countryCode,
      confirmCountryMessage: l10n.authConfirmCountryBeforeAccount,
      firmNameRequiredMessage: l10n.authFirmNameRequired,
    );
    if (metadataError != null) {
      setState(() => _error = metadataError);
      return;
    }

    final passwordContext = PasswordPolicyContext(
      email: _emailController.text.trim(),
      name: _nameController.text.trim(),
      firmName: firmName,
      phone: resolvedPhone,
    );
    final policyError = firstPasswordPolicyError(
      _passwordController.text,
      l10n,
      context: passwordContext,
    );
    if (policyError != null) {
      setState(() => _error = policyError);
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      if (await isPasswordBreached(_passwordController.text)) {
        setState(() => _error = l10n.authPasswordBreached);
        return;
      }

      final email = _emailController.text.trim();
      try {
        final lookup = await ref.read(authApiProvider).lookupEmail(email);
        if (lookup.exists) {
          setState(() => _error = l10n.authEmailAlreadyInUse);
          return;
        }
      } catch (_) {
        // Lookup is best-effort; Firebase/backend will still reject duplicates.
      }

      final deviceFingerprint = await getDeviceId();
      final resolvedFirmName = resolveFirmName(
        accountType: userType,
        practiceType: _accountPath == _AccountPath.lawFirm ? 'FIRM' : 'SOLO',
        firmName: firmName,
        name: _nameController.text.trim(),
        defaultPracticeName: l10n.authMyPractice,
      );

      final jurisdiction = _jurisdiction?.trim();

      await ref.read(authControllerProvider.notifier).registerWithEmail(
            email: email,
            password: _passwordController.text,
            userType: userType,
            countryCode: countryCode,
            name: _nameController.text.trim().isEmpty
                ? null
                : _nameController.text.trim(),
            firmName: resolvedFirmName,
            phone: resolvedPhone,
            jurisdiction: jurisdiction != null && jurisdiction.isNotEmpty
                ? jurisdiction
                : null,
            referralCode: _referralCode,
            deviceFingerprint: deviceFingerprint,
          );

      if (!mounted) return;
      _navigateAfterAuth();
    } on fb_auth.FirebaseAuthException catch (error) {
      setState(() => _error = mapFirebaseAuthError(error, l10n));
    } on ApiException catch (error) {
      final msg = error.message;
      if (msg.toLowerCase().contains('already registered') ||
          msg.toLowerCase().contains('already exists')) {
        setState(() => _error = l10n.authEmailAlreadyInUse);
      } else {
        setState(() => _error = msg);
      }
    } catch (_) {
      setState(() => _error = l10n.authUnableToCreateAccount);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _continue() {
    if (_step == 0) {
      _goToStep(1);
      return;
    }
    _submit();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final totalSteps = _lastStep + 1;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _goBack();
      },
      child: Scaffold(
      appBar: AppBar(
        title: Text(l10n.authCreateYourProfile),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: _isSubmitting ? null : _goBack,
        ),
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.authStepOf('${_step + 1}', '$totalSteps'),
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                    value: (_step + 1) / totalSteps,
                    minHeight: 6,
                    borderRadius: BorderRadius.circular(AppColors.radius),
                  ),
                ],
              ),
            ),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: _step == 0
                    ? _WorkspaceStep(
                        key: const ValueKey('workspace-step'),
                        selectedPath: _accountPath,
                        selectedRole: _individualRole,
                        onPathSelected: (value) =>
                            setState(() => _accountPath = value),
                        onRoleSelected: (value) =>
                            setState(() => _individualRole = value),
                      )
                    : _ProfileSetupStep(
                        key: const ValueKey('profile-step'),
                        formKey: _formKey,
                        isLawFirm: _accountPath == _AccountPath.lawFirm,
                        emailLocked: _emailLocked,
                        nameController: _nameController,
                        emailController: _emailController,
                        passwordController: _passwordController,
                        confirmPasswordController: _confirmPasswordController,
                        firmNameController: _firmNameController,
                        phoneController: _phoneController,
                        phoneCountryCode: _phoneCountryCode,
                        phoneError: _phoneError,
                        jurisdiction: _jurisdiction,
                        countryCode: _countryCode,
                        locationLoading: _locationLoading,
                        countryName: _countryName,
                        error: _error,
                        showSignInInstead: _isDuplicateEmailError(_error, l10n),
                        onSignInInstead: _navigateToSignIn,
                        onDetect: _detectLocation,
                        onSelectCountry: _selectCountry,
                        onPhoneCountryChanged: _onPhoneCountryChanged,
                        onJurisdictionChanged: _onJurisdictionChanged,
                      ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  if (_step > 0) ...[
                    OutlinedButton(
                      onPressed: _isSubmitting ? null : _goBack,
                      child: Text(l10n.commonBack),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isSubmitting ? null : _continue,
                      child: Text(
                        _step == _lastStep
                            ? (_isSubmitting
                                  ? l10n.authCreatingAccountProgress
                                  : l10n.authCreateAccount)
                            : l10n.commonContinue,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
              child: AuthTermsFooter(prefix: l10n.authSignUpTermsPrefix),
            ),
          ],
        ),
      ),
    ),
    );
  }
}

class _WorkspaceStep extends StatelessWidget {
  const _WorkspaceStep({
    super.key,
    required this.selectedPath,
    required this.selectedRole,
    required this.onPathSelected,
    required this.onRoleSelected,
  });

  final _AccountPath selectedPath;
  final _IndividualRole selectedRole;
  final ValueChanged<_AccountPath> onPathSelected;
  final ValueChanged<_IndividualRole> onRoleSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          l10n.authHowWillYouUse,
          style: theme.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w700,
            height: 1.2,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          l10n.authChooseWorkspace,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: AppColors.mutedForegroundLight,
            height: 1.45,
          ),
        ),
        const SizedBox(height: 24),
        AuthChoiceCard(
          selected: selectedPath == _AccountPath.individual,
          icon: Icons.person_outline,
          title: l10n.authAccountIndividual,
          body: l10n.authAccountIndividualBody,
          badge: l10n.authMostCommon,
          onTap: () => onPathSelected(_AccountPath.individual),
        ),
        const SizedBox(height: 12),
        AuthChoiceCard(
          selected: selectedPath == _AccountPath.lawFirm,
          icon: Icons.business_outlined,
          title: l10n.authAccountLawFirm,
          body: l10n.authAccountLawFirmBody,
          onTap: () => onPathSelected(_AccountPath.lawFirm),
        ),
        if (selectedPath == _AccountPath.individual) ...[
          const SizedBox(height: 28),
          Text(
            l10n.authWhichProfile,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            l10n.authWhichProfileSubtitle,
            style: theme.textTheme.bodySmall?.copyWith(
              color: AppColors.mutedForegroundLight,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 16),
          AuthChoiceCard(
            selected: selectedRole == _IndividualRole.client,
            icon: Icons.support_agent_outlined,
            title: l10n.authNeedLegalHelp,
            body: l10n.authNeedLegalHelpBody,
            onTap: () => onRoleSelected(_IndividualRole.client),
          ),
          const SizedBox(height: 12),
          AuthChoiceCard(
            selected: selectedRole == _IndividualRole.lawyer,
            icon: Icons.gavel_outlined,
            title: l10n.authIAmLawyer,
            body: l10n.authIAmLawyerBody,
            onTap: () => onRoleSelected(_IndividualRole.lawyer),
          ),
        ],
      ],
    );
  }
}

class _ProfileSetupStep extends StatelessWidget {
  const _ProfileSetupStep({
    super.key,
    required this.formKey,
    required this.isLawFirm,
    required this.emailLocked,
    required this.nameController,
    required this.emailController,
    required this.passwordController,
    required this.confirmPasswordController,
    required this.firmNameController,
    required this.phoneController,
    required this.phoneCountryCode,
    required this.phoneError,
    required this.jurisdiction,
    required this.countryCode,
    required this.locationLoading,
    required this.countryName,
    required this.error,
    required this.showSignInInstead,
    required this.onSignInInstead,
    required this.onDetect,
    required this.onSelectCountry,
    required this.onPhoneCountryChanged,
    required this.onJurisdictionChanged,
  });

  final GlobalKey<FormState> formKey;
  final bool isLawFirm;
  final bool emailLocked;
  final TextEditingController nameController;
  final TextEditingController emailController;
  final TextEditingController passwordController;
  final TextEditingController confirmPasswordController;
  final TextEditingController firmNameController;
  final TextEditingController phoneController;
  final String phoneCountryCode;
  final String? phoneError;
  final String? jurisdiction;
  final String? countryCode;
  final bool locationLoading;
  final String? countryName;
  final String? error;
  final bool showSignInInstead;
  final VoidCallback onSignInInstead;
  final VoidCallback onDetect;
  final ValueChanged<String> onSelectCountry;
  final ValueChanged<String> onPhoneCountryChanged;
  final ValueChanged<String?> onJurisdictionChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Form(
      key: formKey,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            l10n.authFinishProfile,
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            l10n.authConfirmLegalRegion,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: AppColors.mutedForegroundLight,
            ),
          ),
          if (error != null) ...[
            const SizedBox(height: 16),
            AuthErrorBanner(message: error!),
            if (showSignInInstead) ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: onSignInInstead,
                  child: Text(l10n.authSignIn),
                ),
              ),
            ],
          ],
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: AppConfig.supportedCountryCodes.map((code) {
              final selected = countryCode == code;
              return ChoiceChip(
                label: Text(AppConfig.countryNames[code] ?? code),
                selected: selected,
                onSelected: (value) {
                  if (value) onSelectCountry(code);
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 8),
          TextButton.icon(
            onPressed: locationLoading ? null : onDetect,
            icon: locationLoading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.my_location_outlined, size: 18),
            label: Text(
              locationLoading
                  ? l10n.authCheckingLocation
                  : l10n.authCheckDeviceLocation,
            ),
          ),
          if (countryName != null) ...[
            const SizedBox(height: 8),
            Text(
              countryCode == null
                  ? countryName!
                  : l10n.authConfirmedJurisdiction(countryCode!),
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.mutedForegroundLight,
              ),
            ),
          ],
          const SizedBox(height: 12),
          SignUpJurisdictionField(
            countryCode: countryCode,
            jurisdiction: jurisdiction,
            onChanged: onJurisdictionChanged,
          ),
          const SizedBox(height: 24),
          if (isLawFirm) ...[
            TextFormField(
              controller: firmNameController,
              decoration: InputDecoration(labelText: l10n.authFirmName),
              validator: (value) {
                if (!isLawFirm) return null;
                if (value == null || value.trim().length < 2) {
                  return l10n.authFirmNameRequired;
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
          ],
          TextFormField(
            controller: nameController,
            decoration: InputDecoration(
              labelText: isLawFirm
                  ? l10n.authAdminFullName
                  : l10n.authFullNameOptional,
            ),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: emailController,
            readOnly: emailLocked,
            enabled: !emailLocked,
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(labelText: l10n.authEmail),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return l10n.authEmailRequired;
              }
              if (!value.contains('@')) return l10n.authEnterValidEmail;
              return null;
            },
          ),
          const SizedBox(height: 16),
          SignUpPhoneField(
            phoneCountryCode: phoneCountryCode,
            phoneController: phoneController,
            errorText: phoneError,
            onCountryChanged: onPhoneCountryChanged,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: passwordController,
            obscureText: true,
            decoration: InputDecoration(labelText: l10n.authPassword),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return l10n.authPasswordRequired;
              }
              return firstPasswordPolicyError(
                value,
                l10n,
                context: PasswordPolicyContext(
                  email: emailController.text.trim(),
                  name: nameController.text.trim(),
                  firmName: isLawFirm ? firmNameController.text.trim() : null,
                  phone: phoneController.text.trim(),
                ),
              );
            },
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: confirmPasswordController,
            obscureText: true,
            decoration: InputDecoration(labelText: l10n.authConfirmPassword),
            validator: (value) {
              if (value != passwordController.text) {
                return l10n.authPasswordsDoNotMatch;
              }
              return null;
            },
          ),
        ],
      ),
    );
  }
}
