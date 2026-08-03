# Quality Report: Production Readiness Phase 8 Backup, Restore, Deployment, and Runbooks

- Date: 2026-08-03
- Reviewer/agent: Codex
- Changed surface: Encrypted MySQL backup/check/restore/cleanup tooling, executable timed recovery drill tooling, restored-environment smoke, migration rollback drill tooling, backup retention cleanup drill tooling, backup key recovery drill tooling, deployment rollback drill tooling, recovery runbooks, runbook validation, and obsolete recovery-doc/dead-file cleanup
- Overall gate: `BLOCKED - local backup, timed restore drill, migration rollback drill, retention cleanup drill, backup key recovery drill, deployment rollback manifest drill, post-restore smoke, and runbook foundation verified; operational gates incomplete`

## Applicable IDs

- API: `API-015`, `API-020`, `API-021`, `API-022`, `API-026`, `API-027`, `API-029`, `API-030`
- UI/UX: N/A for this slice; no rendered user-facing workflow changed.

## Evidence

- Added encrypted logical MySQL backup, integrity-check, restore, and guarded cleanup scripts:
  - `backend/scripts/mysql-backup.js`
  - `backend/scripts/mysql-backup-check.js`
  - `backend/scripts/mysql-restore.js`
  - `backend/scripts/mysql-backup-cleanup.js`
  - shared implementation in `backend/src/mysql-backup.js`
- Backup encryption requires `BACKUP_ENCRYPTION_KEY` or `DATA_ENCRYPTION_KEY` to encode exactly 32 bytes and uses `aes-256-gcm`.
- Backup summaries report table names, row counts, and checksums only; row contents are not printed by the scripts.
- Cleanup planning is dry-run by default and requires `CONFIRM_BACKUP_CLEANUP=yes` for destructive removal.
- Added executable recovery runbook: `docs/operations/production-recovery-runbook.md`.
- Updated `docs/operations/backend-production-runbook.md` to reference the executable recovery runbook and the current migration CLI instead of the obsolete unsuffixed SQL file.
- Added guarded timed recovery drill orchestration: `backend/src/recovery-drill.js` and `backend/scripts/recovery-drill.js`.
- Added backend npm script `recovery:drill`, which requires `CONFIRM_RECOVERY_DRILL=yes`, runs backup, integrity check, restore with `CONFIRM_RESTORE=yes`, optional post-restore smoke, and reports safe RPO/RTO measurements.
- Updated `backend/scripts/load-smoke.js` so recovery drills can set `LOAD_SMOKE_USE_CURRENT_ENV=true` and run post-restore smoke against the restored MySQL environment instead of a temporary file-backed backend.
- Hardened recovery drill child-process failure handling to redact sensitive environment values and MySQL URLs from stdout/stderr before surfacing errors.
- Added guarded migration rollback/reapply drill: `backend/src/migration-rollback-drill.js` and `backend/scripts/migration-rollback-drill.js`.
- Added guarded backup retention cleanup drill: `backend/src/backup-retention-drill.js` and `backend/scripts/backup-retention-drill.js`.
- Added guarded backup key recovery drill: `backend/src/backup-key-recovery-drill.js` and `backend/scripts/backup-key-recovery-drill.js`.
- Added guarded deployment/image rollback manifest drill: `backend/src/deployment-rollback-drill.js` and `backend/scripts/deployment-rollback-drill.js`.
- Added backend npm script `migration:rollback-drill`, which requires `CONFIRM_MIGRATION_ROLLBACK_DRILL=yes`, applies migrations, verifies the expected latest migration, rolls it back, verifies removal, reapplies, and reports only versions and timings.
- Added backend npm script `backup:retention-drill`, which requires `CONFIRM_BACKUP_RETENTION_DRILL=yes`, proves cleanup dry-run candidates, runs confirmed cleanup in a disposable directory, verifies remaining files, and reports only filenames/reasons/counts.
- Added backend npm script `backup:key-recovery-drill`, which requires `CONFIRM_BACKUP_KEY_RECOVERY_DRILL=yes`, verifies decryption with the configured 32-byte backup key, rejects a wrong key, and reports only safe summary fields.
- Added backend npm script `deployment:rollback-drill`, which requires `CONFIRM_DEPLOYMENT_ROLLBACK_DRILL=yes`, verifies immutable previous/failed image digests, checks required previous-image gates, and reports a safe rollback checklist.
- Added runbook validation gate: `scripts/validate-production-runbooks.mjs`.
- Added runbook validator coverage: `test/production-runbooks.test.mjs`.
- Added root scripts: `runbooks:check` and `test:runbooks`.
- Wired runbook validation into `.github/workflows/production-quality.yml` and made docs changes trigger the workflow.
- Removed confirmed obsolete/dead artifacts after reference checks:
  - `backend/migrations/001-application-state.sql`, superseded by `001-application-state.up.sql`/`.down.sql` and not used by the migration runner.
  - `docs/quality-reports/production-readiness-plan-2026-08-02.md`, superseded by the current local implementation plan and phase reports.
  - `docs/quality-reports/production-readiness-plan-coverage-2026-08-03.md`, superseded by the current local implementation plan and acceptance report.

