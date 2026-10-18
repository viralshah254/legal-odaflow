const int fullReportCredits = 20;

String getCreditPackValueHint(int credits) {
  if (credits <= 0) return '';

  final fullReports = credits ~/ fullReportCredits;
  final issueChecks = credits;

  if (fullReports >= 2) {
    return '≈ $issueChecks issue checks, or $fullReports full reports';
  }
  if (fullReports == 1 && credits % fullReportCredits > 0) {
    return '≈ $issueChecks issue checks, or 1 full report + extras';
  }
  if (fullReports == 1) {
    return '≈ 1 full report ($fullReportCredits credits)';
  }
  return '≈ $issueChecks issue check${issueChecks == 1 ? '' : 's'} or preview reports';
}
