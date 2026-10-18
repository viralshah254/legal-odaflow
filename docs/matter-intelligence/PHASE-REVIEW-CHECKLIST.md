# Matter Intelligence Phase Review Checklist (P21)

Before marking any MI phase complete:

## Backend
- [ ] `npm run build` passes in `legal_backend`
- [ ] MI unit + contract tests pass
- [ ] Prisma schema migrated (if schema changed)
- [ ] No new unfiltered global form search paths

## Web
- [ ] `npm run lint && npm run build` in `legal_web`
- [ ] MatterIntelligencePanel renders on draft-intent
- [ ] i18n keys in `messages/en.json`

## Mobile
- [ ] `flutter analyze && flutter test` in `legal_app`
- [ ] Dart models in `lib/core/models/matter_intelligence.dart`

## Manual QA
- [ ] Arjun Patel fixture verified in draft-intent UI
- [ ] Low-confidence + clarification flows tested
- [ ] No P0/P1 regressions in QA matrix

## Release sign-off (P21-10)
All above green → phase may ship.