## Automated Verification

- `npm run test:runbooks`: PASS, 2/2.
- `npm run runbooks:check`: PASS, checked 13 required headings, 26 required safety/command snippets, and 10 backend recovery scripts.
- `node --test test/mysql-backup.test.js test/recovery-drill.test.js` from `backend`: PASS, 9/9 encrypted backup/check/restore/cleanup, recovery drill orchestration, fail-closed, and redaction tests.
- `node --test test/migration-rollback-drill.test.js test/migrations.test.js` from `backend`: PASS, 5/5 migration rollback-drill guard/version and migration discovery/reversibility tests.
- `node --test test/backup-retention-drill.test.js test/mysql-backup.test.js` from `backend`: PASS, 7/7 retention drill and backup/cleanup safety tests.
- `node --test test/backup-key-recovery-drill.test.js test/mysql-backup.test.js` from `backend`: PASS, 9/9 key-recovery and backup encryption/verification tests.
- `node --test test/deployment-rollback-drill.test.js` from `backend`: PASS, 4/4 deployment rollback guard, digest, gate, and safe-summary tests.
- `node --test test/recovery-drill.test.js test/load-smoke.test.js` from `backend`: PASS, 7/7 after adding restored-environment smoke support.
- `npm --prefix backend run test`: PASS, 108 total, 105 passed, 3 known host infrastructure skips, 0 failed.
- Cleanup reference audit: PASS before evidence update for `001-application-state.sql`, `production-readiness-plan-2026-08-02`, and `production-readiness-plan-coverage-2026-08-03`; current mentions are cleanup evidence only.
- `git diff --check`: PASS with Git line-ending warnings only.
- Isolated timed Docker/MySQL recovery drill passed using a disposable `mysql:8.4` container, generated local-only credentials, and restored-environment backend smoke:
  - Command path: `CONFIRM_RECOVERY_DRILL=yes npm --prefix backend run recovery:drill`.
  - Result: `ok: true`, RPO age `0.12` minutes / 15 minute target, RTO `0.13` minutes / 60 minute target, elapsed `7805 ms`.
  - Restored `23` tables and `3` rows after encrypted backup and integrity check.
  - Post-restore smoke against the restored MySQL environment: `277` requests, `0` failures, p95 `16.73 ms`.
  - Step timings: backup `618 ms`, integrity check `231 ms`, restore `713 ms`, post-restore smoke `6242 ms`.
  - Disposable drill container was removed and generated encrypted backup artifact was deleted after verification.
