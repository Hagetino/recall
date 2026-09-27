#!/usr/bin/env node
// recall.mjs — semantic search + auto-link suggestions over a markdown memory dir,
// using local embeddings (Ollama nomic-embed-text). No generation LLM, no cloud, no cost.
//
//   node scripts/recall.mjs "<query>"            semantic search (top matches)
//   node scripts/recall.mjs --links [--min 0.6]  suggest missing [[links]] between related notes
//   node scripts/recall.mjs "<query>" --top 8 --dir .agents/knowledge
//
// Embeddings are cached in <dir>/.embeddings-cache.json keyed by content hash, so
// re-runs only embed changed files. Both Claude and Codex can call this to "recall"
// shared memory before working.

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, basename, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : def; };
const has = name => args.includes(name);
const dir = flag('--dir', 'memory');
const top = parseInt(flag('--top', '6'), 10);
const minSim = parseFloat(flag('--min', '0.6'));
const linksMode = has('--links');
// query = all positional tokens (skip flags and the values of value-taking flags)
const VALUE_FLAGS = new Set(['--dir', '--top', '--min']);
const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) { if (VALUE_FLAGS.has(a)) i++; continue; }
  positional.push(a);
}
const query = positional.join(' ') || null;
const OLLAMA = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.EMBED_MODEL || 'nomic-embed-text';

function walk(d, acc = []) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) { if (e !== 'node_modules' && !e.startsWith('.')) walk(p, acc); }
    else if (e.endsWith('.md') && !/^(index|memory|readme)\.md$/i.test(e)) acc.push(p);
  }
  return acc;
}
function parse(p) {
  const raw = readFileSync(p, 'utf8');
  const stem = basename(p, '.md');
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  const front = fm ? fm[1] : '';
  const name = (front.match(/^name:\s*(.+)$/m)?.[1] || stem).trim().replace(/^["']|["']$/g, '');
  const body = (fm ? raw.slice(fm[0].length) : raw).replace(/\s+/g, ' ').trim();
  const links = new Set([...raw.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1].trim().toLowerCase()));
  const embedText = `${name}. ${body}`.slice(0, 1600);
  return { id: name, stem, file: relative(dir, p), body, links, embedText, hash: createHash('sha1').update(embedText).digest('hex') };
}
async function embed(text) {
  const r = await fetch(`${OLLAMA}/api/embeddings`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: MODEL, prompt: text }) });
  if (!r.ok) throw new Error(`ollama ${r.status} — is it running? (${OLLAMA})`);
  const j = await r.json();
  if (!j.embedding) throw new Error('no embedding returned (is nomic-embed-text pulled?)');
  return j.embedding;
}
function cos(a, b) { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return d / (Math.sqrt(na) * Math.sqrt(nb) || 1); }

if (!existsSync(dir)) { console.error(`no such dir: ${dir}`); process.exit(1); }
if (!linksMode && !query) { console.error('usage: node scripts/recall.mjs "<query>"   |   --links [--min 0.6]'); process.exit(1); }

const notes = walk(dir).map(parse);
if (!notes.length) { console.error('no notes in', dir); process.exit(1); }

// load + refresh embedding cache
const cachePath = join(dir, '.embeddings-cache.json');
let cache = {};
try { cache = JSON.parse(readFileSync(cachePath, 'utf8')); } catch {}
let embedded = 0;
for (const n of notes) {
  if (cache[n.file]?.hash === n.hash) { n.vec = cache[n.file].vec; }
  else { n.vec = await embed(n.embedText); cache[n.file] = { hash: n.hash, vec: n.vec }; embedded++; }
}
// drop cache entries for deleted files
for (const k of Object.keys(cache)) if (!notes.find(n => n.file === k)) delete cache[k];
writeFileSync(cachePath, JSON.stringify(cache));

if (linksMode) {
  const pairs = [];
  for (let i = 0; i < notes.length; i++) for (let j = i + 1; j < notes.length; j++) {
    const a = notes[i], b = notes[j];
    const already = a.links.has(b.id.toLowerCase()) || a.links.has(b.stem.toLowerCase()) || b.links.has(a.id.toLowerCase()) || b.links.has(a.stem.toLowerCase());
    if (already) continue;
    pairs.push({ a, b, sim: cos(a.vec, b.vec) });
  }
  pairs.sort((x, y) => y.sim - x.sim);
  const hits = pairs.filter(p => p.sim >= minSim);
  console.log(`Link suggestions (sim >= ${minSim}, ${embedded} re-embedded) — not yet [[linked]]:\n`);
  if (!hits.length) console.log('  none above threshold. Try --min 0.5');
  for (const p of hits.slice(0, 15)) console.log(`  ${p.sim.toFixed(3)}  ${p.a.stem}  <->  ${p.b.stem}`);
  console.log(`\nAdd a [[${hits[0]?.b.stem || 'target'}]] link in the higher-level note to connect them.`);
} else {
  const q = await embed(query);
  const ranked = notes.map(n => ({ n, sim: cos(q, n.vec) })).sort((x, y) => y.sim - x.sim).slice(0, top);
  console.log(`recall: "${query}"  (${embedded} re-embedded)\n`);
  for (const { n, sim } of ranked) {
    const snip = n.body.slice(0, 150).replace(/\s+/g, ' ');
    console.log(`  ${sim.toFixed(3)}  ${n.file}\n         ${snip}${n.body.length > 150 ? '…' : ''}\n`);
  }
}
