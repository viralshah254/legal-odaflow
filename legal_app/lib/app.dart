import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'l10n/app_localizations.dart';
import 'core/routing/app_router.dart';
import 'core/firebase/firebase_service.dart';
import 'core/theme/app_theme.dart';
import 'core/config/locale_config.dart';
import 'core/providers/app_providers.dart';
import 'core/providers/locale_provider.dart';

/// Derives a deep-link route from the notification data payload, e.g.
/// `{"route": "/lawyer/tasks"}` or `{"type": "task", "id": "abc"}`.
String? _routeFromMessage(RemoteMessage message) {
  final data = message.data;
  // Explicit route field takes priority.
  if (data['route'] is String && (data['route'] as String).isNotEmpty) {
    return data['route'] as String;
  }
  // Fallback: derive route from type + id.
  final type = data['type'] as String?;
  final id = data['id'] as String?;
    switch (type) {
    case 'task':
      return id != null ? '/lawyer/tasks' : '/lawyer/tasks';
    case 'matter':
      return id != null ? '/lawyer/matters/$id' : '/lawyer/matters';
    case 'lead':
      return '/lawyer/leads';
    case 'calendar':
      return '/lawyer/calendar';
    case 'alert':
      return '/lawyer/alerts';
    case 'billing':
    case 'payment':
    case 'invoice':
      return '/lawyer/billing';
    case 'copilot':
    case 'copilot_draft_ready':
      return id != null ? '/lawyer/matters/$id' : '/lawyer/matters';
    case 'client':
      return id != null ? '/lawyer/clients/$id' : '/lawyer/clients';
    case 'notification':
      return '/lawyer/notifications';
    case 'system':
      return null;
    default:
      return null;
    }
}

class LegalApp extends ConsumerStatefulWidget {
  const LegalApp({super.key});

  @override
  ConsumerState<LegalApp> createState() => _LegalAppState();
}

class _LegalAppState extends ConsumerState<LegalApp> {
  final _scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

  @override
  void initState() {
    super.initState();
    if (FirebaseService.isConfigured) {
      // 1. App in foreground — show in-app notification banner.
      FirebaseMessaging.onMessage.listen(_onForegroundMessage);

      // 2. App in background, user taps notification — navigate on resume.
      FirebaseMessaging.onMessageOpenedApp.listen(_navigateFromMessage);

      // 3. App launched from terminated state via notification tap.
      FirebaseMessaging.instance.getInitialMessage().then((message) {
        if (message != null) _navigateFromMessage(message);
      });
    }
  }

  /// Called when the app is in the foreground and a push notification arrives.
  void _onForegroundMessage(RemoteMessage message) {
    final context = _scaffoldMessengerKey.currentContext;
    if (context == null) return;
    final l10n = Localizations.of<AppLocalizations>(context, AppLocalizations);
    final title = message.notification?.title ??
        l10n?.commonNewNotification ??
        'New notification';
    final body = message.notification?.body ??
        l10n?.commonNewUpdate ??
        'You have a new update';
    final route = _routeFromMessage(message);

    _scaffoldMessengerKey.currentState?.showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 5),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        content: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.notifications_outlined,
                  color: Colors.white, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 13),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (body.isNotEmpty)
                    Text(
                      body,
                      style: const TextStyle(fontSize: 12),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
          ],
        ),
        action: route != null
            ? SnackBarAction(
                label: 'View',
                onPressed: () => _navigateFromMessage(message),
              )
            : null,
      ),
    );
  }

  /// Navigates to the route embedded in the notification payload.
  void _navigateFromMessage(RemoteMessage message) {
    final route = _routeFromMessage(message);
    if (route == null) return;
    // Use the router once the navigator is available.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _scaffoldMessengerKey.currentContext;
      if (ctx != null && ctx.mounted) {
        // GoRouter.of(ctx).go() — import go_router via context extension.
        _goRoute(ctx, route);
      }
    });
  }

  void _goRoute(BuildContext context, String route) {
    try {
      // GoRouter is available through the context once the app is rendered.
      final router = ref.read(routerProvider);
      router.go(route);
    } catch (_) {
      // If router is not ready yet, ignore — app will land on the default screen.
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(localeProvider, (previous, next) {
      next.whenData((locale) async {
        if (previous?.maybeWhen(data: (v) => v, orElse: () => null) == locale) {
          return;
        }
        try {
          if (ref.read(authControllerProvider).session != null) {
            await ref
                .read(profileApiProvider)
                .updateMyPreferences(preferredLocale: locale);
          }
        } catch (_) {
          // Non-blocking if user is not signed in or request fails.
        }
      });
    });

    final router = ref.watch(routerProvider);
    final localeAsync = ref.watch(localeProvider);
    final localeCode = localeAsync.maybeWhen(data: (v) => v, orElse: () => defaultLocale);
    final locale = parseLocale(localeCode);
    final rtl = isRtlLocale(localeCode);

    return MaterialApp.router(
      title: 'Umbrella',
      debugShowCheckedModeBanner: false,
      scaffoldMessengerKey: _scaffoldMessengerKey,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.dark,
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) {
        // Tap outside a text field → dismiss keyboard.
        // Only dismiss on user-driven scrolls — not programmatic scroll when the
        // keyboard opens (ListView ensureVisible), which was closing the keyboard
        // immediately after focus on sign-up and other form screens.
        return GestureDetector(
          onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
          behavior: HitTestBehavior.translucent,
          child: NotificationListener<ScrollNotification>(
            onNotification: (notification) {
              if (notification is ScrollStartNotification &&
                  notification.dragDetails != null) {
                FocusManager.instance.primaryFocus?.unfocus();
              }
              return false;
            },
            child: Directionality(
              textDirection: rtl ? TextDirection.rtl : TextDirection.ltr,
              child: child ?? const SizedBox.shrink(),
            ),
          ),
        );
      },
      routerConfig: router,
    );
  }
}
