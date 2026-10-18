import 'package:dio/dio.dart';

import '../../core/models/models.dart';
import '../../core/network/api_client.dart';

// Per-credit USD value used to translate credit counts to dollar budgets.
// 175 credits × $0.06 = $10.50 = 70% of the $15 Plus plan price.
const double _creditUsdValue = 0.06;

/// Visual cost tier for a model, matching the backend `costTier` field.
enum AiModelCostTier { fast, standard, heavy, ultra }

/// A premium AI model the user can select for their sessions.
class AiModelOption {
  const AiModelOption({
    required this.modelId,
    required this.label,
    this.creditMultiplier = 1.0,
    this.estimatedCreditsTypical = 1,
    this.costTier,
  });

  final String modelId;
  final String label;
  final double creditMultiplier;

  /// Typical credits consumed per message with this model (from backend pricing).
  final int estimatedCreditsTypical;

  /// Human-readable cost tier (fast / standard / heavy / ultra).
  final AiModelCostTier? costTier;

  factory AiModelOption.fromJson(Map<String, dynamic> json) {
    final typical = _asInt(json['estimatedCreditsTypical']) > 0
        ? _asInt(json['estimatedCreditsTypical'])
        : 1;
    return AiModelOption(
      modelId: json['modelId'] as String? ?? json['id'] as String? ?? '',
      label: json['label'] as String? ?? json['name'] as String? ?? '',
      creditMultiplier: (json['creditMultiplier'] as num?)?.toDouble() ?? 1.0,
      estimatedCreditsTypical: typical,
      costTier: _parseCostTier(json['costTier'] as String?, typical),
    );
  }
}

AiModelCostTier _parseCostTier(String? raw, int typical) {
  switch (raw) {
    case 'fast': return AiModelCostTier.fast;
    case 'standard': return AiModelCostTier.standard;
    case 'heavy': return AiModelCostTier.heavy;
    case 'ultra': return AiModelCostTier.ultra;
    default:
      // Derive locally if backend doesn't send the field yet.
      if (typical <= 1) return AiModelCostTier.fast;
      if (typical <= 2) return AiModelCostTier.standard;
      if (typical <= 6) return AiModelCostTier.heavy;
      return AiModelCostTier.ultra;
  }
}

class CreditWalletView {
  const CreditWalletView({
    required this.balance,
    required this.planCreditsMonthly,
    required this.usedCreditsThisCycle,
    required this.percentUsed,
    this.cycleEndAt,
    this.cycleStartAt,
    this.userSegment,
    this.countryCode,
    this.currency,
    this.aiModelMode,
    this.premiumModelId,
    this.autoPercentUsed,
    this.premiumPercentUsed,
    this.availablePremiumModels = const [],
    this.autoModelName,
    this.premiumAllowanceRemaining,
    this.premiumAllowanceCredits,
    this.premiumCreditsUsedThisCycle,
    this.deepAnalysisPremiumModelId,
  });

  final int balance;
  final int planCreditsMonthly;
  final int usedCreditsThisCycle;
  final int percentUsed;
  final DateTime? cycleEndAt;
  final DateTime? cycleStartAt;
  final String? userSegment;
  final String? countryCode;
  final String? currency;
  final String? aiModelMode;
  final String? premiumModelId;
  final int? autoPercentUsed;
  final int? premiumPercentUsed;
  final List<AiModelOption> availablePremiumModels;

  /// Name of the auto-selected model (e.g. "gpt-5.4-mini"), from backend.
  final String? autoModelName;

  final int? premiumAllowanceRemaining;
  final int? premiumAllowanceCredits;
  final int? premiumCreditsUsedThisCycle;
  final String? deepAnalysisPremiumModelId;

  int get creditsRemaining => balance;

  int get totalCredits => planCreditsMonthly > 0
      ? planCreditsMonthly
      : balance + usedCreditsThisCycle;

  /// Total AI model budget for the billing cycle in USD.
  double get aiBudgetUsd => planCreditsMonthly * _creditUsdValue;

  /// Amount of budget consumed this cycle in USD.
  double get usedBudgetUsd => usedCreditsThisCycle * _creditUsdValue;

  /// Remaining budget in USD.
  double get remainingBudgetUsd => balance * _creditUsdValue;

  /// True when less than 10% of the cycle budget remains.
  bool get isLow => planCreditsMonthly > 0
      ? balance / planCreditsMonthly < 0.10
      : balance <= 0;

  bool get isPremiumMode => aiModelMode?.toUpperCase() == 'PREMIUM';

  /// True when the user is on a free/minimal plan with negligible AI budget.
  bool get isFreeOrMinimal => planCreditsMonthly <= 5 || aiBudgetUsd < 0.50;

