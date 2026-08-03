# Production Recovery Runbook

## Prerequisites

Use this runbook from a secured operator shell with repository access, Docker, Node.js 20+, and the production or recovery environment variables supplied by the secret platform. Do not paste secrets, database URLs, activation tokens, provider credentials, email addresses from real users, or row contents into tickets, logs, screenshots, or chat.

Required environment values are supplied by the secret manager or local drill environment:

- `DATABASE_URL` points at the source or target MySQL database for the current step.
- `BACKUP_ENCRYPTION_KEY` is the preferred 32-byte backup key, encoded as 64 hex characters or base64. `DATA_ENCRYPTION_KEY` is accepted only for local drills when a distinct backup key is unavailable.
- `BACKUP_FILE` points at the encrypted backup artifact for check and restore steps.
- `BACKUP_DIR` points at the encrypted backup directory for retention cleanup.
- `CONFIRM_RESTORE=yes` is required for destructive restore.
- `CONFIRM_BACKUP_CLEANUP=yes` is required for destructive cleanup.
- `CONFIRM_BACKUP_RETENTION_DRILL=yes` is required for the executable retention cleanup drill.
- `CONFIRM_BACKUP_KEY_RECOVERY_DRILL=yes` is required for the executable backup key recovery drill.
- `CONFIRM_DEPLOYMENT_ROLLBACK_DRILL=yes` is required for the executable deployment/image rollback drill.
- `CONFIRM_MIGRATION_ROLLBACK=yes` is required for migration rollback.
- `CONFIRM_MIGRATION_ROLLBACK_DRILL=yes` is required for the executable migration rollback/reapply drill.
- `CONFIRM_RECOVERY_DRILL=yes` is required for the destructive timed recovery drill.

Before any destructive step, capture the operator, timestamp, target environment, selected recovery point, expected RPO, expected RTO, and approval link in the incident or release record.

## Backup

Create a fresh encrypted logical backup before deployment, migration, rollback, or recovery work.

```powershell
$env:DATABASE_URL = "mysql://user:password@host:3306/booking_dashboard"
$env:BACKUP_ENCRYPTION_KEY = "<32-byte-key-as-hex-or-base64>"
$env:BACKUP_DIR = ".tmp/recovery"
npm --prefix backend run backup:mysql
```

Expected output is a JSON summary with table names, row counts, checksums, and backup path. The command must not print row contents, passwords, activation tokens, provider secrets, or personal data.

## Integrity Check

Verify the encrypted artifact before trusting it as a restore point.

```powershell
$env:BACKUP_FILE = ".tmp/recovery/booking-dashboard-YYYYMMDDHHMMSS.json.enc"
$env:BACKUP_ENCRYPTION_KEY = "<32-byte-key-as-hex-or-base64>"
npm --prefix backend run check-backup:mysql
```

The check must authenticate AES-GCM metadata, decrypt with `BACKUP_ENCRYPTION_KEY`, recompute row counts and checksums, and print only safe backup summary fields.

## Restore

Restore only into an isolated recovery database first. Never restore directly over the current production database until the isolated restore, checks, approval, and traffic-drain steps are complete.

```powershell
$env:DATABASE_URL = "mysql://user:password@host:3306/booking_dashboard_recovery"
$env:BACKUP_FILE = ".tmp/recovery/booking-dashboard-YYYYMMDDHHMMSS.json.enc"
$env:BACKUP_ENCRYPTION_KEY = "<32-byte-key-as-hex-or-base64>"
$env:CONFIRM_RESTORE = "yes"
CONFIRM_RESTORE=yes npm --prefix backend run restore:mysql
```

After restore, run readiness and smoke checks before any cutover decision.

## Retention Cleanup

Run cleanup in dry-run mode first and review every planned removal.

```powershell
$env:BACKUP_DIR = ".tmp/recovery"
$env:BACKUP_RETENTION_DAYS = "30"
$env:BACKUP_RETENTION_COUNT = "14"
npm --prefix backend run cleanup-backups:mysql
```

