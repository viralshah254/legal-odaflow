import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../core/config/app_config.dart';

bool _isCheckoutCompleteUrl(String url) {
  final lower = url.toLowerCase();
  return lower.contains('success') ||
      lower.contains('complete') ||
      lower.contains('payment/success') ||
      lower.contains('subscription/success') ||
      lower.contains('checkout/success');
}

bool _isCheckoutCancelUrl(String url) {
  final lower = url.toLowerCase();
  return lower.contains('cancel') || lower.contains('subscription/cancel');
}

/// In-app WebView for Stripe/Razorpay/subscription checkout URLs.
class PaymentCheckoutScreen extends StatefulWidget {
  const PaymentCheckoutScreen({
    super.key,
    required this.checkoutUrl,
    required this.title,
    this.onComplete,
  });

  final String checkoutUrl;
  final String title;
  final VoidCallback? onComplete;

  @override
  State<PaymentCheckoutScreen> createState() => _PaymentCheckoutScreenState();
}

class _PaymentCheckoutScreenState extends State<PaymentCheckoutScreen> {
  late final WebViewController _controller;
  var _loading = true;
  var _error = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() => _loading = true),
          onPageFinished: (_) => setState(() => _loading = false),
          onWebResourceError: (_) => setState(() {
            _loading = false;
            _error = true;
          }),
          onNavigationRequest: (request) {
            final url = request.url;
            if (_isCheckoutCompleteUrl(url)) {
              widget.onComplete?.call();
              if (mounted) {
                Navigator.of(context).pop(true);
              }
              return NavigationDecision.prevent;
            }
            if (_isCheckoutCancelUrl(url)) {
              if (mounted) {
                Navigator.of(context).pop(false);
              }
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.checkoutUrl));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.commonClose),
          ),
        ],
      ),
      body: Stack(
        children: [
          if (_error)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, size: 48),
                    const SizedBox(height: 16),
                    Text(l10n.consumerUnableToLoadCheckoutPage,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () {
                        setState(() => _error = false);
                        _controller.loadRequest(Uri.parse(widget.checkoutUrl));
                      },
                      child: Text(l10n.commonRetry),
                    ),
                  ],
                ),
              ),
            )
          else
            WebViewWidget(controller: _controller),
          if (_loading && !_error) const LinearProgressIndicator(minHeight: 2),
        ],
      ),
    );
  }
}

Future<bool?> openPaymentCheckout(
  BuildContext context, {
  required String checkoutUrl,
  required String title,
}) {
  if (!AppConfig.enableInAppPurchasing) return Future.value(false);
  return Navigator.of(context).push<bool>(
    MaterialPageRoute(
      builder: (context) =>
          PaymentCheckoutScreen(checkoutUrl: checkoutUrl, title: title),
    ),
  );
}
