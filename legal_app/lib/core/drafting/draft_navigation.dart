import 'package:shared_preferences/shared_preferences.dart';

const _countryFilterKey = 'legal_forms_country_filter';
const _draftSetKey = 'umbrella_draft_set';

enum DraftSetItemStatus { pending, generating, done, error }

class DraftSetItem {
  const DraftSetItem({
    required this.draftUrl,
    required this.label,
    required this.kind,
    this.status = DraftSetItemStatus.pending,
    this.draftId,
  });

  factory DraftSetItem.fromJson(Map<String, dynamic> json) {
    return DraftSetItem(
      draftUrl: json['draftUrl'] as String? ?? '',
      label: json['label'] as String? ?? '',
      kind: json['kind'] as String? ?? '',
      status: DraftSetItemStatus.values.firstWhere(
        (s) => s.name == json['status'],
        orElse: () => DraftSetItemStatus.pending,
      ),
      draftId: json['draftId'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'draftUrl': draftUrl,
        'label': label,
        'kind': kind,
        'status': status.name,
        if (draftId != null) 'draftId': draftId,
      };

  DraftSetItem copyWith({
    DraftSetItemStatus? status,
    String? draftId,
  }) {
    return DraftSetItem(
      draftUrl: draftUrl,
      label: label,
      kind: kind,
      status: status ?? this.status,
      draftId: draftId ?? this.draftId,
    );
  }

  final String draftUrl;
  final String label;
  final String kind;
  final DraftSetItemStatus status;
  final String? draftId;
}

class DraftSetState {
  const DraftSetState({
    required this.items,
    required this.currentIndex,
  });

  factory DraftSetState.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? [];
    return DraftSetState(
      items: rawItems
          .whereType<Map<String, dynamic>>()
          .map(DraftSetItem.fromJson)
          .toList(),
      currentIndex: (json['currentIndex'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'items': items.map((i) => i.toJson()).toList(),
        'currentIndex': currentIndex,
      };

  final List<DraftSetItem> items;
  final int currentIndex;
}

class DraftSetInitItem {
  const DraftSetInitItem({
    required this.draftUrl,
    required this.label,
    this.kind,
  });

  final String draftUrl;
  final String label;
  final String? kind;
}

Future<String?> readLegalFormsCountryFilter() async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString(_countryFilterKey);
}

Future<void> persistLegalFormsCountryFilter(String code) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_countryFilterKey, code);
}

String _kindFromDraftUrl(String draftUrl) {
  try {
    final uri = Uri.parse(draftUrl.startsWith('http') ? draftUrl : 'http://local$draftUrl');
    return uri.queryParameters['kind'] ?? '';
  } catch (_) {
    return '';
  }
}

Future<void> _saveDraftSet(DraftSetState state) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_draftSetKey, _encodeDraftSet(state));
}

String _encodeDraftSet(DraftSetState state) {
  final buffer = StringBuffer();
  buffer.write('{"items":[');
  for (var i = 0; i < state.items.length; i++) {
    if (i > 0) buffer.write(',');
    final item = state.items[i];
    buffer.write(
      '{"draftUrl":"${_escape(item.draftUrl)}","label":"${_escape(item.label)}","kind":"${_escape(item.kind)}","status":"${item.status.name}"',
    );
    if (item.draftId != null) {
      buffer.write(',"draftId":"${_escape(item.draftId!)}"');
    }
    buffer.write('}');
  }
  buffer.write('],"currentIndex":${state.currentIndex}}');
  return buffer.toString();
}

String _escape(String s) => s.replaceAll('\\', r'\\').replaceAll('"', r'\"');

Future<void> initDraftSet(List<DraftSetInitItem> items) async {
  if (items.isEmpty) {
    await clearDraftSet();
    return;
  }
  await _saveDraftSet(
    DraftSetState(
      items: items
          .map(
            (item) => DraftSetItem(
              draftUrl: item.draftUrl,
              label: item.label,
              kind: item.kind ?? _kindFromDraftUrl(item.draftUrl),
            ),
          )
          .toList(),
      currentIndex: 0,
    ),
  );
}

Future<DraftSetState?> getDraftSet() async {
  final prefs = await SharedPreferences.getInstance();
  final raw = prefs.getString(_draftSetKey);
  if (raw == null || raw.isEmpty) return null;
  try {
    // Simple manual parse fallback using regex for robustness
    final currentIndexMatch = RegExp(r'"currentIndex":(\d+)').firstMatch(raw);
    final currentIndex = int.tryParse(currentIndexMatch?.group(1) ?? '0') ?? 0;
    final itemMatches = RegExp(
      r'\{"draftUrl":"((?:\\.|[^"\\])*)","label":"((?:\\.|[^"\\])*)","kind":"((?:\\.|[^"\\])*)","status":"(\w+)"(?:,"draftId":"((?:\\.|[^"\\])*)")?\}',
    ).allMatches(raw);
    final items = itemMatches.map((m) {
      return DraftSetItem(
        draftUrl: _unescape(m.group(1)!),
        label: _unescape(m.group(2)!),
        kind: _unescape(m.group(3)!),
        status: DraftSetItemStatus.values.firstWhere(
          (s) => s.name == m.group(4),
          orElse: () => DraftSetItemStatus.pending,
        ),
        draftId: m.group(5) != null ? _unescape(m.group(5)!) : null,
      );
    }).toList();
    if (items.isEmpty) return null;
    return DraftSetState(items: items, currentIndex: currentIndex);
  } catch (_) {
    return null;
  }
}

