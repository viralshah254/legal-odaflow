import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/models/models.dart';
import '../../../../core/providers/app_providers.dart';

final caseDetailProvider = FutureProvider.family<ConsumerCaseDetail, String>((
  ref,
  caseId,
) async {
  return ref.watch(consumersApiProvider).getCase(caseId);
});

final caseDraftsProvider =
    FutureProvider.family<List<ConsumerCaseDraft>, String>((ref, caseId) async {
  return ref.watch(consumersApiProvider).listCaseDrafts(caseId);
});

final caseMessagesProvider =
    FutureProvider.family<List<ConsumerCaseMessage>, String>((ref, caseId) async {
  return ref.watch(consumersApiProvider).listCaseMessages(caseId);
});

final casePaymentsProvider =
    FutureProvider.family<List<ConsumerCasePayment>, String>((ref, caseId) async {
  return ref.watch(consumersApiProvider).listCasePayments(caseId);
});

final caseDocumentsProvider =
    FutureProvider.family<List<ConsumerDocument>, String>((ref, caseId) async {
  return ref.watch(documentsApiProvider).listByCase(caseId);
});

final lawyerReviewPricingProvider =
    FutureProvider.family<LawyerReviewPricing, String>((ref, countryCode) async {
  return ref.watch(pricingApiProvider).getLawyerReviewPricing(countryCode);
});