Only after a second operator verifies the dry-run plan:

```powershell
$env:CONFIRM_BACKUP_CLEANUP = "yes"
CONFIRM_BACKUP_CLEANUP=yes npm --prefix backend run cleanup-backups:mysql
```

Cleanup output must include scanned, removed, retained, reason, and path summary only. It must not print decrypted backup payloads or row contents.
```powershell
$env:CONFIRM_BACKUP_RETENTION_DRILL = "yes"
CONFIRM_BACKUP_RETENTION_DRILL=yes npm --prefix backend run backup:retention-drill
```


## Timed RPO/RTO Drill

Run this drill monthly in Docker or an isolated recovery environment.

1. Record `started_at`, selected recovery point, target RPO of 15 minutes, and target RTO of 60 minutes.
2. Rebuild the empty target database with `docker compose config --quiet` and `docker compose up -d`.
3. Apply migrations with `node backend/scripts/run-migrations.js` from the repository root, with `DATABASE_URL` pointing at the recovery database.
4. Run the executable timed drill:

```powershell
$env:CONFIRM_RECOVERY_DRILL = "yes"
$env:RECOVERY_DRILL_RPO_MINUTES = "15"
$env:RECOVERY_DRILL_RTO_MINUTES = "60"
CONFIRM_RECOVERY_DRILL=yes npm --prefix backend run recovery:drill
```

The drill creates a backup with `npm --prefix backend run backup:mysql`, verifies it with `npm --prefix backend run check-backup:mysql`, restores with `CONFIRM_RESTORE=yes npm --prefix backend run restore:mysql`, and runs post-restore smoke unless `RECOVERY_DRILL_SKIP_SMOKE=yes` is set for a unit-only dry run.

Record the JSON summary containing `startedAt`, `completedAt`, `targets`, `measurements`, restored table/row counts, smoke result, and step durations.

The drill is passing only when the restored database is consistent, readiness succeeds, post-restore smoke passes, and elapsed time is within the documented target.

## Post-Restore Smoke

Use both API readiness and a light application smoke after restore.

```powershell
npm --prefix backend run load:smoke:local
```

The smoke must include process health, dependency readiness, role-scoped booking reads, an authorized update path when safe, and absence of duplicate side effects. If smoke fails, keep traffic on the old environment and open an incident record.

## Failed Deployment Rollback

1. Stop promotion and drain the unhealthy artifact from readiness or load balancing.
2. Keep the database unchanged unless an approved data recovery path is required.
3. Redeploy the previous immutable application image or artifact.
4. Run `/api/health`, `/api/ready`, and `npm --prefix backend run load:smoke:local`.
5. Compare request logs, metrics, and audit events by correlation ID before restoring traffic.

For a local manifest-based rehearsal, provide the failed digest and the previous known-good digest. Do not use mutable tags such as `latest`.

```powershell
$env:CONFIRM_DEPLOYMENT_ROLLBACK_DRILL = "yes"
$env:ROLLBACK_PREVIOUS_IMAGE = "booking-dashboard/backend@sha256:<last-known-good-digest>"
$env:ROLLBACK_FAILED_IMAGE = "booking-dashboard/backend@sha256:<failed-digest>"
npm --prefix backend run deployment:rollback-drill
```

Inline shell equivalent for non-PowerShell operators: `CONFIRM_DEPLOYMENT_ROLLBACK_DRILL=yes npm --prefix backend run deployment:rollback-drill`.

The drill verifies immutable image digests, required previous-image gates, health/readiness/smoke steps, failed-image retention, and explicit operator approval before traffic restoration. It prints only shortened digests and safe checklist fields.

## Failed Migration Rollback

Migration rollback is destructive and must be approved per migration. Roll back only the latest migration and only when its tested down migration is explicitly approved.

