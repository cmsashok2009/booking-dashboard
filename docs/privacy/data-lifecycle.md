# Backend Data Lifecycle

| Data | Purpose | Default retention | Protection | Deletion owner |
|---|---|---:|---|---|
| Sessions | Authentication | Expiry plus 7 days | Digest-only token, encrypted persistence | Backend operations |
| Reset tokens | Recovery | Used/expired plus 7 days | Digest-only token, encrypted persistence | Backend operations |
| Activation tokens | Invitation | Used/expired plus 30 days | Digest-only token, encrypted persistence | Backend operations |
| Upload details | Import support | 30 days | Encrypted persistence, Admin-only access | Product operations |
| Audit events | Security/business accountability | 365 days | Actor/entity IDs, minimized outcomes | Security owner |
| Campaign recipients | Delivery and activation history | Policy decision required | Encrypted persistence, Admin-only access | Privacy owner |
| User/booking records | Core business operations | Contract/legal policy required | TLS, encrypted persistence/backups, role scoping | Data owner |

Production deployment is blocked until the privacy/data owner approves campaign, user, and booking retention periods and documents data-subject access/deletion procedures. Key rotation must use a controlled decrypt/re-encrypt migration with backup and rollback points.
