# CC1 — Control Environment

**Version:** 1.0  
**Last Updated:** 2026-06-18  
**Owner:** CISO / CTO  

---

## CC1.1 — Commitment to Integrity and Ethical Values

The organisation maintains a written Code of Conduct that applies to all employees, contractors, and vendors. The Code covers:

- Confidentiality of client data and attorney-client privilege
- Prohibition on unauthorised access to tenant data
- Mandatory reporting of security incidents within 24 hours
- Zero-tolerance policy for circumventing access controls

All personnel acknowledge the Code of Conduct at onboarding and annually thereafter. Acknowledgements are recorded in the HR system.

## CC1.2 — Board Oversight

The Board of Directors (or its designated committee) reviews the organisation's risk profile and security posture at least annually. The review covers:

- SOC 2 audit findings and remediation status
- Material security incidents from the prior period
- AI model risk and vendor dependency assessment
- Data breach exposure and cyber insurance adequacy

## CC1.3 — Organisational Structure

| Role | Security Responsibility |
|------|------------------------|
| CEO | Ultimate accountability for security programme |
| CTO / CISO | Owns security policy, architecture, and audit readiness |
| Engineering Lead | Enforces secure SDLC; PR reviews; dependency scanning |
| Operations Lead | Access provisioning; vendor management; incident response |
| All Engineers | Follow secure coding standards; participate in incident response |

## CC1.4 — Commitment to Competence

Security training is mandatory:

- **Onboarding:** Security awareness, data classification, incident reporting procedures
- **Annual:** Updated threat landscape, phishing simulation, SOC 2 obligations
- **Developers:** OWASP Top 10, secure code review practices, secrets management

Training completion is tracked and non-compliance is escalated to HR.

## CC1.5 — Accountability

Performance objectives for all roles with system access include security metrics. Engineering managers are held accountable for:

- Patch SLA compliance (critical: 24hr, high: 7 days)
- Zero critical/high findings left unresolved after 30 days
- 100% audit log coverage on all mutating API endpoints

---

*This document is reviewed annually by the CISO and updated to reflect organisational changes.*
