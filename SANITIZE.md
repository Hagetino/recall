# SANITIZE — before you share this repo

`recall` is built so your real notes never live in the repo. It operates on a directory you
point it at; the default working dir (`memory/`) and all caches/outputs are git-ignored.

## What ships (safe)

- `lib/recall.mjs`, `lib/memory-graph.mjs` — generic tool code, no personal data
- `sample-memory/` — **synthetic** example notes (a fictional project), for the demo
- `README.md`, `SANITIZE.md`, `LICENSE`, `package.json`, `.gitignore`

## What must NEVER be committed

- Your real notes (keep them in `memory/` or an external dir — `memory/` is git-ignored)
- `.embeddings-cache.json` (contains vectors derived from your notes — git-ignored)
- Generated `*-graph.html` (embeds your note text — git-ignored)
- Any real emails, paths, client names, secrets

## 30-second check before `git push`

```bash
git status                                   # nothing personal staged
grep -rInE '(@[a-z0-9.-]+\.[a-z]{2,}|/Users/[a-z]+/|sk-[A-Za-z0-9]{8}|AKIA[0-9A-Z]{16})' \
  --exclude-dir=.git --exclude-dir=node_modules . || echo "clean"
find . -path ./.git -prune -o \( -name '.embeddings-cache.json' -o -name '*-graph.html' \) -print
```

If `grep` flags something in `sample-memory/`, replace it with a placeholder — that folder must
stay fictional.
