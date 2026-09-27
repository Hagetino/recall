---
name: decisions
type: decision
---

# Decisions — shared log (sample)

> Fictional sample data for the demo. Both agents read this at session start and append dated
> decisions here.

## 2026-01-10
- Chose Postgres over MongoDB for the widget catalog — relational queries dominate. See
  [[api-conventions]].
- Deploys go through the staging gate first; no direct-to-prod. See [[deploy-process]].
- Adopted trunk-based development with short-lived feature branches.
