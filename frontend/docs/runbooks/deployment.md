# Deployment Runbook

## Preconditions

- Required CI checks pass on the immutable release revision.
- Environment configuration is supplied by the deployment platform; secrets are not committed or exposed as `NEXT_PUBLIC_*` values.
- Backend health and database migration status are confirmed by their owners.

## Deploy

1. Record the revision and release identifier.
2. Install with `npm ci` and build with `npm run build`.
3. Deploy the generated Next.js application using the approved platform process.
4. Verify `/`, `/forgot-password`, and backend health through the staging URL.
5. Run `PLAYWRIGHT_BASE_URL=<staging-url> npm run test:e2e` with test accounts and approved fixtures.
6. Confirm frontend error rate, API latency, login success, booking search, and email workflow telemetry.
7. Promote only after the release owner records approval.

## Stop Conditions

Stop promotion for failed required checks, missing release metadata, elevated frontend errors, failed authentication, incompatible backend health, or missing rollback access.
