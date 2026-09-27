#!/usr/bin/env node
// memory-graph.mjs — render a markdown memory/knowledge dir as a self-contained,
// interactive graph HTML. No model, no database, no external deps, works offline.
// Handles BOTH Claude memory files (frontmatter + [[links]]) and the repo knowledge
// base (subdir-typed research/critic reports).
//
//   node scripts/memory-graph.mjs <dir> <out.html>

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, basename, relative, sep } from 'node:path';

const root = process.argv[2];
const out = process.argv[3] || 'memory-graph.html';
if (!root) { console.error('usage: node scripts/memory-graph.mjs <dir> <out.html>'); process.exit(1); }

// recursively collect .md files (skip index/readme files — they are maps, not nodes)
function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== 'node_modules' && !e.startsWith('.')) walk(p, acc); }
    else if (e.endsWith('.md') && !/^(index|memory|readme)\.md$/i.test(e)) acc.push(p);
  }
  return acc;
}

const files = walk(root);
const nodes = [];
const edgesRaw = [];
const byKey = new Map(); // name + filename-stem variants -> node id

function addKey(k, id) { if (k) byKey.set(k.toLowerCase(), id); }

for (const p of files) {
  const raw = readFileSync(p, 'utf8');
  const stem = basename(p, '.md');
  const rel = relative(root, p);
  const sub = rel.includes(sep) ? rel.split(sep)[0] : '';   // subdir = type hint (critic/research)
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  const front = fm ? fm[1] : '';
  const name = (front.match(/^name:\s*(.+)$/m)?.[1] || stem).trim().replace(/^["']|["']$/g, '');
  let desc = (front.match(/^description:\s*(.+)$/m)?.[1] || '').trim().replace(/^["']|["']$/g, '');
  if (!desc) { // first meaningful line: skip headings, blockquotes, blank, frontmatter
    const body = fm ? raw.slice(fm[0].length) : raw;
    desc = (body.split('\n').find(l => l.trim() && !/^[#>\-|]/.test(l.trim())) || '').trim().slice(0, 160);
  }
  // type: filename special-case > frontmatter type (not "memory") > subdir > "knowledge"
  const fmType = (front.match(/^\s*type:\s*(\w+)/m)?.[1] || '').trim();
  let type = stem === 'decisions' ? 'decision'
    : (fmType && fmType !== 'memory') ? fmType
    : sub ? sub
    : 'knowledge';
  const id = name;
  nodes.push({ id, file: rel, type, desc });
  addKey(name, id); addKey(stem, id); addKey(stem.replace(/_/g, '-'), id); addKey(stem.replace(/-/g, '_'), id);
}

for (const p of files) {
  const raw = readFileSync(p, 'utf8');
  const src = nodes.find(n => n.file === relative(root, p)).id;
  for (const m of raw.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const tgt = byKey.get(m[1].trim().toLowerCase());
    if (tgt && tgt !== src) edgesRaw.push({ source: src, target: tgt });
  }
}
const seen = new Set(), edges = [];
for (const e of edgesRaw) { const k = [e.source, e.target].sort().join('|'); if (!seen.has(k)) { seen.add(k); edges.push(e); } }

const data = JSON.stringify({ nodes, edges });
const stats = `${nodes.length} nodes · ${edges.length} links · ${new Set(nodes.map(n => n.type)).size} types`;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Memory Graph</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#0d1117;color:#e6edf3;font:14px/1.5 -apple-system,system-ui,sans-serif;overflow:hidden}
  #hud{position:fixed;top:12px;left:14px;z-index:10}#hud h1{font-size:15px;margin:0 0 2px;font-weight:600}#hud .s{font-size:12px;color:#8b949e}
  #legend{position:fixed;top:12px;right:14px;z-index:10;font-size:12px;text-align:right;max-width:40vw}
  #legend span{display:inline-flex;align-items:center;gap:5px;margin-left:12px}#legend i{width:10px;height:10px;border-radius:50%;display:inline-block}
  #tip{position:fixed;max-width:360px;background:#161b22;border:1px solid #30363d;border-radius:8px;padding:10px 12px;font-size:12.5px;pointer-events:none;opacity:0;transition:opacity .12s;z-index:20;box-shadow:0 8px 24px rgba(0,0,0,.5)}#tip b{color:#fff}
  svg{width:100vw;height:100vh;display:block}line{stroke:#30363d;stroke-width:1.2}circle{cursor:pointer;stroke:#0d1117;stroke-width:2}text{fill:#c9d1d9;font-size:11px;pointer-events:none}
</style></head><body>
<div id="hud"><h1>Shared memory graph</h1><div class="s">${stats}</div></div>
<div id="legend"></div><div id="tip"></div>
<svg><g id="edges"></g><g id="nodes"></g></svg>
<script>
const DATA=${data};
const COLORS={decision:'#f2cc60',feedback:'#58a6ff',user:'#f0883e',reference:'#3fb950',project:'#db61a2',critic:'#f85149',research:'#a371f7',knowledge:'#8b949e',other:'#6e7681'};
const W=innerWidth,H=innerHeight;
const N=DATA.nodes.map(n=>({...n,x:W/2+(Math.random()-.5)*500,y:H/2+(Math.random()-.5)*500,vx:0,vy:0}));
const id2n=new Map(N.map(n=>[n.id,n]));
const E=DATA.edges.map(e=>({s:id2n.get(e.source),t:id2n.get(e.target)})).filter(e=>e.s&&e.t);
const deg={};E.forEach(e=>{deg[e.s.id]=(deg[e.s.id]||0)+1;deg[e.t.id]=(deg[e.t.id]||0)+1});
const svgN=document.getElementById('nodes'),svgE=document.getElementById('edges'),tip=document.getElementById('tip'),leg=document.getElementById('legend');
[...new Set(N.map(n=>n.type))].sort().forEach(t=>{const s=document.createElement('span');s.innerHTML='<i style="background:'+(COLORS[t]||COLORS.other)+'"></i>'+t;leg.appendChild(s)});
const lineEls=E.map(()=>{const l=document.createElementNS('http://www.w3.org/2000/svg','line');svgE.appendChild(l);return l});
const g=N.map(n=>{
  const grp=document.createElementNS('http://www.w3.org/2000/svg','g');
  const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
  const r=6+Math.min(12,(deg[n.id]||0)*2.5);
  c.setAttribute('r',r);c.setAttribute('fill',COLORS[n.type]||COLORS.other);
  const t=document.createElementNS('http://www.w3.org/2000/svg','text');t.setAttribute('x',r+4);t.setAttribute('y',4);t.textContent=n.id;
  grp.appendChild(c);grp.appendChild(t);svgN.appendChild(grp);
  c.addEventListener('mousemove',ev=>{tip.style.opacity=1;tip.style.left=Math.min(ev.clientX+14,innerWidth-360)+'px';tip.style.top=(ev.clientY+14)+'px';tip.innerHTML='<b>'+n.id+'</b> <span style="color:'+(COLORS[n.type]||COLORS.other)+'">'+n.type+'</span><br>'+n.desc+'<br><span style="color:#8b949e">'+n.file+'</span>'});
  c.addEventListener('mouseleave',()=>tip.style.opacity=0);
  let drag=false;c.addEventListener('mousedown',()=>{drag=true});addEventListener('mouseup',()=>drag=false);
  addEventListener('mousemove',ev=>{if(drag){n.x=ev.clientX;n.y=ev.clientY;n.vx=n.vy=0}});
  return grp;
});
function tick(){
  for(let i=0;i<N.length;i++)for(let j=i+1;j<N.length;j++){const a=N[i],b=N[j];let dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy)||1,f=2600/(d*d);a.vx+=dx/d*f;a.vy+=dy/d*f;b.vx-=dx/d*f;b.vy-=dy/d*f;}
  E.forEach(e=>{let dx=e.t.x-e.s.x,dy=e.t.y-e.s.y,d=Math.hypot(dx,dy)||1,f=(d-110)*0.02;e.s.vx+=dx/d*f;e.s.vy+=dy/d*f;e.t.vx-=dx/d*f;e.t.vy-=dy/d*f;});
  N.forEach(n=>{n.vx+=(W/2-n.x)*0.0012;n.vy+=(H/2-n.y)*0.0012;n.x+=n.vx*=.85;n.y+=n.vy*=.85});
  lineEls.forEach((l,i)=>{l.setAttribute('x1',E[i].s.x);l.setAttribute('y1',E[i].s.y);l.setAttribute('x2',E[i].t.x);l.setAttribute('y2',E[i].t.y)});
  g.forEach((grp,i)=>grp.setAttribute('transform','translate('+N[i].x+','+N[i].y+')'));
  requestAnimationFrame(tick);
}
tick();
</script></body></html>`;

writeFileSync(out, html);
console.log(`wrote ${out}`);
console.log(`  ${nodes.length} nodes, ${edges.length} links`);
console.log('  types:', [...new Set(nodes.map(n => n.type))].join(', '));
const iso = nodes.filter(n => !edges.some(e => e.source === n.id || e.target === n.id));
console.log(`  isolated (${iso.length}):`, iso.map(n => n.id).join(', ') || 'none');
