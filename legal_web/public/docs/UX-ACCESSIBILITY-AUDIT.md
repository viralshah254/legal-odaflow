# UX & Accessibility Audit — Series A

Audit baseline for 103 firm routes + consumer surfaces. Re-run before each major release.

## WCAG AA checklist (per route)

- [ ] Focus order logical; skip link on app shell
- [ ] All inputs have associated `<Label>` or `aria-label`
- [ ] Color contrast ≥ 4.5:1 for body text
- [ ] Keyboard: Tab through primary actions; Esc closes dialogs
- [ ] Error messages plain language with next step

## State coverage (required on async pages)

| State | Requirement |
|-------|-------------|
| Loading | Skeleton or spinner with `aria-busy` |
| Empty | Illustration + primary CTA |
| Error | Retry action; no raw API JSON |

## Priority routes (P0)

- `/auth/sign-in`, `/auth/sign-up`
- `/issue-checker` (consumer)
- `/portal`, `/portal/sign-in`
- `/app/matters/[matterId]`, `/app/matters/[matterId]/outcome`
- `/app/settings/permissions`, `/app/settings/ai-policy`

## Keyboard shortcuts (firm OS)

| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Command palette |
| `⇧⌘K` | Open Copilot |

## Completed in this pass

- Permissions + AI policy: no `alert()` saves; persisted to API
- Global search: keyboard-focusable results
- Plan usage panel: descriptive credit copy
- Post-deploy smoke script: `scripts/post-deploy-smoke.sh`

## Next audit cycle

Run Lighthouse on auth + portal + matter detail; file issues in Linear with route path.
