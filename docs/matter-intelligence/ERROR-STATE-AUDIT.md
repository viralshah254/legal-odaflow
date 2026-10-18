# Matter Intelligence Error State Audit (P21-04)

| Surface | Network fail | Low credits | Low confidence | Timeout | Partial graph |
|---------|-------------|-------------|----------------|---------|---------------|
| DraftIntentPanel | CreditErrorBanner + retry | CreditErrorBanner | Low-confidence banner + filter matches | Generic error toast | Panel shows profile; graph optional |
| Issue checker classify | Wizard error state | Credit gate before preview | Clarifying questions | Analysis progress timeout | Profile without graph OK |
| Issue checker preview | ServiceUnavailableException | ForbiddenException credits | MI panel + report | AI preview fail message | taskGraph may be partial |
| India draft generate | API error | Credit enforcement | N/A | LLM timeout | Pre-draft gate BadRequestException |
| Copilot find_draft | Chat error | Credit gate | Falls back to generate | LLM timeout | Uses profile only |
| Matter workspace sidebar | Hidden if no data | N/A | Badge on panel | N/A | Shows available sections only |

All surfaces should degrade gracefully: MI enhances results but legacy paths remain when `MI_*` feature flags are false.