String _unescape(String s) =>
    s.replaceAll(r'\"', '"').replaceAll(r'\\', r'\');

Future<void> clearDraftSet() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove(_draftSetKey);
}

Future<DraftSetState?> updateDraftSetItem(
  int index, {
  DraftSetItemStatus? status,
  String? draftId,
}) async {
  final set = await getDraftSet();
  if (set == null || index < 0 || index >= set.items.length) return null;
  final items = [...set.items];
  items[index] = items[index].copyWith(status: status, draftId: draftId);
  final next = DraftSetState(items: items, currentIndex: set.currentIndex);
  await _saveDraftSet(next);
  return next;
}

Future<DraftSetState?> setDraftSetCurrentIndex(int index) async {
  final set = await getDraftSet();
  if (set == null || index < 0 || index >= set.items.length) return null;
  final next = DraftSetState(items: set.items, currentIndex: index);
  await _saveDraftSet(next);
  return next;
}

/// Parse web draft URL into app workspace route params.
DocuDraftRouteParams parseDraftUrl(String draftUrl) {
  final uri = Uri.parse(
    draftUrl.startsWith('http') ? draftUrl : 'http://local$draftUrl',
  );
  final path = uri.path;
  String countryCode = 'IN';
  if (path.contains('us-drafting')) {
    countryCode = 'US';
  } else if (path.contains('india-drafting')) {
    countryCode = 'IN';
  }
  return DocuDraftRouteParams(
    kind: uri.queryParameters['kind'],
    label: uri.queryParameters['label'],
    details: uri.queryParameters['details'],
    clientName: uri.queryParameters['clientName'],
    courtName: uri.queryParameters['courtName'],
    opposingParty: uri.queryParameters['opposingParty'],
    autoGenerate: uri.queryParameters['autoGenerate'] == '1',
    draftId: uri.queryParameters['draftId'],
    countryCode: uri.queryParameters['countryCode'] ?? countryCode,
  );
}

class DocuDraftRouteParams {
  const DocuDraftRouteParams({
    this.kind,
    this.label,
    this.details,
    this.clientName,
    this.courtName,
    this.opposingParty,
    this.autoGenerate = false,
    this.draftId,
    this.countryCode = 'IN',
  });

  final String? kind;
  final String? label;
  final String? details;
  final String? clientName;
  final String? courtName;
  final String? opposingParty;
  final bool autoGenerate;
  final String? draftId;
  final String countryCode;

  DocuDraftRouteParams copyWith({
    String? kind,
    String? label,
    String? details,
    String? clientName,
    String? courtName,
    String? opposingParty,
    bool? autoGenerate,
    String? draftId,
    String? countryCode,
  }) {
    return DocuDraftRouteParams(
      kind: kind ?? this.kind,
      label: label ?? this.label,
      details: details ?? this.details,
      clientName: clientName ?? this.clientName,
      courtName: courtName ?? this.courtName,
      opposingParty: opposingParty ?? this.opposingParty,
      autoGenerate: autoGenerate ?? this.autoGenerate,
      draftId: draftId ?? this.draftId,
      countryCode: countryCode ?? this.countryCode,
    );
  }
}

String buildDocuDraftWorkspacePath(DocuDraftRouteParams params) {
  final query = <String, String>{};
  if (params.kind != null) query['kind'] = params.kind!;
  if (params.label != null) query['label'] = params.label!;
  if (params.details != null) query['details'] = params.details!;
  if (params.clientName != null) query['clientName'] = params.clientName!;
  if (params.courtName != null) query['courtName'] = params.courtName!;
  if (params.opposingParty != null) query['opposingParty'] = params.opposingParty!;
  if (params.draftId != null) query['draftId'] = params.draftId!;
  if (params.autoGenerate) query['autoGenerate'] = '1';
  query['countryCode'] = params.countryCode;
  final qs = Uri(queryParameters: query).query;
  return '/lawyer/docu-draft/draft${qs.isNotEmpty ? '?$qs' : ''}';
}

Map<String, String> extractDraftFieldHints(String details) {
  final hints = <String, String>{};
  final clientMatch = RegExp(
    r'(?:client|petitioner|applicant)[:\s]+([A-Za-z][A-Za-z\s.]{1,40})',
    caseSensitive: false,
  ).firstMatch(details);
  if (clientMatch != null) {
    hints['clientName'] = clientMatch.group(1)!.trim();
  }
  final courtMatch = RegExp(
    r'(?:court|forum)[:\s]+([A-Za-z][A-Za-z\s.]{2,50})',
    caseSensitive: false,
  ).firstMatch(details);
  if (courtMatch != null) {
    hints['courtName'] = courtMatch.group(1)!.trim();
  }
  final opposingMatch = RegExp(
    r'(?:respondent|opposite|opposing)[:\s]+([A-Za-z][A-Za-z\s.]{1,40})',
    caseSensitive: false,
  ).firstMatch(details);
  if (opposingMatch != null) {
    hints['opposingParty'] = opposingMatch.group(1)!.trim();
  }
  return hints;
}
