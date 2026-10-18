# CC8 — Change Management

**Version:** 1.0  
**Last Updated:** 2026-06-18  
**Owner:** Engineering Lead  

---

## CC8.1 — Change Management Policy

All changes to production systems (code, infrastructure, configuration) must go through the formal change management process. Emergency hotfixes follow the expedited process with post-hoc review.

### Branch protection rules (GitHub)

- `main` branch is protected: direct pushes are blocked.
- All changes require a Pull Request with at least **1 approved review** from a non-author.
- PRs that touch authentication, billing, or data access paths require **2 approvals**.
- CI checks must pass before merge:
  - TypeScript compilation
  - ESLint (zero errors)
  - Jest unit tests (>80% coverage on changed files)
  - `prisma validate` (schema integrity)
  - Docker build

### Deployment pipeline

1. **Feature branch** → PR with code review → CI checks pass
2. **Merge to `main`** → Automatic deployment to **staging** environment
3. **Staging sign-off** → Manual approval gate in CI workflow
4. **Deploy to production** → Rolling deployment with health check validation
5. **Post-deploy monitoring** → Sentry error rate monitored for 30 minutes; auto-rollback triggers if error rate exceeds baseline by 200%

## CC8.2 — Infrastructure as Code

All infrastructure is defined in code:

- **Backend:** `docker-compose.yml`, `docker-compose.prod.yml`, Docker Swarm stack
- **Database migrations:** Prisma migrate (all migrations are version-controlled and reviewed as code)
- **Environment config:** Secrets stored in environment variables, never in code. `.env.example` documents all required variables.
- **CI/CD:** GitHub Actions workflows in `.github/workflows/`

No manual infrastructure changes are permitted without a corresponding IaC update.

## CC8.3 — Database Schema Changes

All database changes use Prisma migrations:

```bash
# Create migration (requires developer to provide descriptive name)
npx prisma migrate dev --name descriptive_migration_name

# Apply to production (automated in CI deploy)
npx prisma migrate deploy
```

Migrations are:
- Reviewed as part of the PR process
- Applied automatically in CI
- Reversible where possible (destructive migrations require explicit sign-off from the Engineering Lead)

## CC8.4 — Rollback Procedures

- **Code rollback:** Previous Docker image is retained for 30 days; rollback is a single command.
- **Database rollback:** Migrations are applied forward-only; pre-migration backups are taken before every production deployment.
- **Configuration rollback:** Environment variables are managed via secrets management; previous versions are retained.

---

*Reviewed semi-annually. Emergency change post-mortems are retained for 2 years.*
