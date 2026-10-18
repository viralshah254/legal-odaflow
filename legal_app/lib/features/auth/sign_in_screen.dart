import 'auth_screen.dart';

export 'auth_screen.dart' show AuthScreen;

/// Legacy name kept for any stale imports. Unified auth is [AuthScreen] at `/auth`.
@Deprecated('Use AuthScreen via route /auth')
typedef SignInScreen = AuthScreen;
