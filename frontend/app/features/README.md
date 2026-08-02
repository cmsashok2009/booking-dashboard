# Feature Ownership

Feature folders own domain-specific composition and behavior. They may import shared UI primitives and utilities, but must not import another feature's private modules.

Public feature entry points:

- dashboard: application navigation and overview composition
- bookings: booking lists, details, import, and role-specific updates
- users: user administration and onboarding
- reconciliation: fulfillment analysis and exceptions
- email: templates, provider configuration, and delivery history

Shared components belong in app/components/ui only when they are domain-neutral and documented in the UI Kit.
