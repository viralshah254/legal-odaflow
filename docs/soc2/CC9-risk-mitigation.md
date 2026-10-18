# CC9 — Risk Mitigation and Vendor Assessment

**Version:** 1.0  
**Last Updated:** 2026-06-18  
**Owner:** CTO / CISO  

---

## CC9.1 — Risk Assessment Process

A formal risk assessment is conducted annually and after any material change to the system (new AI providers, new geographic markets, major architecture changes). Risks are tracked in the risk register with:

- **Likelihood:** 1–5 scale
- **Impact:** 1–5 scale  
- **Inherent risk score:** Likelihood × Impact
- **Controls in place**
- **Residual risk score** after controls

Any residual risk score ≥ 12 requires board-level acceptance.

## CC9.2 — Vendor Assessment

All third-party vendors with access to client data or system infrastructure are assessed before onboarding.

### AI Providers

| Vendor | Purpose | Data Sent | Certifications | Retention Policy |
|--------|---------|-----------|---------------|-----------------|
| OpenAI | GPT-5 legal AI features | Document text (no PII unless in document) | SOC 2 Type II | Zero data retention (API usage policy) |
| Anthropic | Claude legal AI features | Document text (no PII unless in document) | SOC 2 Type II | Zero data retention (commercial API) |

**Note:** Customers are given clear notice that documents sent for AI analysis may be processed by AI providers. Model training opt-out is enforced via training consent records (`TrainingConsent` table).

### Cloud Infrastructure

| Vendor | Purpose | Certifications |
|--------|---------|---------------|
| AWS | Primary cloud (compute, storage, RDS) | SOC 2 Type II, ISO 27001, PCI DSS |
| Azure | Secondary cloud, Microsoft services | SOC 2 Type II, ISO 27001 |
| GCP | Optional region availability | SOC 2 Type II, ISO 27001 |

### Payment Processing

| Vendor | Purpose | Certifications |
|--------|---------|---------------|
| Stripe | Payment processing, subscription billing | SOC 2 Type II, PCI DSS Level 1 |

### Authentication

| Vendor | Purpose | Certifications |
|--------|---------|---------------|
| Firebase Auth | Consumer authentication (optional) | SOC 2 Type II |

### Communication

| Vendor | Purpose | Data |
|--------|---------|------|
| SendGrid / Resend | Transactional email | Email address, name, notification content only |
| Twilio (optional) | SMS OTP | Phone number, OTP only — no legal data |

## CC9.3 — Vendor Offboarding

When a vendor relationship ends:
1. API keys and credentials are revoked immediately
2. Data deletion confirmation is requested within 30 days
3. Evidence of deletion is retained for 1 year
4. Risk register is updated to reflect the change

## CC9.4 — Insurance

The organisation maintains:
- **Cyber liability insurance:** Covers data breach notification costs, regulatory fines (subject to policy limits), and business interruption
- **Professional indemnity:** Covers errors and omissions related to legal AI output

---

*Risk register reviewed annually. Vendor assessments renewed annually or upon vendor material change.*
