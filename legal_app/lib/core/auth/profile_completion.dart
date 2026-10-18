import '../network/api_client.dart';
import 'social_auth_provider.dart';

const profileCompletionRequired = 'PROFILE_COMPLETION_REQUIRED';

class ProfileCompletionPayload {
  const ProfileCompletionPayload({
    required this.email,
    this.name,
  });

  final String email;
  final String? name;
}

class OAuthProfileCompletionState extends ProfileCompletionPayload {
  const OAuthProfileCompletionState({
    required super.email,
    super.name,
    required this.provider,
  });

  final SocialAuthProvider provider;
}

ProfileCompletionPayload? readProfileFromBody(Map<String, dynamic> body) {
  final candidates = <Map<String, dynamic>>[body];

  final message = body['message'];
  if (message is Map<String, dynamic>) {
    candidates.add(message);
  }

  final error = body['error'];
  if (error is Map<String, dynamic>) {
    candidates.add(error);
    final details = error['details'];
    if (details is Map<String, dynamic>) {
      candidates.add(details);
    }
  }

  for (final candidate in candidates) {
    if (candidate['code'] != profileCompletionRequired) continue;

    final email = candidate['email'];
    if (email is! String || email.isEmpty) continue;

    final name = candidate['name'];
    return ProfileCompletionPayload(
      email: email,
      name: name is String ? name : null,
    );
  }

  return null;
}

class ProfileCompletionRequiredException implements Exception {
  ProfileCompletionRequiredException(this.profile);

  final ProfileCompletionPayload profile;

  @override
  String toString() => 'Profile completion required';
}

ProfileCompletionPayload? parseProfileCompletionError(Object error) {
  if (error is ProfileCompletionRequiredException) {
    return error.profile;
  }
  if (error is ApiException &&
      error.statusCode == 422 &&
      error.code == profileCompletionRequired) {
    // Message-only fallback when the structured exception was not thrown.
    return null;
  }
  return null;
}
