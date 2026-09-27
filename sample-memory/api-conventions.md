---
name: api-conventions
type: feedback
---

# API conventions (sample)

Fictional sample data. REST endpoints are versioned under `/v1`. Responses are JSON with a
`data`/`error` envelope. Every write endpoint is idempotent via an `Idempotency-Key` header.

Database migrations ship with the deploy that needs them — see [[deploy-process]].
