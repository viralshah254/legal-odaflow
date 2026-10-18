import 'dart:async';
import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_config.dart';
import '../firebase/firebase_service.dart';
import '../models/models.dart';
import '../pricing/local_pricing.dart';
import '../network/api_client.dart';
import '../network/alerts_api.dart';
import '../network/ai_api.dart';
import '../network/agents_api.dart';
import '../network/auth_api.dart';
import '../network/billing_api.dart';
import '../network/calendar_api.dart';
import '../network/credits_api.dart';
import '../network/clients_api.dart';
import '../network/conflicts_api.dart';
import '../network/consumers_api.dart';
import '../network/documents_api.dart';
import '../network/draft_jobs_api.dart';
import '../network/india_drafting_api.dart';
import '../network/marketplace_api.dart';
import '../network/matters_api.dart';
import '../network/notifications_api.dart';
import '../network/payments_api.dart';
import '../network/profile_api.dart';
import '../network/pricing_api.dart';
import '../network/tasks_api.dart';
import '../network/time_api.dart';
import '../network/training_consent_api.dart';
import '../network/gdpr_api.dart';
import '../network/copilot_api.dart';
import '../network/subscriptions_api.dart';
import '../network/matter_outcome_api.dart';
import '../network/matter_analysis_api.dart';
import '../network/meetings_api.dart';
import '../geo/detect_country_service.dart';
import '../storage/token_storage.dart';
import '../providers/locale_provider.dart';
import '../auth/firebase_auth_errors.dart';
import '../auth/oauth_auth_service.dart';
import '../../features/credits/credits_repository.dart';
import '../../features/consumer/issue_checker/issue_checker_constants.dart';

final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref.watch(tokenStorageProvider));
});

final authApiProvider = Provider<AuthApi>((ref) {
  return AuthApi(ref.watch(apiClientProvider));
});

final oauthAuthServiceProvider = Provider<OAuthAuthService>((ref) {
  return OAuthAuthService(ref.watch(authApiProvider));
});

final profileApiProvider = Provider<ProfileApi>((ref) {
  return ProfileApi(ref.watch(apiClientProvider));
});

final consumersApiProvider = Provider<ConsumersApi>((ref) {
  return ConsumersApi(ref.watch(apiClientProvider));
});

final issueCheckerSessionStorageProvider =
    FutureProvider<IssueCheckerSessionStorage>((ref) async {
  final prefs = await SharedPreferences.getInstance();
  return IssueCheckerSessionStorage(prefs);
});

final gdprApiProvider = Provider<GdprApi>((ref) {
  return GdprApi(ref.watch(apiClientProvider));
});

final clientsApiProvider = Provider<ClientsApi>((ref) {
  return ClientsApi(ref.watch(apiClientProvider));
});

final conflictsApiProvider = Provider<ConflictsApi>((ref) {
  return ConflictsApi(ref.watch(apiClientProvider));
});

final billingApiProvider = Provider<BillingApi>((ref) {
  return BillingApi(ref.watch(apiClientProvider));
});

final detectCountryServiceProvider = Provider<DetectCountryService>((ref) {
  return DetectCountryService(ref.watch(apiClientProvider));
});

/// Detected location — runs once on app startup and caches the result.
/// Both Legal Research and Client Intake read from this provider instead of
/// calling DetectCountryService directly, ensuring detection runs only once.
final detectedLocationProvider = FutureProvider<DetectedCountry>((ref) async {
  final detected = await ref.read(detectCountryServiceProvider).detectCountry();
  return detected;
});

final creditsRepositoryProvider = Provider<CreditsRepository>((ref) {
  return CreditsRepository(ref.watch(apiClientProvider));
});

final creditWalletProvider = FutureProvider<CreditWalletView>((ref) async {
  final user = ref.watch(authControllerProvider).session?.user;
  if (user == null) {
    throw StateError('Not authenticated');
  }
  return ref.watch(creditsRepositoryProvider).loadForUser(user);
});

final consumerCreditPacksProvider =
    FutureProvider.family<List<CreditPack>, String>((ref, countryCode) async {
  try {
    final snapshot = await ref
        .watch(creditsRepositoryProvider)
        .getConsumerCredits();
    if (snapshot.packs.isNotEmpty) {
      return snapshot.packs;
    }
  } catch (_) {
    // Fall through to offline FX-aligned packs.
  }
  return fallbackCreditPacks(countryCode);
});

