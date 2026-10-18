# GPT-5.6 hierarchy smoke checklist

After deploying Azure deployments (`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.4-mini`, `gpt-5.4-nano`, `text-embedding-3-small`) and restarting the backend:

## Research

1. **STANDARD (Terra + Sol verify)**  
   Run a normal lawyer research query (not Fast Answer).  
   Expect synthesis on `gpt-5.6-terra` and an independent adversarial pass on `gpt-5.6-sol` (findings may include `research:llm-adversarial:*`).

2. **COMPLEX (Sol synth + Sol verify)**  
   Run DEEP / constitutional or criminal research.  
   Expect synthesis on `gpt-5.6-sol` and hard verifier `gpt-5.6-sol` as a **second** completion.

3. **FAST / QUICK (Luna)**  
   Fast Answer should stay on `gpt-5.6-luna` without mandatory Sol adversarial (cost control).

4. **Gap-escalation ReAct (Luna)**  
   Bare-act / corpus gap that escalates to DEEP agent should use `AI_LEGAL_ORCHESTRATOR_MODEL` (`gpt-5.6-luna`), not mini.

## Drafting

5. **Unified draft (Terra + Sol reviewer on premium)**  
   Generate a standard court draft → substantive sections use Terra.  
   Premium / court-ready / escalated path uses Sol as `PREMIUM_REASONER` and Sol as `PREMIUM_REVIEWER` in a separate call.

6. **Lawyer-ready review loop**  
   Filing-grade jobs should emit stages `reviewing` → `applying_fixes` → `final_verify`.  
   Pleading review LLM must be `gpt-5.6-sol` (`PREMIUM_REVIEWER`), not Terra reviewing Terra output.

7. **Adversarial review (high/critical)**  
   Confirm opposing-counsel / judge LLM reviews call `gpt-5.6-sol`.

8. **Intake / extract (nano)**  
   Sparse-fact draft intake and draft-intent classification should log `gpt-5.4-nano` (`DEFAULT_EXTRACT_MODEL` / `AI_LEGAL_EXTRACT_MODEL`).  
   Case Brief extraction is deterministic (no LLM) via `DraftCaseBriefService`.

9. **Bulk mechanical (mini)**  
   Fill-blanks, cheap sections, and gateway cheap paths use `gpt-5.4-mini` (`DEFAULT_AUTO_MODEL` / `AI_LEGAL_BULK_MODEL`).  
   Note: research similar-case ranking stays deterministic — `AI_LEGAL_BULK_MODEL` is for drafting bulk LLM calls, not authority ranking.

10. **India Kanoon case-law retrieval**  
    Assert `INDIA_KANOON_API_KEY` is set in production.  
    Smoke: generate a bail draft and confirm retrieval logs include `sourceName: Indian Kanoon` (or curated bank + local corpus with an explicit warning if live IK unavailable).  
    Filing-grade `lawyer_ready` must not certify with 0 verified case authorities.

## Negative checks

- Whisper still uses `OPENAI_API_KEY` (not Azure).
- Claude only appears if GPT fails and fallback is configured.
- Deterministic citation / statute / hierarchy checks still run (LLM does not replace them).
- Missing-env gateway fallbacks resolve to Luna / Sol / mini — never `gpt-4.1*`.
- Do not use Opus as the default drafting model — hierarchy is nano → luna → terra → sol.
- Premium budget exhaustion must not silently downgrade grounds/arguments sections to Terra on bail/writ kinds.
