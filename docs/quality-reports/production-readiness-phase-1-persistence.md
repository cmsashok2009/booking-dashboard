# Quality Report: Production Readiness Phase 1 Persistence

- Date: 2026-08-03
- Reviewer/agent: Codex
- Changed surface: normalized MySQL runtime store, reversible migrations, legacy migration/reconciliation CLI, production initializer and load smoke
- Overall gate: `IN PROGRESS / BLOCKED`

## Applicable IDs Before Implementation

- API: `API-004`, `API-005`, `API-008`, `API-009`, `API-010`, `API-011`, `API-020`, `API-022`, `API-023`, `API-024`, `API-026`, `API-029`, `API-030`
- UI: `N/A` - no rendered frontend surface changed.
- UX: `N/A` - no user-facing workflow changed.

## Control Results

| ID | Status | Severity | Evidence | Notes |
|---|---|---|---|---|
| API-004 | PASS | High | Normalized roles/users schema and backend role tests | Runtime writes role/user entities to dedicated tables. |
| API-005 | PASS | High | Unique normalized email/name/code/value columns and migration reconciliation | Legacy regions and dealer codes are materialized with deterministic IDs. |
| API-008 | PASS | High | Campaign/recipient unique idempotency keys and campaign tests | Existing service idempotency behavior remains green. |
| API-009 | PARTIAL PASS | High | Production initializer/load smoke used normalized tables; `application_state=0` | Whole-document persistence is removed from normal MySQL behavior, but each save still transactionally replaces all normalized rows from an in-memory aggregate. Query-level repositories remain incomplete. |
| API-010 | PARTIAL PASS | High | Unskipped MySQL race test | A global revision prevents overwrite and rejects stale writers. Unrelated writes still conflict instead of using row-level concurrency. |
| API-011 | BLOCKED | High | Code/schema inspection | Booking reads are paginated, but universal query-level pagination/filter/sort is incomplete. |
| API-020 | PASS | High | Dedicated audit table, indexes, entity preservation, backend tests | Deleted historical actors map to nullable relational keys while the original event remains in `entity_json`. |
| API-022 | PARTIAL PASS | High | Digest/encrypted token columns and safe migration errors | Retention and managed-key production evidence remain Phase 8 work. |
| API-023 | PASS | High | Immutable template-version FK and historical-version migration | Missing legacy versions are explicitly marked as reconstructed from the retained current template. |
| API-024 | PASS | High | Workflows persisted and round-tripped through `onboarding_workflows` | Workflow entities no longer depend on `application_state`. |
| API-026 | PASS | High | Host and disposable infrastructure suites | 118 backend tests: 114 pass, 4 host skips; all 4 infrastructure cases pass unskipped against MySQL/Redis. |
| API-029 | PARTIAL PASS | High | Three reversible migration pairs; migration/verify repeated twice; rollback/reapply test passes | Populated rollback with complete application-state restoration still requires backup/restore evidence. |
| API-030 | PASS | High | Production startup and load smoke against MySQL/Redis | 103 requests, 0 failures, p95 71.3 ms; normalized revision advanced to 2. |

## Implemented

- `MySqlStateStore` now uses normalized domain tables as the runtime source of truth; `application_state` is retained only for migration compatibility.
- Migration `003-normalized-runtime` adds per-entity lossless JSON, OAuth state, per-key metadata, and a global optimistic revision without storing a whole-application payload.
- Saves run in one transaction and reject stale revisions; inserts strip SQL text before propagating database errors.
- Legacy CLI modes: guarded `dry-run`, `migrate`, `verify`, and `cleanup`.
- Reconciliation uses deterministic canonical checksums, collection inventories, duplicate detection, and content-free differing-key diagnostics.
- Legacy access master data receives deterministic region/dealer IDs. Historical template-version references are preserved; absent legacy content is explicitly provenance-marked rather than silently invented.
- Rollback maps `invited`, `replaced`, and `disconnected` statuses before narrowing enums.
- Backend image now includes migration files.

## Verification Evidence

- Backend full suite: PASS, 118 total, 114 passed, 4 expected host infrastructure skips, 0 failed.
- Disposable MySQL/Redis infrastructure suite: PASS, 4/4 unskipped: stale writer rejection, representative all-domain round trip, shared Redis budget, and migration rollback/reapply.
- Production runtime smoke: PASS, initializer used production MySQL and Redis settings; 103 requests, 0 failures, p95 71.3 ms; `application_state=0`, normalized user row present, runtime revision advanced from 1 to 2.
- Legacy dry-run: PASS with 69 users, 100 bookings, 100 dealer assignments, 5 derived regions, 100 derived dealer codes, and all onboarding/email/audit/session collections.
- Legacy migration and strict verification: PASS twice on clean MySQL schemas with checksum `6b3ec95f...`; 69 users, 100 bookings, 4 template versions, revision 1, and zero application-state rows.
- Guarded cleanup: PASS after reconciliation; no compatibility document row existed to remove.
- Failure privacy: PASS by observed sanitized `ER_NO_REFERENCED_ROW_2` output containing only the table name and no SQL/row values.
- Browser verification: `N/A` for this backend-only slice.

## Remaining High Blockers

- Runtime saves still replace every normalized table from an in-memory aggregate. This removes the single-record document bottleneck but is not the final query-level repository architecture.
- Global optimistic concurrency prevents overwrites but causes unrelated updates to conflict.
- Universal server-side pagination/filter/sort and database-native service queries are incomplete.
- The migration was repeated on the evolved 69-user/100-booking fixture, not a formally approved production-capacity dataset.
- Schema rollback/reapply passes, but populated rollback plus restoration/reconciliation has not been proven twice end to end.
- Hosted MySQL TLS, managed backup/PITR, failover, and monitoring evidence remain external gates.

## Exit Decision

Phase 1 remains blocked on High findings, but no longer has the former Critical single-row-document blocker. Normal production MySQL behavior now uses normalized tables and strict reconciliation is repeatable. Completion still requires query-level repositories/row-scoped transactions and a populated rollback-and-restore drill at approved production scale.