```powershell
$env:CONFIRM_MIGRATION_ROLLBACK = "yes"
$env:DATABASE_URL = "mysql://user:password@host:3306/booking_dashboard_recovery"
CONFIRM_MIGRATION_ROLLBACK=yes node backend/scripts/run-migrations.js rollback 002-normalized-domain
```

If the latest migration is not `002-normalized-domain`, the command fails rather than rolling back an unexpected version. After rollback, rerun `node backend/scripts/run-migrations.js` in the isolated environment to prove forward recovery still works.

For a full local rehearsal, use the executable rollback/reapply drill:

```powershell
$env:CONFIRM_MIGRATION_ROLLBACK_DRILL = "yes"
$env:MIGRATION_ROLLBACK_DRILL_VERSION = "002-normalized-domain"
CONFIRM_MIGRATION_ROLLBACK_DRILL=yes npm --prefix backend run migration:rollback-drill
```

The drill applies pending migrations, verifies the expected latest version, rolls it back, verifies it was removed, reapplies migrations, and prints only version lists and timings.

## Image Rollback

1. Identify the last known good image digest from the release record.
2. Confirm the image was built by CI and passed security, backend, frontend, compose, runbook, and smoke gates.
3. Deploy the last known good digest without changing secrets.
4. Run readiness, smoke, and audit continuity checks.
5. Keep the failed digest for forensic review until the incident owner approves cleanup.

## Key Recovery

1. Verify the operator has break-glass approval for `BACKUP_ENCRYPTION_KEY` access.
2. Retrieve the key through the managed secret platform only. Do not paste secrets into logs, tickets, screenshots, shell history, or persistent browser storage.
3. Verify a backup with `npm --prefix backend run check-backup:mysql`.
4. Prove the recovered key can decrypt a synthetic encrypted backup and that a wrong key is rejected.

```powershell
$env:CONFIRM_BACKUP_KEY_RECOVERY_DRILL = "yes"
$env:BACKUP_ENCRYPTION_KEY = "<secret-manager-value>"
npm --prefix backend run backup:key-recovery-drill
```

Inline shell equivalent for non-PowerShell operators: `CONFIRM_BACKUP_KEY_RECOVERY_DRILL=yes npm --prefix backend run backup:key-recovery-drill`.

5. Record only the safe JSON summary fields: `ok`, `format`, `algorithm`, `tableCount`, `rowCount`, `correctKeyVerified`, `wrongKeyRejected`, and `safeSummaryOnly`.
6. Rotate the key after the incident if access was broadened, and create a new encrypted backup with the replacement key.

## Incident Triage

For backup, restore, migration, deployment, or readiness incidents, capture:

- Incident ID, owner, severity, environment, and started time.
- Correlation IDs from failed requests, sanitized logs, metrics, and audit events.
- Current artifact or image digest and migration version.
- Recovery point, backup checksum summary, RPO/RTO status, and next decision time.
- Customer or user impact without personal data.

Escalate immediately when readiness is down for 2 consecutive minutes, 5xx exceeds 2 percent for 5 minutes, p95 API latency exceeds 1 second, database pool saturation exceeds 80 percent, Redis failures persist, or email failure rate exceeds 5 percent.

## Second-Operator Checklist

A second operator must verify before production restore, cleanup, rollback, or key recovery:

- The target environment is correct and isolated when required.
- The selected backup file and checksum summary match the incident or release record.
- `BACKUP_ENCRYPTION_KEY` or `DATA_ENCRYPTION_KEY` is available through approved secret access only.
- Destructive guards are present: `CONFIRM_RESTORE=yes`, `CONFIRM_BACKUP_CLEANUP=yes`, or `CONFIRM_MIGRATION_ROLLBACK=yes`.
- Commands are copied from this runbook without exposing secrets.
- Post-action readiness, smoke, logs, metrics, audit events, and RPO/RTO results are recorded.

