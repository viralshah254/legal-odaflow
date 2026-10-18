# Promoting a country to a "deep" jurisdiction

The platform supports **every country** out of the box via the best-effort path
in [`jurisdiction-engine.ts`](../jurisdiction-engine.ts). A small set of
countries (US, IN, KE, GB) are "deep": hand-authored with citation styles, court
hierarchies, practice-area taxonomies, and ADR rules so AI output is
1000x more accurate.

This is the repeatable playbook to promote a best-effort country to deep.

## When to promote

Promote a country when it crosses a usage threshold (e.g. sustained lawyer
signups, research volume, or a go-to-market push for that market).

## Steps

1. **Author the deep profile.** Add `src/config/jurisdictions/<code>.ts`
   exporting a `DeepJurisdictionProfile` (copy `ke.ts` as the closest template
   for a mixed/common-law market, or `fr`-style for civil law). Fill in:
   - `legalSystem`, `languageOfRecord`
   - `citationStyle` — the official + neutral citation formats, with examples
   - `courtHierarchy` — apex to trial, plus tribunals and specialised courts
   - `practiceAreas` — the headline areas with their governing statutes
   - `adrPathways` — list each mechanism and its **binding status** (cite the act)
   - `limitationNotes`, `primaryLegislationStyle`

2. **Register it.** Import and add the profile to `DEEP_PROFILES` in
   [`jurisdiction-engine.ts`](../jurisdiction-engine.ts). It is now `tier: "deep"`.

3. **Add country config.** Add a `CountryConfig` entry in
   [`countries.ts`](../countries.ts) (currency, locale, timezone, payment
   providers, sub-national `supportedJurisdictions`) so pricing, credits, and
   the jurisdiction dropdowns light up.

4. **Compliance policy.** Add a `CountryCompliancePolicy` seed in
   `src/country-compliance/country-compliance.seed.ts` (restricted phrases,
   disclaimers, lawyer-review requirements).

5. **Legal sources / grounding.** Register source connectors in
   `src/legal-sources/legal-source.seed.ts`. Wire a live connector (or ingestion
   worker) so RAG has real authorities; until then the live web connector
   (Tavily, domain-routed) grounds answers.

6. **Frontend quick chips.** Add jurisdiction-specific quick prompts to
   `legal_web/components/dashboard/dashboard-ai-search.tsx` (`QUICK_PROMPTS`).

7. **Verify.** Run an AI Legal Search for the country and confirm:
   - Citations use the correct format
   - Court names and hierarchy are right
   - ADR binding status is correct
   - No hallucinated authorities (every cited source is verifiable)

## Checklist

- [ ] `src/config/jurisdictions/<code>.ts` authored
- [ ] Registered in `DEEP_PROFILES`
- [ ] `CountryConfig` added
- [ ] Compliance policy seeded
- [ ] Legal source connector wired
- [ ] Dashboard quick chips added
- [ ] Verified end-to-end with a live research query
