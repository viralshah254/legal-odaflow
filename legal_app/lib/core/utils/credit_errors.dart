import '../network/api_client.dart';

const _insufficientPatterns = [
  'insufficient credit',
  'insufficient ai credit',
  'no ai credits',
  'not enough credit',
  'credit balance',
  'top up',
  'top-up',
  'premium allowance',
  'buy more credits',
  'purchase more credits',
  'switch to auto',
  'used your ai credits',
  'used all your free daily',
  'free daily ai credits',
  "you're out of ai credits",
  'out of ai credits',
  'subscribe to continue',
  'daily reset',
  'wait for your daily',
  'wait until tomorrow',
];

bool isInsufficientCreditsMessage(String message) {
  final normalized = message.toLowerCase();
  return _insufficientPatterns.any((p) => normalized.contains(p));
}

bool isInsufficientCreditsError(Object? error) {
  if (error is ApiException) {
    return (error.statusCode == 403 && isInsufficientCreditsMessage(error.message))
        || isInsufficientCreditsMessage(error.message);
  }
  if (error is Exception) {
    return isInsufficientCreditsMessage(error.toString());
  }
  return false;
}

String getCreditErrorMessage(Object? error) {
  if (error is ApiException) return error.message;
  if (error is Exception) return error.toString();
  return 'An unexpected error occurred';
}
