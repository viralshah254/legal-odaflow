import 'package:flutter_test/flutter_test.dart';
import 'package:umbrella/core/network/calendar_api.dart';

void main() {
  test('calendar timestamps preserve the instant with an explicit UTC timezone', () {
    final start = DateTime(2026, 11, 9, 0, 30);
    final end = start.add(const Duration(hours: 1));
    final json = CreateCalendarEventInput(title: 'Fictional event', startAt: start, endAt: end).toJson();
    expect((json['startAt'] as String).endsWith('Z'), isTrue);
    expect(DateTime.parse(json['startAt'] as String).isAtSameMomentAs(start), isTrue);
    expect(DateTime.parse(json['endAt'] as String).isAtSameMomentAs(end), isTrue);
    expect(json['reminderMinutes'], 30);
  });

  test('editing can explicitly disable a reminder and clear matter/client links', () {
    final json = const UpdateCalendarEventInput(updateReminder: true, updateMatterLink: true, updateClientLink: true).toJson();
    expect(json.containsKey('reminderMinutes'), isTrue);
    expect(json['reminderMinutes'], isNull);
    expect(json.containsKey('matterId'), isTrue);
    expect(json['matterId'], isNull);
    expect(json.containsKey('clientId'), isTrue);
    expect(const UpdateCalendarEventInput(title: 'Renamed').toJson().containsKey('reminderMinutes'), isFalse);
  });
}
