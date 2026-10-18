# Mock data (quarantined)

These modules are **dev-only fixtures**. Production pages must not import from `@/lib/mock/*`.

- CI enforces this via `npm run check:no-mock`.
- Use real API clients under `lib/api/` for app routes.
- Keep mocks here for local prototyping and copilot demos only.
