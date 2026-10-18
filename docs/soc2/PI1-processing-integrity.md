# PI1 — Processing Integrity

**Version:** 1.0  
**Last Updated:** 2026-06-18  
**Owner:** Engineering Lead  

---

## PI1.1 — Complete and Accurate Processing

All AI-generated outputs include:

1. **Citation verification:** Citations are extracted and verified against source databases (CourtListener, India Kanoon, legislation.gov.uk) before being returned to the user.
2. **Substance verification:** AI outputs for legal research memos are validated by a secondary model check (`SubstanceVerificationService`) to flag hallucinations and unsupported claims.
3. **Sanity checks:** `LegalSanityCheckService` validates that AI recommendations are grounded in the applicable jurisdiction's law.
4. **Current law checks:** `CurrentLawCheckerService` verifies that cited statutes and cases have not been overruled, repealed, or superseded.

## PI1.2 — AI Output Disclaimer

All AI-generated content is clearly labelled as AI-generated. The platform displays a persistent disclaimer:

> "AI-generated analysis — verify all findings with a qualified lawyer before acting on any advice."

Users are required to acknowledge this disclaimer during onboarding and it is displayed on every AI output panel.

## PI1.3 — Input Validation

All user inputs are validated at both the API layer (NestJS `class-validator` DTOs) and the database layer (Prisma type constraints). Malformed inputs are rejected with structured error responses; no raw database errors are surfaced to users.

## PI1.4 — Error Handling

- All AI processing errors are caught and returned as structured errors with user-friendly messages.
- Partial AI failures (e.g., citation verification times out) are handled gracefully — the primary output is returned with a warning flag indicating incomplete verification.
- All errors are logged to Sentry with full context for debugging.

## PI1.5 — Audit Trail for AI Outputs

Every AI output is stored in the `AIOutput` table with:

- `userId`, `tenantId`, `matterId` (where applicable)
- `toolName` (the AI feature used)
- `model` (the specific AI model)
- `tokensUsed`, `creditsCharged`
- `inputHash` (SHA-256 of the input — for tamper evidence)
- `createdAt`

This allows firms to reconstruct exactly what AI was run on any document or matter, by whom, and when — providing an auditable chain of custody for all AI-assisted legal work.

## PI1.6 — Tabular Review Processing Integrity

The Tabular Review feature (clause-by-clause document comparison) includes:

- Two-pass processing: clause extraction followed by risk scoring
- Risk level validation: only `HIGH`, `MEDIUM`, `LOW`, `NONE` are accepted
- Change type validation: only `ADDED`, `REMOVED`, `MODIFIED`, `UNCHANGED` are accepted
- Malformed AI JSON is caught and partially repaired; if unrecoverable, an error is returned to the user

---

*Reviewed semi-annually. AI model changes trigger a fresh processing integrity assessment.*
