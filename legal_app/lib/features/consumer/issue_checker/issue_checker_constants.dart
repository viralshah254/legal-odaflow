import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

const issueCheckerStepCount = 4;

const _sessionKey = 'issue_checker_session';

class IssueCheckerWizardData {
  const IssueCheckerWizardData({
    this.countryCode = '',
    this.jurisdiction = '',
    this.issueType = '',
    this.title = '',
    this.facts = '',
    this.urgencyLevel = 'MEDIUM',
    this.parties = '',
    this.desiredOutcome = '',
    this.planningAnswers,
  });

  factory IssueCheckerWizardData.fromJson(Map<String, dynamic> json) {
    final rawAnswers = json['planningAnswers'] as Map<String, dynamic>?;
    return IssueCheckerWizardData(
      countryCode: json['countryCode'] as String? ?? '',
      jurisdiction: json['jurisdiction'] as String? ?? '',
      issueType: json['issueType'] as String? ?? '',
      title: json['title'] as String? ?? '',
      facts: json['facts'] as String? ?? '',
      urgencyLevel: json['urgencyLevel'] as String? ?? 'MEDIUM',
      parties: json['parties'] as String? ?? '',
      desiredOutcome: json['desiredOutcome'] as String? ?? '',
      planningAnswers: rawAnswers?.cast<String, dynamic>(),
    );
  }

  Map<String, dynamic> toJson() => {
        'countryCode': countryCode,
        'jurisdiction': jurisdiction,
        'issueType': issueType,
        'title': title,
        'facts': facts,
        'urgencyLevel': urgencyLevel,
        'parties': parties,
        'desiredOutcome': desiredOutcome,
        if (planningAnswers != null) 'planningAnswers': planningAnswers,
      };

  IssueCheckerWizardData copyWith({
    String? countryCode,
    String? jurisdiction,
    String? issueType,
    String? title,
    String? facts,
    String? urgencyLevel,
    String? parties,
    String? desiredOutcome,
    Map<String, dynamic>? planningAnswers,
  }) {
    return IssueCheckerWizardData(
      countryCode: countryCode ?? this.countryCode,
      jurisdiction: jurisdiction ?? this.jurisdiction,
      issueType: issueType ?? this.issueType,
      title: title ?? this.title,
      facts: facts ?? this.facts,
      urgencyLevel: urgencyLevel ?? this.urgencyLevel,
      parties: parties ?? this.parties,
      desiredOutcome: desiredOutcome ?? this.desiredOutcome,
      planningAnswers: planningAnswers ?? this.planningAnswers,
    );
  }

  final String countryCode;
  final String jurisdiction;
  final String issueType;
  final String title;
  final String facts;
  final String urgencyLevel;
  final String parties;
  final String desiredOutcome;
  final Map<String, dynamic>? planningAnswers;
}

class IssueCheckerSessionState {
  const IssueCheckerSessionState({
    this.step = 0,
    required this.data,
    this.anonymousSessionId,
    this.pendingAttach = false,
    this.teaserGenerated = false,
    this.consumerCaseId,
  });

  factory IssueCheckerSessionState.fromJson(Map<String, dynamic> json) {
    return IssueCheckerSessionState(
      step: json['step'] as int? ?? 0,
      data: IssueCheckerWizardData.fromJson(
        json['data'] as Map<String, dynamic>? ?? {},
      ),
      anonymousSessionId: json['anonymousSessionId'] as String?,
      pendingAttach: json['pendingAttach'] as bool? ?? false,
      teaserGenerated: json['teaserGenerated'] as bool? ?? false,
      consumerCaseId: json['consumerCaseId'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'step': step,
        'data': data.toJson(),
        if (anonymousSessionId != null)
          'anonymousSessionId': anonymousSessionId,
        'pendingAttach': pendingAttach,
        'teaserGenerated': teaserGenerated,
        if (consumerCaseId != null) 'consumerCaseId': consumerCaseId,
      };

  final int step;
  final IssueCheckerWizardData data;
  final String? anonymousSessionId;
  final bool pendingAttach;
  final bool teaserGenerated;
  final String? consumerCaseId;
}

class IssueCheckerSessionStorage {
  const IssueCheckerSessionStorage(this._prefs);

  final SharedPreferences _prefs;

  IssueCheckerSessionState? load() {
    final raw = _prefs.getString(_sessionKey);
    if (raw == null) return null;
    try {
      return IssueCheckerSessionState.fromJson(
        jsonDecode(raw) as Map<String, dynamic>,
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> save(IssueCheckerSessionState state) async {
    await _prefs.setString(_sessionKey, jsonEncode(state.toJson()));
  }

  Future<void> clear() async {
    await _prefs.remove(_sessionKey);
  }
}
