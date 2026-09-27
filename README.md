# recall

**Local semantic recall + a graph view over a folder of markdown notes** — a shared memory
for coding agents (Claude Code, Codex, anything that reads the repo). It runs entirely on your
machine using local embeddings, so there is no cloud, no API key, and no cost.

Point it at any directory of `.md` notes and you get:

```bash
recall "what did we decide about deployments"   # semantic search — the nearest notes
recall --links                                   # suggest [[links]] between related notes
memory-graph memory ./graph.html                 # interactive graph of the notes + their links
```

## Why

Coding agents forget across sessions, and two agents (say Claude and Codex) can't see each
other's chat. If they both **read and append to the same folder of markdown notes**, that folder
becomes a shared brain. `recall` makes that folder *searchable* (by meaning, not keywords) and
*visual*, so agents — and you — can find what's already known before redoing it.

## How it works

- Each note is embedded with a **local** model (Ollama `nomic-embed-text`).
- Search embeds your query and ranks notes by cosine similarity.
- `--links` compares notes pairwise and suggests connections you haven't made yet.
- The graph parses `[[wiki-links]]` between notes and renders them, colored by type.

Embeddings are cached by content hash in `<dir>/.embeddings-cache.json`, so re-runs only embed
changed notes. No generation model is used — only embeddings, which are fast and reliable even on
a laptop.

## Requirements

- Node 18+
- [Ollama](https://ollama.com) running locally with the embedding model:
  ```bash
  ollama pull nomic-embed-text
  ```

## Install

```bash
git clone <your-repo-url> recall
cd recall
npm link         # optional: makes `recall` and `memory-graph` available globally
npm run demo     # try it on the bundled sample-memory/
```

Or just call the scripts directly: `node lib/recall.mjs "query" --dir <your-notes>`.

## Usage

```bash
# semantic search (default dir is ./memory; override with --dir)
node lib/recall.mjs "how do we handle auth" --dir notes --top 5

# suggest missing links between related notes
node lib/recall.mjs --links --dir notes --min 0.6

# render the graph
node lib/memory-graph.mjs notes ./graph.html
```

Config via env: `OLLAMA_URL` (default `http://localhost:11434`), `EMBED_MODEL`
(default `nomic-embed-text`).

## Privacy

Everything runs locally. Your notes are read from disk, embedded on your machine, and never sent
anywhere. See [SANITIZE.md](SANITIZE.md) before sharing this repo — the tool ships with only code
and a synthetic sample; your real notes live in a `memory/` dir that is git-ignored by default.

## License

MIT — see [LICENSE](LICENSE).
