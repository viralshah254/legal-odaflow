# Matter Intelligence UI Standards (P21)

## Components
- **MatterIntelligencePanel** — primary MI surface for web (`legal_web/components/matter-intelligence/`)
- Use shadcn `Card`, `Badge`, `Button`; no custom color tokens outside theme

## Layout
- Matter chips: `Badge variant="secondary"`, 11px, wrap row
- Confidence: 1.5px track, semantic colors (emerald ≥80%, amber ≥50%, red below)
- Actions list: action-first, numbered, bordered rows
- Next best action: primary-tinted callout box

## States
| State | Behavior |
|-------|----------|
| Loading | Skeleton in parent (`DraftIntentPanel`) |
| Empty | Panel hidden when no `matterProfile` |
| Low confidence | Amber badge + banner + optional CTA |
| Clarification required | Questions replace search results |
| Error | Parent shows `CreditErrorBanner` / network error |

## Dark mode
- Use `text-muted-foreground`, `bg-muted/30`, `border-primary/25` — no hardcoded light-only colors except semantic amber/red/green accents with `dark:` variants

## Mobile
- Chips wrap; panel stacks vertically; touch targets ≥44px on CTAs
