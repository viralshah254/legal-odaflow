# Gemini provider canary (IN / KE)

## Flags

- `AI_ALLOWED_PROVIDERS=openai,deepseek,google`
- **Either** `GOOGLE_AI_API_KEY` (AI Studio) **or** Vertex: `GOOGLE_CLOUD_PROJECT` + `VERTEX_LOCATION` + `GOOGLE_APPLICATION_CREDENTIALS`
- `GEMINI_MODEL=gemini-2.5-flash` — default when a route passes a non-Gemini model id
- `AI_LEGAL_COMPLEX_MODEL=gemini-2.5-pro` (optional override)
- `LEGAL_RESEARCH_GEMINI_CANARY=false` — set `true` to route a fraction of STANDARD research to Gemini when configured

## Rollback

1. Remove `google` from `AI_ALLOWED_PROVIDERS`.
2. Redeploy API — `LlmCompletionService` skips unconfigured providers automatically.
3. No schema migration rollback required.

## Verification

- `npm test -- legal-research-model-router.spec.ts`
- Manual: set `AI_LEGAL_FAST_MODEL=gemini-2.5-flash` in staging and run one research job.
