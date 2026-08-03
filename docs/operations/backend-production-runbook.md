# Backend Production Runbook

## Release Preconditions

- MySQL 8.4+ uses InnoDB, TLS, automated encrypted backups, point-in-time recovery, and a least-privilege application account.
- Redis uses TLS/authentication, persistence appropriate to the rate-limit policy, and a private network endpoint.
- `DATA_ENCRYPTION_KEY`, OAuth credentials, database credentials, and Redis credentials come from a managed secret service. They are never committed or printed.
- CI unit, integration, authorization, dependency, and secret checks pass.

## Deploy

1. Back up the database and record the restore point.
2. Apply pending migrations with `node backend/scripts/run-migrations.js` using the migration identity and `DATABASE_URL` from the secret platform.
3. For first migration only, run `CONFIRM_STATE_MIGRATION=yes npm run migrate:state` from a secured maintenance environment.
4. Deploy with `backend/.env.production.example` supplied by the secret/config platform.
5. Require `/api/health` HTTP 200 for process liveness and `/api/ready` HTTP 200 for MySQL/Redis readiness.
6. Run login, role-scoped booking read, authorized update, and Admin workflow smoke tests.

## Backup and Restore

Detailed executable commands, destructive-operation guards, RPO/RTO drill steps, key recovery, and second-operator checks are maintained in [Production Recovery Runbook](production-recovery-runbook.md).


- Target RPO: 15 minutes. Target RTO: 60 minutes.
- Use managed MySQL snapshots plus binary-log point-in-time recovery. Encrypt backups with a key distinct from `DATA_ENCRYPTION_KEY`.
- Restore into an isolated environment monthly. Validate row count, encrypted payload authentication, readiness, login, role scoping, and a non-destructive workflow.
- Record restore duration, selected recovery point, validation results, operator, and defects.

## Rollback

1. Stop new writes by removing instances from readiness/load balancing.
2. Roll back the application artifact. Do not reverse a schema migration unless its tested down migration is explicitly approved.
3. If data recovery is needed, restore the pre-deploy snapshot/PITR point into a new database and switch the secret-managed endpoint.
4. Verify `/api/ready`, authorization, and audit continuity before restoring traffic.

## Alerts

- `/api/ready` failure for 2 consecutive minutes: page on-call.
- HTTP 5xx above 2% for 5 minutes, p95 API latency above 1 second, DB pool saturation above 80%, Redis failures, persistence conflicts above baseline, or email failure rate above 5%: alert.
- Never include request bodies, email addresses, tokens, credentials, or rendered email content in telemetry.

## Email Delivery

- Set `EMAIL_DELIVERY_TIMEOUT_MS` between 1000 and 60000, `EMAIL_DELIVERY_MAX_ATTEMPTS` between 1 and 5, and bounded jitter using `EMAIL_DELIVERY_BASE_DELAY_MS` and `EMAIL_DELIVERY_MAX_DELAY_MS`.
- The service retries only provider failures classified as occurring before acceptance. Timeout or ambiguous submission failures terminate without retry to avoid duplicate invitations.
- Alert on terminal failures and retry volume. A failed recipient requires a new campaign/resend workflow; do not manually replay provider requests.
- The current request-bound sender is not a crash-safe queue. Production release remains blocked until recipient claims, restart recovery, and provider webhook reconciliation are implemented and exercised.
## Required Drills

- Quarterly backup restore and key-access drill.
- Semiannual database failover and application rollback drill.
- Annual credential/key rotation and privacy deletion audit.
