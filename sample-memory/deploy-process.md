---
name: deploy-process
type: reference
---

# Deployment process (sample)

Fictional sample data. Deployments for Acme Widgets run: open a PR, CI runs tests, merge to main,
auto-deploy to staging, run smoke tests, then promote to production behind a feature flag.

Rollbacks are a one-command revert of the last release tag. Never deploy on a Friday afternoon.
