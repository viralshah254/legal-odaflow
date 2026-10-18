# C1 — Confidentiality

**Version:** 1.0  
**Last Updated:** 2026-06-18  
**Owner:** CISO  

---

## C1.1 — Data Classification

| Classification | Definition | Examples |
|---------------|-----------|---------|
| **Highly Confidential** | Attorney-client privileged, legally sensitive | Matter documents, client communications, legal advice |
| **Confidential** | Business sensitive, contractual obligations | Billing data, employee records, AI outputs |
| **Internal** | Internal operations, not for external sharing | System logs, analytics, configuration |
| **Public** | Intentionally public-facing | Marketing content, public API docs |

All client legal data is treated as **Highly Confidential** by default.

## C1.2 — Encryption

### Encryption at rest

- PostgreSQL database: encrypted at rest using AES-256 via cloud provider disk encryption (AWS EBS, Azure Managed Disks).
- Application-level encryption: sensitive fields (e.g., SSN, national ID, payment method tokens) are encrypted using AES-256-GCM before storage.
- File storage (S3 / Azure Blob): server-side encryption with AES-256 (SSE-S3 or SSE-KMS).
- Redis: persistence (AOF/RDB) files are stored on encrypted volumes.

### Encryption in transit

- All API traffic requires TLS 1.3 minimum. TLS 1.0/1.1 are disabled.
- Certificate renewal is automated via Let's Encrypt or AWS ACM.
- Internal service-to-service communication is encrypted (mTLS in Kubernetes/Swarm environments).

### Key management

- Encryption keys are managed via AWS KMS or Azure Key Vault (depending on deployment region).
- Key rotation is performed annually (automated for data keys; root keys never leave KMS).
- API secrets (JWT_SECRET, database credentials) are stored in environment variables managed by the secrets manager; never in version control.

## C1.3 — Tenant Isolation

All data is logically isolated by `tenantId`:

- Every database query includes a `tenantId` filter.
- The `TenantGuard` NestJS guard validates that the authenticated user's tenant matches the resource's tenant on every mutating request.
- Tenant data cannot be accessed by other tenants, including by system administrators in normal operations.
- Cross-tenant queries are only possible via super-admin endpoints which are separately guarded (`SuperAdminGuard`) and require explicit justification in the audit log.

## C1.4 — Data Minimisation

- AI providers receive only the minimum necessary data (document text, query text).
- No names, emails, or other direct identifiers are sent to AI providers unless the user explicitly includes them in the document.
- Anonymisation is available for research data (`AnonymizationModule`).
- Training data consent is explicitly collected and recorded (`TrainingConsent` table).

## C1.5 — Confidentiality Agreements

- All employees and contractors sign NDAs covering client data before system access is granted.
- Third-party vendors with data access sign a Data Processing Agreement (DPA).
- AI providers are contractually bound to zero data retention and no training on customer data (verified annually).

---

*Reviewed annually by CISO. Encryption key inventory reviewed semi-annually.*