final documentsApiProvider = Provider<DocumentsApi>((ref) {
  return DocumentsApi(ref.watch(apiClientProvider));
});

final mattersApiProvider = Provider<MattersApi>((ref) {
  return MattersApi(ref.watch(apiClientProvider));
});

/// Increment to refetch the matters list (e.g. bottom nav re-tap).
final mattersListRefreshProvider = StateProvider<int>((ref) => 0);

final marketplaceApiProvider = Provider<MarketplaceApi>((ref) {
  return MarketplaceApi(ref.watch(apiClientProvider));
});

final notificationsApiProvider = Provider<NotificationsApi>((ref) {
  return NotificationsApi(ref.watch(apiClientProvider));
});

final tasksApiProvider = Provider<TasksApi>((ref) {
  return TasksApi(ref.watch(apiClientProvider));
});

final calendarApiProvider = Provider<CalendarApi>((ref) {
  return CalendarApi(ref.watch(apiClientProvider));
});

final timeApiProvider = Provider<TimeApi>((ref) {
  return TimeApi(ref.watch(apiClientProvider));
});

final alertsApiProvider = Provider<AlertsApi>((ref) {
  return AlertsApi(ref.watch(apiClientProvider));
});

final paymentsApiProvider = Provider<PaymentsApi>((ref) {
  return PaymentsApi(ref.watch(apiClientProvider));
});

final trainingConsentApiProvider = Provider<TrainingConsentApi>((ref) {
  return TrainingConsentApi(ref.watch(apiClientProvider));
});

final pricingApiProvider = Provider<PricingApi>((ref) {
  return PricingApi(ref.watch(apiClientProvider));
});

final aiApiProvider = Provider<AiApi>((ref) {
  return AiApi(ref.watch(apiClientProvider));
});

final agentsApiProvider = Provider<AgentsApi>((ref) {
  return AgentsApi(ref.watch(apiClientProvider));
});

final draftJobsApiProvider = Provider<DraftJobsApi>((ref) {
  return DraftJobsApi(ref.watch(apiClientProvider));
});

final indiaDraftingApiProvider = Provider<IndiaDraftingApi>((ref) {
  return IndiaDraftingApi(ref.watch(apiClientProvider));
});

final creditsApiProvider = Provider<CreditsApi>((ref) {
  return CreditsApi(ref.watch(apiClientProvider));
});

final subscriptionsApiProvider = Provider<SubscriptionsApi>((ref) {
  return SubscriptionsApi(ref.watch(apiClientProvider));
});

final copilotApiProvider = Provider<CopilotApi>((ref) {
  return CopilotApi(ref.watch(apiClientProvider));
});

final matterOutcomeApiProvider = Provider<MatterOutcomeApi>((ref) {
  return MatterOutcomeApi(ref.watch(apiClientProvider));
});

final matterAnalysisApiProvider = Provider<MatterAnalysisApi>((ref) {
  return MatterAnalysisApi(ref.watch(apiClientProvider));
});

final meetingsApiProvider = Provider<MeetingsApi>((ref) {
  return MeetingsApi(ref.watch(apiClientProvider));
});

class AuthState {
  const AuthState({this.session, this.isBootstrapping = true});

  final AuthSession? session;
  final bool isBootstrapping;

  AuthUser? get user => session?.user;

