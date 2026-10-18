# SOC 2 Evidence Collection Runbook

**Version:** 1.0  
**Last Updated:** 2026-06-18  
**Prepared By:** CISO  
**For:** External Auditor Use  

---

## Overview

This runbook guides the auditor through collecting evidence for each Trust Service Criteria (TSC) tested during the SOC 2 Type II audit. For each control, we list the evidence source, the API or system path to access it, and the expected format.

---

## Table of Contents

1. [CC1 — Control Environment](#cc1)
2. [CC6 — Logical Access](#cc6)
3. [CC7 — System Operations](#cc7)
4. [CC8 — Change Management](#cc8)
5. [CC9 — Risk Mitigation](#cc9)
6. [A1 — Availability](#a1)
7. [C1 — Confidentiality](#c1)
8. [PI1 — Processing Integrity](#pi1)

---

## CC1 — Control Environment {#cc1}

| Evidence Item | Source | Format |
|--------------|--------|--------|
| Code of Conduct | HR system (request via CISO) | PDF |
| Board oversight meeting minutes | Board secretary | PDF |
| Employee security training completion | HR LMS | CSV export |
| CISO designation document | HR system | PDF |

---

## CC6 — Logical Access {#cc6}

### User access listing

```bash
# Export all active TenantUser records for the audit period
GET /admin/tenants/{tenantId}/users

# Authentication: Super-admin credentials (provided by CISO)
# Expected output: JSON array of { userId, role, isActive, createdAt }
```

### Access review evidence

```bash
# Retrieve access review findings from audit log
GET /audit/logs?action=SOC2_ACCESS_REVIEW_FINDING&from=2025-06-01&to=2026-06-01

# Authentication: PARTNER_ADMIN JWT
# Expected output: JSON array of AuditLog entries
```

### Role change history

```bash
# Filter audit logs for role changes
GET /audit/logs?action=UPDATE&entityType=TenantUser&from={start}&to={end}
```

### MFA enforcement evidence

- Screen recording of MFA prompt during login (provided by CISO)
- Database query confirming MFA requirement in auth middleware (code review)

---

## CC7 — System Operations {#cc7}

### Monitoring configuration

- Sentry dashboard screenshot (request read-only access from CISO)
- PagerDuty alert rules export (request from Engineering Lead)

### Incident log

```bash
# Retrieve security incidents from audit log
GET /audit/logs?action=SECURITY_INCIDENT&from={start}&to={end}
```

- Incident post-mortem documents are stored in the internal incident tracker (request from CISO)

### Background job failure log

- BullMQ dashboard or Redis queue inspection (request from Engineering Lead)
- Failed job records retained for 7 days in dead letter queue

---

## CC8 — Change Management {#cc8}

### GitHub evidence

The auditor requires read-only access to the GitHub repository. Request from Engineering Lead.

| Evidence | GitHub Path |
|----------|------------|
| Branch protection rules | Settings → Branches → main |
| PR review requirements | Settings → Branches → main |
| CI workflow definitions | `.github/workflows/` |
| PRs merged during audit period | Pull Requests → Closed, filtered by date |
| CI run history | Actions → workflow runs |

### Deployment log

```bash
# Deployment events are logged to AuditLog
GET /audit/logs?action=DEPLOY&from={start}&to={end}
```

### Database migration history

```bash
# Prisma migration history is in the repository
cat prisma/migrations/migration_lock.toml

# Migration log is also in the database
SELECT * FROM "_prisma_migrations" ORDER BY "finished_at" DESC;
```

---

## CC9 — Risk Mitigation {#cc9}

| Evidence Item | Source |
|--------------|--------|
| Annual risk register | CISO (internal document) |
| Vendor DPAs | Legal department |
| Penetration test report | CISO (third-party pentest vendor) |
| Cyber insurance policy | CFO |
| AI provider zero-retention confirmation | OpenAI/Anthropic account settings screenshots |

---

## A1 — Availability {#a1}

### Uptime metrics

- Uptime monitoring provider dashboard (BetterUptime / UptimeRobot) — request read-only access from Engineering Lead
- Monthly uptime reports for the audit period

### Health check evidence

```bash
# Current API health
curl https://api.yourdomain.com/health

# Expected response: { status: "ok", db: "connected", redis: "connected" }
```

### Backup evidence

- AWS RDS / Azure Database backup configuration screenshot (Engineering Lead)
- Most recent backup restoration test report (quarterly)

---

## C1 — Confidentiality {#c1}

### Encryption evidence

```bash
# Encryption status report
GET /admin/security/encryption-status

# Authentication: PARTNER_ADMIN JWT
# Expected output: { covered: true, coveragePercent: 98, encryptedFields: [...] }
```

- AWS KMS / Azure Key Vault key inventory screenshot
- TLS certificate showing TLS 1.3 minimum (SSL Labs scan: ssllabs.com/ssltest)

### Tenant isolation evidence

- Code review of `TenantGuard` implementation (`src/common/guards/tenant.guard.ts`)
- Sample API requests demonstrating cross-tenant rejection (400/403 response)

### NDA records

- Employee NDA completion records (HR system)
- Vendor DPA register (Legal department)

---

## PI1 — Processing Integrity {#pi1}

### AI output audit trail

```bash
# List AI outputs for a sample tenant/user
GET /ai/outputs?tenantId={id}&from={start}&to={end}

# Authentication: PARTNER_ADMIN JWT
# Expected output: AIOutput records with model, tokensUsed, inputHash
```

### Disclaimer evidence

- Screenshot of AI output page showing disclaimer text
- User onboarding flow showing disclaimer acknowledgement

### Citation verification evidence

- Code review of `CitationVerificationService` (`src/ai/citation-verification.service.ts`)
- Sample AI research output showing citations with source URLs

---

## Audit Log Export (All Controls)

The master evidence export covers all API mutations for the audit period:

```bash
# Full audit log CSV export
GET /audit/logs/export?from=2025-06-01&to=2026-06-01

# Authentication: PARTNER_ADMIN JWT
# Response: CSV file download
# Columns: timestamp, userId, action, entityType, entityId, ipAddress, userAgent
```

This single export serves as primary evidence for:
- Access provisioning/de-provisioning (CC6)
- System operations events (CC7)
- Change management log (CC8)
- Data access events (C1)

---

## Contacts for Evidence Requests

| Role | Contact |
|------|---------|
| CISO / SOC 2 Owner | [ciso@yourdomain.com] |
| Engineering Lead | [engineering@yourdomain.com] |
| Legal / DPO | [legal@yourdomain.com] |

Responses to auditor evidence requests are provided within **3 business days**. Complex requests (e.g., database queries) may require up to **5 business days**.

---

*This runbook is reviewed before each audit engagement. Last reviewed: 2026-06-18.*