  factory CreditWalletView.fromJson(Map<String, dynamic> json) {
    return CreditWalletView(
      balance: _asInt(json['balance'] ?? json['creditsRemaining']),
      planCreditsMonthly: _asInt(json['planCreditsMonthly']),
      usedCreditsThisCycle: _asInt(json['usedCreditsThisCycle']),
      percentUsed: _asInt(json['percentUsed']),
      cycleEndAt: _parseDate(json['cycleEndAt']),
      cycleStartAt: _parseDate(json['cycleStartAt']),
      userSegment: json['userSegment'] as String?,
      countryCode: json['countryCode'] as String?,
      currency: json['currency'] as String?,
      aiModelMode: json['aiModelMode'] as String?,
      premiumModelId: json['premiumModelId'] as String?,
      autoPercentUsed: json['autoPercentUsed'] != null
          ? _asInt(json['autoPercentUsed'])
          : null,
      premiumPercentUsed: json['premiumPercentUsed'] != null
          ? _asInt(json['premiumPercentUsed'])
          : null,
      availablePremiumModels: _parseModelOptions(json['availablePremiumModels']),
      autoModelName: json['autoModelName'] as String?,
      premiumAllowanceRemaining: json['premiumAllowanceRemaining'] != null
          ? _asInt(json['premiumAllowanceRemaining'])
          : null,
      premiumAllowanceCredits: json['premiumAllowanceCredits'] != null
          ? _asInt(json['premiumAllowanceCredits'])
          : null,
      premiumCreditsUsedThisCycle: json['premiumCreditsUsedThisCycle'] != null
          ? _asInt(json['premiumCreditsUsedThisCycle'])
          : null,
      deepAnalysisPremiumModelId: json['deepAnalysisPremiumModelId'] as String?,
    );
  }
}

class ConsumerCreditsSnapshot {
  const ConsumerCreditsSnapshot({
    required this.balance,
    required this.countryCode,
    this.profileBalance = 0,
    this.packs = const [],
  });

  final int balance;
  final int profileBalance;
  final String countryCode;
  final List<CreditPack> packs;

  factory ConsumerCreditsSnapshot.fromJson(Map<String, dynamic> json) {
    final packsRaw = json['packs'];
    final packs = packsRaw is List
        ? packsRaw
            .whereType<Map<String, dynamic>>()
            .map(CreditPack.fromJson)
            .toList()
        : <CreditPack>[];

    return ConsumerCreditsSnapshot(
      balance: _asInt(json['balance']),
      profileBalance: _asInt(json['profileBalance']),
      countryCode: json['countryCode'] as String? ?? 'IN',
      packs: packs,
    );
  }

  /// Last-resort fallback; planCreditsMonthly is 0 to avoid misleading the UI.
  CreditWalletView toWalletView() {
    return CreditWalletView(
      balance: balance,
      planCreditsMonthly: 0,
      usedCreditsThisCycle: 0,
      percentUsed: balance <= 1 ? 100 : 0,
      countryCode: countryCode,
    );
  }
}

class CreditsRepository {
  CreditsRepository(this._client);

  final ApiClient _client;

  Future<CreditWalletView> getWallet() async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/credits/plan-usage',
      );
      final data = response.data;
      if (data == null) {
        throw ApiException('Wallet unavailable');
      }

      final walletJson = data['wallet'];
      if (walletJson is Map<String, dynamic>) {
        return CreditWalletView.fromJson(walletJson);
      }

      return CreditWalletView.fromJson(data);
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) {
        return _getWalletFallback();
      }
      throw ApiException.fromDio(error);
    }
  }

  Future<CreditWalletView> _getWalletFallback() async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/credits/wallet',
      );
      final data = response.data;
      if (data == null) {
        throw ApiException('Wallet unavailable');
      }
      final walletJson = data['wallet'];
      if (walletJson is Map<String, dynamic>) {
        return CreditWalletView.fromJson(walletJson);
      }
      return CreditWalletView.fromJson(data);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<CreditWalletView> getPlanUsage() => getWallet();

  Future<ConsumerCreditsSnapshot> getConsumerCredits() async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/consumers/me/credits',
      );
      final data = response.data;
      if (data == null) {
        throw ApiException('Credits unavailable');
      }
      return ConsumerCreditsSnapshot.fromJson(data);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  /// Fetches the full rich wallet view for consumer users via `/credits/wallet`.
  Future<CreditWalletView> getConsumerWallet() async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/credits/wallet',
      );
      final data = response.data;
      if (data == null) throw ApiException('Wallet unavailable');
      final walletJson = data['wallet'];
      if (walletJson is Map<String, dynamic>) {
        return CreditWalletView.fromJson(walletJson);
      }
      return CreditWalletView.fromJson(data);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<CreditWalletView> loadForUser(AuthUser user) async {
    if (user.isConsumer) {
      return getConsumerWallet();
    }
    return getWallet();
  }

  /// Updates the user's AI model preference.
  /// [modelMode] is `'AUTO'` or `'PREMIUM'`.
  /// [premiumModelId] is required when [modelMode] is `'PREMIUM'`.
  Future<void> updateAiPreferences({
    required String modelMode,
    String? premiumModelId,
    String? deepAnalysisPremiumModelId,
  }) async {
    try {
      await _client.dio.patch<void>(
        '/credits/ai-preferences',
        data: {
          'aiModelMode': modelMode,
          if (premiumModelId != null) 'premiumModelId': premiumModelId,
          if (deepAnalysisPremiumModelId != null)
            'deepAnalysisPremiumModelId': deepAnalysisPremiumModelId,
        },
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}

int _asInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return 0;
}

DateTime? _parseDate(Object? value) {
  if (value is! String || value.isEmpty) return null;
  return DateTime.tryParse(value);
}

List<AiModelOption> _parseModelOptions(Object? value) {
  if (value is! List) return const [];
  return value
      .whereType<Map<String, dynamic>>()
      .map(AiModelOption.fromJson)
      .toList();
}
