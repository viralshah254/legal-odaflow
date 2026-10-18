import 'package:dio/dio.dart';

import 'api_client.dart';

/// AI outcome analysis can take several minutes on reasoning models.
const _outcomeGenerateTimeout = Duration(seconds: 180);

class OutcomeProbabilityBand {
  const OutcomeProbabilityBand({
    required this.low,
    required this.mid,
    required this.high,
  });

  factory OutcomeProbabilityBand.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const OutcomeProbabilityBand(low: 0, mid: 0, high: 0);
    }
    return OutcomeProbabilityBand(
      low: (json['low'] as num?)?.toDouble() ?? 0,
      mid: (json['mid'] as num?)?.toDouble() ?? 0,
      high: (json['high'] as num?)?.toDouble() ?? 0,
    );
  }

  final double low;
  final double mid;
  final double high;
}

class MatterOutcomeAnalysis {
  const MatterOutcomeAnalysis({
    required this.id,
    required this.matterId,
    required this.status,
    required this.overallBand,
    required this.confidence,
    this.portalVisible = false,
    this.portalSummary,
    this.winProbability,
    this.lossProbability,
    this.settlementProbability,
    this.scenarios,
    this.factorsFor,
    this.factorsAgainst,
    this.solutions,
    this.missingEvidence,
    this.disclaimers,
    this.createdAt,
  });

  factory MatterOutcomeAnalysis.fromJson(Map<String, dynamic> json) {
    return MatterOutcomeAnalysis(
      id: json['id'] as String,
      matterId: json['matterId'] as String,
      status: json['status'] as String? ?? 'NEEDS_REVIEW',
      overallBand: json['overallBand'] as String? ?? 'UNCERTAIN',
      confidence: json['confidence'] as String? ?? 'MEDIUM',
      portalVisible: json['portalVisible'] as bool? ?? false,
      portalSummary: json['portalSummary'] as String?,
      winProbability: json['winProbability'] is Map<String, dynamic>
          ? OutcomeProbabilityBand.fromJson(
              json['winProbability'] as Map<String, dynamic>,
            )
          : null,
      lossProbability: json['lossProbability'] is Map<String, dynamic>
          ? OutcomeProbabilityBand.fromJson(
              json['lossProbability'] as Map<String, dynamic>,
            )
          : null,
      settlementProbability:
          json['settlementProbability'] is Map<String, dynamic>
          ? OutcomeProbabilityBand.fromJson(
              json['settlementProbability'] as Map<String, dynamic>,
            )
          : null,
      scenarios: (json['scenarios'] as List<dynamic>?)
          ?.whereType<Map<String, dynamic>>()
          .map(
            (item) => OutcomeScenario(
              label: item['label'] as String? ?? '',
              description: item['description'] as String? ?? '',
              likelihood: item['likelihood'] as String? ?? '',
            ),
          )
          .toList(),
      factorsFor: _stringList(json['factorsFor']),
      factorsAgainst: _stringList(json['factorsAgainst']),
      solutions: _stringList(json['solutions']),
      missingEvidence: _stringList(json['missingEvidence']),
      disclaimers: _stringList(json['disclaimers']),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
    );
  }

  static List<String>? _stringList(dynamic value) {
    if (value is! List) return null;
    return value.map((item) => item.toString()).toList();
  }

  final String id;
  final String matterId;
  final String status;
  final String overallBand;
  final String confidence;
  final bool portalVisible;
  final String? portalSummary;
  final OutcomeProbabilityBand? winProbability;
  final OutcomeProbabilityBand? lossProbability;
  final OutcomeProbabilityBand? settlementProbability;
  final List<OutcomeScenario>? scenarios;
  final List<String>? factorsFor;
  final List<String>? factorsAgainst;
  final List<String>? solutions;
  final List<String>? missingEvidence;
  final List<String>? disclaimers;
  final DateTime? createdAt;
}

class OutcomeScenario {
  const OutcomeScenario({
    required this.label,
    required this.description,
    required this.likelihood,
  });

  final String label;
  final String description;
  final String likelihood;
}

class MatterOutcomeApi {
  MatterOutcomeApi(this._client);

  final ApiClient _client;

  Future<List<MatterOutcomeAnalysis>> listAnalyses({
    required String tenantId,
    required String matterId,
  }) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/matters/$matterId/outcome-analysis',
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(MatterOutcomeAnalysis.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<MatterOutcomeAnalysis> generateAnalysis({
    required String tenantId,
    required String matterId,
    CancelToken? cancelToken,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/matters/$matterId/outcome-analysis/generate',
        options: Options(
          headers: {'X-Tenant-Id': tenantId},
          receiveTimeout: _outcomeGenerateTimeout,
          sendTimeout: const Duration(seconds: 30),
        ),
        cancelToken: cancelToken,
      );
      return MatterOutcomeAnalysis.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<MatterOutcomeAnalysis> updateAnalysis({
    required String tenantId,
    required String matterId,
    required String analysisId,
    String? status,
    bool? portalVisible,
    String? portalSummary,
    String? portalOutlookLabel,
  }) async {
    try {
      final response = await _client.dio.patch<Map<String, dynamic>>(
        '/matters/$matterId/outcome-analysis/$analysisId',
        data: {
          if (status != null) 'status': status,
          if (portalVisible != null) 'portalVisible': portalVisible,
          if (portalSummary != null) 'portalSummary': portalSummary,
          if (portalOutlookLabel != null)
            'portalOutlookLabel': portalOutlookLabel,
        },
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return MatterOutcomeAnalysis.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
