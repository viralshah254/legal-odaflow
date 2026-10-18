# Data Governance Runbook

## Retention

- Keep matter, billing, audit, and trust records according to tenant jurisdiction policy.
- Apply document retention labels before archive or deletion workflows.
- Preserve audit logs for security, billing, exports, downloads, and admin access.

## Export And Deletion

- Data export requests must include clients, matters, documents, invoices, payments, portal messages, reports, AI outputs, and audit logs.
- Deletion requests require legal hold and retention review before execution.
- Deletion should be recorded as an audit event with requester, reviewer, and scope.

## Training Consent

- Training and evaluation use explicit opt-in consent only.
- Withdrawal blocks future dataset use and should not delete required audit records.
- Consent state must be checked before preparing anonymized datasets.

## Regional Controls

- Tenant `dataRegion` and `primaryCountry` define default storage and processing expectations.
- Cross-region exports require documented approval.
- Readiness checks should be green before data movement or migration work.
