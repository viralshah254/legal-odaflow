# CC6 — Logical and Physical Access Controls

**Version:** 1.0  
**Last Updated:** 2026-06-18  
**Owner:** CISO  

---

## CC6.1 — Logical Access Security Measures

### Authentication

- All user accounts require email + password with a minimum of 12 characters, upper/lower/number/symbol.
- JWT tokens expire after **8 hours**. Refresh tokens expire after **30 days**.
- Add-in tokens (Office.js) expire after **8 hours**.
- OAuth SSO is supported (Google, Microsoft) and configured per tenant.

### Multi-Factor Authentication (MFA)

- MFA is **required** for all `PARTNER_ADMIN` and `JUNIOR_PARTNER` roles.
- MFA is **strongly recommended** for all other roles.
- The weekly automated access review flags any admin account with no MFA record.

### Role-Based Access Control (RBAC)

| Role | Description | Access Level |
|------|-------------|-------------|
| `PARTNER_ADMIN` | Full firm administration | All resources in tenant |
| `JUNIOR_PARTNER` | Senior lawyer | All matters, billing |
| `ASSOCIATE` | Mid-level lawyer | Assigned matters, time |
| `PARALEGAL` | Support staff | Assigned matters, documents |
| `INTAKE` | Intake/reception | New clients, new matters |
| `FINANCE` | Finance/billing | Invoices, trust, reports |
| `OPS_HR` | HR/operations | Team management |
| `READ_ONLY` | Auditor/observer | Read-only across tenant |

Role assignments are managed in the `TenantUser` table and enforced via `TenantGuard` on every API endpoint.

### Ethical Walls

Ethical wall groups (`EthicalWallGroup`) can be applied to matters to prevent conflicts of interest. When applied, only members of the specified group can access the matter.

## CC6.2 — Access Provisioning and De-provisioning

### Provisioning
- Accounts are created by `PARTNER_ADMIN` role only.
- A system audit log entry is created for every account creation, modification, and deletion.
- New accounts begin with the minimum required role.
- **SCIM v2 provisioning** is supported for enterprise identity providers (Okta, Azure AD, Google Workspace). The SCIM endpoint at `/api/v1/auth/scim/v2/{tenantId}/Users` handles `POST`, `PATCH`, and `DELETE` operations; bearer token is rotated by the tenant admin from `/app/settings/sso`.

### De-provisioning
- Account deletion or `isActive = false` revokes all active JWT sessions on next request.
- When an employee leaves, the `PARTNER_ADMIN` is responsible for disabling the account within **24 hours**.
- SCIM `DELETE /Users/{id}` hard-deletes the `TenantUser` record and invalidates all tokens within one request cycle.
- The weekly access review flags accounts inactive for more than 30 days that still hold elevated roles.

### SAML/SSO enforcement
- Enterprise tenants may enforce SSO-only authentication (`ssoEnforced = true`), blocking email/password login for all non-admin accounts.
- SP-initiated SSO uses ACS endpoint `/api/v1/auth/saml/acs`. Entity ID and metadata are available per-tenant at `/api/v1/auth/saml/sp/{tenantId}/metadata`.
- IdP certificate rotation requires re-uploading the new certificate and saving; old sessions remain valid until their natural expiry (8 h).

## CC6.3 — Access Removal

- Access is revoked immediately upon role change downgrade or account deactivation.
- All JWT tokens are validated against the user's `isActive` and `tenantId` on every request.
- Revocation events are logged to `AuditLog`.

## CC6.4 — Periodic Access Review

An automated access review runs every Monday at 03:00 UTC (`SecurityReviewScheduler`). It flags:

- `PARTNER_ADMIN` accounts with no activity in the past 30 days
- Tokens older than 90 days (non-refresh)
- Users with no MFA record holding elevated roles

Findings are written to the `AuditLog` with `action: SOC2_ACCESS_REVIEW_FINDING:*` and are retrievable via `GET /audit/logs`.

## CC6.5 — Physical Access

All infrastructure is hosted in cloud environments (AWS, Azure, GCP) with no on-premises hardware. Physical access controls are inherited from cloud provider SOC 2 certifications:

- AWS SOC 2 Type II: [aws.amazon.com/compliance/soc](https://aws.amazon.com/compliance/soc)
- Azure SOC 2 Type II: [azure.microsoft.com/compliance](https://azure.microsoft.com/compliance)

---

*Reviewed annually by CISO. Changes require CISO sign-off.*