- Isolated MySQL migration rollback/reapply drill passed using a disposable `mysql:8.4` container and generated local-only credentials:
  - Command path: `CONFIRM_MIGRATION_ROLLBACK_DRILL=yes npm --prefix backend run migration:rollback-drill`.
  - Result: `ok: true`, expected version `002-normalized-domain`, migration count `2`, elapsed `5085 ms`.
  - Before rollback: `001-application-state`, `002-normalized-domain`.
  - After rollback: `001-application-state`.
  - After reapply: `001-application-state`, `002-normalized-domain`.
  - Step timings: apply `2354 ms`, rollback `1031 ms`, reapply `1661 ms`.
  - Disposable rollback-drill container was removed after verification.
- Executable backup retention cleanup drill passed in a disposable local directory:
  - Command path: `CONFIRM_BACKUP_RETENTION_DRILL=yes npm --prefix backend run backup:retention-drill`.
  - Dry-run: scanned `4` backup files and identified `2` removal candidates.
  - Confirmed cleanup: removed `2` files for `retention_count`.
  - Final dry-run: scanned `2` retained backup files with `0` candidates.
  - Remaining files: `booking-dashboard-001-newest.json.enc`, `booking-dashboard-002-recent.json.enc`, and ignored `notes.txt`.
  - Disposable drill directory was removed after verification and drill output did not include backup file contents.
- Executable backup key recovery drill passed with a generated local-only 32-byte key:
  - Command path: `CONFIRM_BACKUP_KEY_RECOVERY_DRILL=yes npm --prefix backend run backup:key-recovery-drill`.
  - Result: `ok: true`, format `booking-dashboard-mysql-backup-v1`, algorithm `aes-256-gcm`, table count `1`, row count `1`.
  - Correct key verification passed and wrong-key rejection passed.
  - Output included `safeSummaryOnly: true` and did not include key material or drill row contents.
- Executable deployment/image rollback manifest drill passed with synthetic immutable digests:
  - Command path: `CONFIRM_DEPLOYMENT_ROLLBACK_DRILL=yes npm --prefix backend run deployment:rollback-drill`.
  - Result: `ok: true`, mode `local-manifest-drill`, immutable digest verification passed, required previous-image gates passed for security, backend, frontend, compose, runbook, and smoke.
  - Rollback plan covered stop-promotion, keep-database-unchanged, deploy previous immutable image, health/ready/smoke, logs/metrics/audit comparison, and failed-image forensic retention.
  - Output shortened image digests, required operator approval before traffic restore, and reported `safeSummaryOnly: true`.
- Earlier cleanup CLI dry-run smoke passed against an empty workspace backup directory with `scanned: 0`, `removed: 0`.

## Blockers

- Retention cleanup is now rehearsed locally with dry-run and confirmed cleanup in a disposable directory. Production scheduling and second-operator approval of a real backup directory are not proven here.
- Failed migration rollback/reapply is now rehearsed locally against isolated MySQL, and backup key recovery is rehearsed locally against a synthetic encrypted payload. Deployment/image rollback is now rehearsed locally as a manifest drill with immutable digests and gate checks. Real orchestrator rollback, managed secret-platform break-glass/rotation, and incident workflows remain documented and machine-checked but not proven with live operational evidence.
- No second-operator runbook execution evidence is available.
- The timed restore drill used synthetic local seed data in a disposable MySQL container; it is not a managed backup/PITR or production-sized restore exercise.

## Exit Decision

Phase 8 remains `BLOCKED`. The repository now has working encrypted recovery tooling, a passing isolated timed Docker/MySQL restore drill with post-restore smoke, a passing isolated migration rollback/reapply drill, a passing retention cleanup drill, guarded redacted drill failure handling, and executable machine-validated recovery/deployment/rollback/key-recovery runbooks. The production recovery gate still cannot pass until production retention scheduling/approval, real orchestrator image rollback, managed secret-platform key recovery/rotation, incident drills, second-operator execution, and managed or production-sized restore evidence are proven.
