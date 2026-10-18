import '../models/models.dart';

const double fxMarkupPercent = 1.5;

const Map<String, double> fallbackUsdToLocal = {
  'USD': 1,
  'INR': 83,
  'GBP': 0.79,
  'KES': 129,
};

const Map<String, String> countryCurrency = {
  'US': 'USD',
  'IN': 'INR',
  'KE': 'KES',
  'GB': 'GBP',
};

double roundForCurrency(double amount, String currency) {
  final c = currency.toUpperCase();
  if (c == 'INR' || c == 'KES') return amount.roundToDouble();
  return double.parse(amount.toStringAsFixed(2));
}

double convertUsdToLocal(double usdAmount, String currency) {
  if (usdAmount <= 0) return 0;
  final c = currency.toUpperCase();
  if (c == 'USD') return usdAmount;
  final rate = fallbackUsdToLocal[c] ?? 1;
  return roundForCurrency(
    usdAmount * rate * (1 + fxMarkupPercent / 100),
    c,
  );
}

String currencyForCountry(String countryCode) {
  return countryCurrency[countryCode.toUpperCase()] ?? 'USD';
}

String formatPlanPrice(double amount, String currency) {
  if (amount <= 0) return 'Free';
  final c = currency.toUpperCase();
  if (c == 'INR' || c == 'KES') {
    return '$c ${amount.round()}';
  }
  final formatted = amount % 1 == 0
      ? amount.toStringAsFixed(0)
      : amount.toStringAsFixed(2);
  return '$c $formatted';
}

List<PricingPlan> fallbackConsumerPlans(String countryCode) {
  final code = countryCode.toUpperCase();
  final currency = currencyForCountry(code);
  final plusAmount = convertUsdToLocal(15, currency);

  return [
    PricingPlan(
      countryCode: code,
      userType: 'CONSUMER',
      planId: 'consumer_free',
      currency: currency,
      amount: 0,
      aiCredits: 100,
      features: const {
        'issueChecker': true,
        'documentUpload': true,
        'lawyerReview': false,
      },
    ),
    PricingPlan(
      countryCode: code,
      userType: 'CONSUMER',
      planId: 'consumer_plus',
      currency: currency,
      amount: plusAmount,
      aiCredits: 175,
      features: const {
        'issueChecker': true,
        'documentUpload': true,
        'lawyerReview': true,
      },
    ),
  ];
}

// 30% net margin on all payments (plans and packs). Users receive 70% of
// their payment as AI model budget.
const double _packMarginPercent = 30.0;
const double _creditUsdValue = 0.06;

/// Returns the USD value of AI model access the user receives for a given
/// payment amount (70% of price, 30% net revenue).
double aiBudgetUsdFromPrice(double priceUsd) => priceUsd * 0.70;

/// Converts a USD AI budget to a formatted local currency string.
/// e.g. aiBudgetUsdFromPrice(15) in KES → "KES 10,762"
String formatAiBudgetLocal(double budgetUsd, String currency) {
  if (budgetUsd <= 0) return '';
  final localAmount = convertUsdToLocal(budgetUsd, currency);
  return formatPlanPrice(localAmount, currency);
}

int _creditsFromUsd(double usdPrice) {
  return ((usdPrice * (1 - _packMarginPercent / 100)) / _creditUsdValue).floor();
}

List<CreditPack> fallbackCreditPacks(String countryCode) {
  final code = countryCode.toUpperCase();
  final currency = currencyForCountry(code);
  const packs = [
    ('pack_10', 'Starter top-up', 'Good for light AI usage', 4.99),
    ('pack_25', 'Popular top-up', 'Most popular top-up', 9.99),
    ('pack_50', 'Power top-up', 'Best value for frequent use', 17.99),
  ];

  return packs.map((p) {
    final usdPrice = p.$4;
    final amount = convertUsdToLocal(usdPrice, currency);
    final credits = _creditsFromUsd(usdPrice);
    return CreditPack(
      packId: p.$1,
      label: p.$2,
      description: p.$3,
      credits: credits > 0 ? credits : 1,
      countryCode: code,
      currency: currency,
      amount: amount,
    );
  }).toList();
}