  AuthState copyWith({
    AuthSession? session,
    bool? isBootstrapping,
    bool clearSession = false,
  }) {
    return AuthState(
      session: clearSession ? null : session ?? this.session,
      isBootstrapping: isBootstrapping ?? this.isBootstrapping,
    );
  }
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._ref) : super(const AuthState()) {
    _listenForFcmRefresh();
    bootstrap();
  }

  final Ref _ref;
  StreamSubscription<String>? _fcmRefreshSub;

  TokenStorage get _storage => _ref.read(tokenStorageProvider);
  AuthApi get _authApi => _ref.read(authApiProvider);
  NotificationsApi get _notificationsApi => _ref.read(notificationsApiProvider);

  Future<void> _registerFcmIfAvailable() async {
    final token = await FirebaseService.getFcmToken();
    if (token == null || token.isEmpty) return;
    try {
      await _notificationsApi.registerDevice(fcmToken: token);
    } catch (_) {
      // FCM registration is best-effort when Firebase is configured.
    }
  }

  void _listenForFcmRefresh() {
    if (!FirebaseService.isConfigured ||
        !FirebaseService.isInitialized ||
        !AppConfig.enablePushNotifications) {
      return;
    }
    _fcmRefreshSub?.cancel();
    _fcmRefreshSub = FirebaseMessaging.instance.onTokenRefresh.listen((
      token,
    ) async {
      if (state.session == null || token.isEmpty) return;
      try {
        await _notificationsApi.registerDevice(fcmToken: token);
      } catch (_) {
        // Best-effort token refresh registration.
      }
    });
  }

  @override
  void dispose() {
    _fcmRefreshSub?.cancel();
    super.dispose();
  }

  Future<void> _hydrateLocaleFromServer(AuthUser user) async {
    try {
      final prefs = await _ref.read(profileApiProvider).getMyPreferences();
      final preferredLocale = prefs['preferredLocale'] as String?;
      final countryCode = user.countryCode ?? AppConfig.defaultCountry;
      await _ref.read(localeProvider.notifier).hydrateFromServer(
            preferredLocale: preferredLocale,
            countryCode: countryCode,
          );
    } catch (_) {
      // Non-blocking — local locale remains in effect.
    }
  }

  Future<void> bootstrap() async {
    final accessToken = await _storage.getAccessToken();
    final refreshToken = await _storage.getRefreshToken();
    final userJson = await _storage.getUserJson();

    if (accessToken == null ||
        refreshToken == null ||
        userJson == null ||
        userJson.isEmpty) {
      state = state.copyWith(isBootstrapping: false, clearSession: true);
      return;
    }

    final user = AuthUser.fromJson(
      jsonDecode(userJson) as Map<String, dynamic>,
    );

    state = state.copyWith(
      session: AuthSession(
        accessToken: accessToken,
        refreshToken: refreshToken,
        user: user,
      ),
      isBootstrapping: false,
    );
    await _hydrateLocaleFromServer(user);
    await _registerFcmIfAvailable();
  }

  Future<void> login({required String email, required String password}) async {
    final session = await _authApi.login(email: email, password: password);
    await establishSession(session);
  }

  Future<void> loginWithFirebase({
    required String idToken,
    String? userType,
    String? countryCode,
    String? jurisdiction,
    String? name,
    String? firmName,
    String? phone,
    String? referralCode,
    String? deviceFingerprint,
  }) async {
    final session = await _authApi.loginWithFirebase(
      idToken: idToken,
      userType: userType,
      countryCode: countryCode,
      jurisdiction: jurisdiction,
      name: name,
      firmName: firmName,
      phone: phone,
      referralCode: referralCode,
      deviceFingerprint: deviceFingerprint,
    );
    await establishSession(session);
  }

  Future<void> register({
    required String email,
    required String password,
    required String userType,
    required String countryCode,
    String? name,
    String? firmName,
    String? phone,
    String? jurisdiction,
    String? deviceFingerprint,
  }) async {
    final session = await _authApi.register(
      email: email,
      password: password,
      userType: userType,
      countryCode: countryCode,
      name: name,
      firmName: firmName,
      phone: phone,
      jurisdiction: jurisdiction,
      deviceFingerprint: deviceFingerprint,
    );
    await establishSession(session);
  }

  /// Firebase-first email signup mirroring web: create Firebase user, then
  /// exchange ID token with backend. Falls back to direct register when
  /// Firebase Email/Password is unavailable.
  Future<void> registerWithEmail({
    required String email,
    required String password,
    required String userType,
    required String countryCode,
    String? name,
    String? firmName,
    String? phone,
    String? jurisdiction,
    String? referralCode,
    String? deviceFingerprint,
  }) async {
    final auth = FirebaseService.auth;
    if (auth != null) {
      try {
        await auth.createUserWithEmailAndPassword(
          email: email.trim(),
          password: password,
        );
        final idToken = await FirebaseService.getIdToken();
        if (idToken == null || idToken.isEmpty) {
          throw StateError('Missing Firebase ID token after signup.');
        }
        await loginWithFirebase(
          idToken: idToken,
          userType: userType,
          countryCode: countryCode,
          jurisdiction: jurisdiction,
          name: name,
          firmName: firmName,
          phone: phone,
          referralCode: referralCode,
          deviceFingerprint: deviceFingerprint,
        );
        return;
      } on FirebaseAuthException catch (error) {
        if (!isFirebaseAuthUnavailable(error)) rethrow;
      }
    }

    await register(
      email: email,
      password: password,
      userType: userType,
      countryCode: countryCode,
      name: name,
      firmName: firmName,
      phone: phone,
      jurisdiction: jurisdiction,
      deviceFingerprint: deviceFingerprint,
    );
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final session = await _authApi.changePassword(
      currentPassword: currentPassword,
      newPassword: newPassword,
    );
    await establishSession(session);
  }

  Future<void> sendPasswordResetEmail(String email) async {
    await FirebaseService.sendPasswordResetEmail(email);
  }

  /// Persists tokens and hydrates locale after OAuth or external session handoff.
  Future<void> establishSession(AuthSession session) async {
    await _persistSession(session);
    await _hydrateLocaleFromServer(session.user);
    await _registerFcmIfAvailable();
    state = AuthState(session: session, isBootstrapping: false);
  }

  Future<void> _persistSession(AuthSession session) async {
    await _storage.saveTokens(
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      userJson: jsonEncode(session.user.toJson()),
    );
    // Keep local storage in sync with the server-authoritative country so that
    // countryCodeProvider (and the language picker) always reflects the real
    // jurisdiction, even before the auth controller is fully initialized.
    final country = session.user.countryCode;
    if (country != null && country.isNotEmpty) {
      await _storage.saveCountryCode(country);
    }
  }

  /// Updates the user's country on the server, refreshes the local session,
  /// and resets the locale if the current one is invalid for the new country.
  Future<void> updateCountry(String code) async {
    final profileApi = _ref.read(profileApiProvider);
    await profileApi.updateMe(countryCode: code);

    // Fetch fresh user data from server.
    final raw = await profileApi.getMe();
    final existing = state.session?.user;

    final updatedUser = AuthUser(
      id: raw['id'] as String? ?? existing!.id,
      email: raw['email'] as String? ?? existing!.email,
      name: raw['name'] as String? ?? existing?.name,
      userType: raw['userType'] as String? ?? existing!.userType,
      countryCode: raw['countryCode'] as String? ?? code,
      tenantId: existing?.tenantId,
      tenantRole: existing?.tenantRole,
      mustChangePassword:
          raw['mustChangePassword'] as bool? ?? existing?.mustChangePassword ?? false,
    );

    await _storage.saveTokens(
      accessToken: state.session!.accessToken,
      refreshToken: state.session!.refreshToken,
      userJson: jsonEncode(updatedUser.toJson()),
    );
    await _storage.saveCountryCode(updatedUser.countryCode ?? code);
    _ref.invalidate(countryCodeProvider);

    state = state.copyWith(
      session: AuthSession(
        accessToken: state.session!.accessToken,
        refreshToken: state.session!.refreshToken,
        user: updatedUser,
      ),
    );

    // Ensure the active locale is still valid for the new country.
    await _ref
        .read(localeProvider.notifier)
        .ensureValidForCountry(updatedUser.countryCode ?? code);
  }

  Future<void> logout() async {
    final refreshToken = state.session?.refreshToken;
    if (refreshToken != null) {
      try {
        await _authApi.logout(refreshToken: refreshToken);
      } catch (_) {
        // Ignore logout API failures and clear local session anyway.
      }
    }
    await _storage.clearTokens();
    state = const AuthState(isBootstrapping: false);
  }
}

final authControllerProvider = StateNotifierProvider<AuthController, AuthState>(
  (ref) {
    return AuthController(ref);
  },
);

final countryCodeProvider = FutureProvider<String?>((ref) async {
  // Server-authoritative country from the auth session takes precedence so that
  // the language picker always shows the correct locale list for the user's
  // actual jurisdiction (e.g. IN → 13 languages, not just en/fr/de).
  final sessionCountry = ref.watch(authControllerProvider).session?.user.countryCode;
  if (sessionCountry != null && sessionCountry.isNotEmpty) return sessionCountry;
  // Pre-auth path: country was saved to local storage during onboarding.
  return ref.watch(tokenStorageProvider).getCountryCode();
});
