# Backend Security, Privacy, and Reliability Hardening

- Review date: 2026-08-01
- Changed surface: backend authentication, booking authorization, persistence, error handling, retention, audit data
- Overall repository gate: PASS
- Production release gate: BLOCKED on external infrastructure evidence

## Summary

Booking reads and updates now derive identity from the authenticated session and ignore spoofed `userId`/`updatedBy` values. Production demo credentials are disabled, cookies are Secure, request bodies are bounded, sensitive endpoints are throttled, and unexpected errors are sanitized with correlation IDs. Production file persistence requires authenticated encryption, rejects plaintext/tampering, serializes writes, preserves a recoverable backup during replacement, and applies retention policies.

## Validation

| ID | Status | Severity | Validation method | Evidence | Notes/owner |
|---|---|---:|---|---|---|
| API-001 | PASS | Critical | HTTP spoofing test | `server-security.test.js` | Session identity controls booking access |
| API-002 | PASS | Critical | Role/resource negative tests | `server-security.test.js`, `access.test.js` | Area/RM ownership enforced |
| API-003 | PASS | High | Bounded body parser review | `MAX_REQUEST_BYTES` in `server.js` | Explicit schemas remain a follow-up for all routes |
| API-006 | PASS | High | Error-path review | correlation ID and safe 500 contract | Provider details removed |
| API-009 | BLOCKED | Critical | Architecture review | JSON store has no multi-record DB transaction | Backend/platform owner: production SQL repository |
| API-010 | BLOCKED | High | Architecture review | local writes serialized only | Backend owner: optimistic DB concurrency |
| API-012 | PASS | High | Code review | login/reset throttles | Distributed limiter required before multi-instance deployment |
| API-014 | PASS | Critical | Password and HTTP tests | 48 backend tests | Demo fallback production-disabled; change-password fallback removed |
| API-015 | PASS | Critical | Encryption and log review | `storage-crypto.test.js` | Key must come from managed secret storage |
| API-020 | PASS | High | Audit review | actor IDs derive from session; PII outcomes removed | Retention defaults to 365 days |
| API-021 | BLOCKED | High | Operations review | correlation IDs exist; no deployed telemetry | Platform owner |
| API-022 | PASS | High | Encryption/retention tests and review | AES-256-GCM, retention policy | Production data classification approval remains external |
| API-026 | PASS | High | Automated tests | 48/48 backend tests passed | Includes HTTP authorization and encryption tests |
| API-028 | BLOCKED | High | Architecture review | persistence remains embedded in server | Backend owner: production repository adapter |
| API-029 | PASS | Medium | Contract review | legacy client identity fields are ignored, not rejected | Frontend remains compatible |
| API-030 | BLOCKED | High | Operations review | health exists; dependency readiness is incomplete | Add with production DB/queue |

## Automated Evidence

- `node --check server.js`: PASS
- `npm test` in backend: PASS, 48 tests
- Focused HTTP authorization tests: PASS
- Encrypted storage round-trip/plaintext/tamper tests: PASS
- Existing frontend source contract remains backward compatible; frontend test execution was attempted but the process produced no output and was terminated, so it is not claimed as evidence.

## Current Ratings

| Area | Before | Repository-local now | Production claim |
|---|---:|---:|---:|
| Security | 3.0 | 8.4 | 7.5 |
| Privacy | 4.5 | 8.2 | 7.2 |
| Reliability | 4.5 | 7.0 | 5.8 |

The remaining gap is not cosmetic code work: a transactional production database, distributed coordination/rate limiting, managed encryption keys, backups, monitoring, load/failover testing, and recovery drills are required for 10/10.
