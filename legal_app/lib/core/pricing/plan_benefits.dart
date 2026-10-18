import '../../l10n/app_localizations.dart';
import '../models/models.dart';

class PlanBenefitBullet {
  const PlanBenefitBullet({required this.text, this.included = true});

  final String text;
  final bool included;
}

String _creditsLine(AppLocalizations l10n, int n, {bool perSeat = false}) {
  return perSeat
      ? l10n.consumerPlanBenefitsCreditsPerSeatMonth('$n')
      : l10n.consumerPlanBenefitsCreditsPerMonth('$n');
}

String planTagline(AppLocalizations l10n, PricingPlan plan) {
  switch (plan.planId) {
    case 'consumer_free':
      return l10n.consumerPlanBenefitsTaglineFree;
    case 'consumer_plus':
      return l10n.consumerPlanBenefitsTaglinePlus;
    case 'lawyer_solo':
      return l10n.consumerPlanBenefitsTaglineLawyerSolo;
    case 'firm_starter':
      return l10n.consumerPlanBenefitsTaglineFirmStarter;
    case 'firm_professional':
      return l10n.consumerPlanBenefitsTaglineFirmProfessional;
    case 'firm_pro_plus':
      return l10n.consumerPlanBenefitsTaglineFirmProPlus;
    case 'firm_enterprise':
      return l10n.consumerPlanBenefitsTaglineFirmEnterprise;
    default:
      return '';
  }
}

List<PlanBenefitBullet> getPlanBenefitBullets(
  AppLocalizations l10n,
  PricingPlan plan,
) {
  final n = plan.aiCredits;
  final f = plan.features;

  switch (plan.planId) {
    case 'consumer_free':
      return [
        PlanBenefitBullet(text: _creditsLine(l10n, n)),
        PlanBenefitBullet(text: l10n.consumerPlanBenefitsIssueCheckerPreviews),
        PlanBenefitBullet(text: l10n.consumerPlanBenefitsSaveTrackCases),
        PlanBenefitBullet(
          text: l10n.consumerPlanBenefitsUploadDocuments,
          included: f['documentUpload'] == true,
        ),
        PlanBenefitBullet(
          text: l10n.consumerPlanBenefitsFullAiLegalReports,
          included: false,
        ),
        PlanBenefitBullet(
          text: l10n.consumerPlanBenefitsLawyerReviewUpgrades,
          included: false,
        ),
        PlanBenefitBullet(
          text: l10n.consumerPlanBenefitsClientPortalAccess,
          included: false,
        ),
      ];
    case 'consumer_plus':
      return [
        PlanBenefitBullet(text: _creditsLine(l10n, n)),
        PlanBenefitBullet(text: l10n.consumerPlanBenefitsFullAiLegalReports),
        PlanBenefitBullet(
          text: l10n.consumerPlanBenefitsLawyerReviewUpgrades,
          included: f['lawyerReview'] == true,
        ),
        PlanBenefitBullet(
          text: l10n.consumerPlanBenefitsDocumentUploadAnalysis,
          included: f['documentUpload'] == true,
        ),
        PlanBenefitBullet(text: l10n.consumerPlanBenefitsClientPortalAccess),
        PlanBenefitBullet(
          text: l10n.consumerPlanBenefitsIssueCheckerIncluded,
          included: f['issueChecker'] == true,
        ),
      ];
    default:
      return [
        PlanBenefitBullet(text: _creditsLine(l10n, n)),
        PlanBenefitBullet(text: l10n.consumerPlanBenefitsCorePlatformAccess),
      ];
  }
}
