// Loop / resource QA: runs whole journeys through the real loop (opening beats, the Events' rooms, the
// portal and the Teams world to the end of the return, where JourneyLoop wraps to the start) and,
// at the same resting point after each loop, reports the renderer's GPU resources (geometries,
// textures, programs), JS heap, DOM size, window/document listeners and audio nodes created —
// they must stay flat. With --trace, every geometry / texture / render target the renderer takes
// on is tracked (dropped when disposed) and what grew between loop 2 and the last is listed with
// the mesh that owns it (or, for a render target, the call that made it).
//
//   node scripts/qa/loop-memory.mjs <url> [loops=5] [sound|quiet] [--trace]
// Env: W, H, MOBILE=1 (touch/mobile emulation, e.g. W=390 H=844 DPR=3), DPR.
import puppeteer from 'puppeteer-core';
const args = process.argv.slice(2);
const TRACE = args.includes('--trace');
const [url = 'http://localhost:3100', loopsArg = '5', sound = 'quiet'] = args.filter((a) => a !== '--trace');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
const MOBILE = !!process.env.MOBILE;
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc', '--autoplay-policy=no-user-gesture-required', `--window-size=${Math.max(W, 900)},${Math.max(H, 900)}`], defaultViewport: { width: W, height: H, deviceScaleFactor: Number(process.env.DPR ?? 1), isMobile: MOBILE, hasTouch: MOBILE } });
const page = await b.newPage();
const logs = [];
page.on('console', (m) => ['error', 'warn'].includes(m.type()) && logs.push(`[${m.type()}] ${m.text().slice(0, 200)}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
// Count audio nodes created (a proxy for growing audio graphs).
await page.evaluateOnNewDocument(() => {
  window.__nodes = 0;
  for (const k of ['createBufferSource', 'createOscillator', 'createGain', 'createBiquadFilter', 'createStereoPanner']) {
    const o = AudioContext.prototype[k];
    AudioContext.prototype[k] = function (...a) { window.__nodes++; return o.apply(this, a); };
  }
  const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
  window.__listeners = 0;
  EventTarget.prototype.addEventListener = function (...a) { if (this === window || this === document) window.__listeners++; return add.apply(this, a); };
  EventTarget.prototype.removeEventListener = function (...a) { if (this === window || this === document) window.__listeners--; return rem.apply(this, a); };
});
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('.loader[data-state="ready"]', { timeout: 180000 });
await sleep(600);
await page.click(sound === 'sound' ? '.loader-enter .threshold-enter' : '.loader-enter button[aria-label="Enter silently"]');
await sleep(1500);
const ev = (f, ...a) => page.evaluate(f, ...a);
const at = async (beat, ms = 1400) => { await ev((t) => window.__acm.intro.at(t), beat); await sleep(ms); };
const snap = async (label) => {
  await ev(() => window.gc && window.gc());
  const s = await ev(() => ({ mem: window.__acm.memory?.(), heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, dom: document.getElementsByTagName('*').length, nodes: window.__nodes, listeners: window.__listeners, t: window.__acm.intro.snapshot(), teams: window.__acm.teams.snapshot().state, chapter: window.__acm.store.getState().chapter, room: window.__acm.store.getState().activeRoom }));
  console.log(label.padEnd(10), JSON.stringify(s.mem), 'heap', s.heapMB, 'dom', s.dom, 'audioNodes', s.nodes, 'winListeners', s.listeners, 'beat', s.t.t, 'p', s.t.p, 'teams', s.teams, 'chapter', s.chapter, 'room', s.room);
};
await at(0);
if (TRACE) await ev(() => {
  let p = Object.getPrototypeOf(window.__acm.scene);
  while (p && !Object.prototype.hasOwnProperty.call(p, 'dispatchEvent')) p = Object.getPrototypeOf(p);
  const add = p.addEventListener;
  const live = (window.__live = new Map());
  let id = 0;
  p.addEventListener = function (type, fn) {
    if (type === 'dispose' && (this.isBufferGeometry || this.isTexture) && !this.__tracked) {
      this.__tracked = ++id;
      const d = this.isBufferGeometry
        ? `G ${this.type} ${this.name || ''} v${this.attributes?.position?.count ?? '?'} attrs:${Object.keys(this.attributes || {}).join('+')}`
        : `T ${this.type || this.constructor.name} ${this.name || ''} ${this.image ? (this.image.width || this.image.videoWidth || '?') + 'x' + (this.image.height || '?') : 'noimg'} rt:${!!this.isRenderTargetTexture}`;
      let owner = '';
      const self = this;
      window.__acm.scene.traverse((o) => {
        if (owner) return;
        const hit = self.isBufferGeometry ? o.geometry === self : o.material && [].concat(o.material).some((m) => Object.values(m).includes(self) || Object.values(m.uniforms || {}).some((u) => u && u.value === self));
        if (hit) { const path = []; let q = o; while (q && path.length < 7) { path.push((q.name || q.type) + (q.userData && Object.keys(q.userData).length ? '{' + Object.keys(q.userData).join(',') + '}' : '')); q = q.parent; } owner = path.join(' < ') + ' mat:' + [].concat(o.material || []).map((m) => m.type + (m.name ? ':' + m.name : '')).join(','); }
      });
      live.set(this, { id, d, stack: owner || '(no owner in scene)' });
      add.call(this, 'dispose', () => live.delete(this));
    }
    return add.call(this, type, fn);
  };
});
await snap('start');
const loops = +loopsArg;
for (let i = 1; i <= loops; i++) {
  for (const beat of [-30, -11, 20, 45, 100, 128, 147, 165, 185]) await at(beat, 1100);
  for (const r of [0, 4, 8]) { await ev((r) => window.__acm.jump(window.__acm.roomProgress(r, 0.5)), r); await sleep(1400); }
  await ev(() => window.__acm.jump(window.__acm.segments.portal.start + (window.__acm.segments.portal.end - window.__acm.segments.portal.start) * 0.9)); await sleep(1500);
  await ev(() => window.__acm.teams.enter()); await sleep(6000);
  for (const c of [0.5, 2.5, 5]) { await ev((c) => window.__acm.teams.at(c), c); await sleep(1200); }
  await ev(() => window.__acm.jump(1)); await sleep(3500);
  const st = await ev(() => ({ p: window.__acm.progress.value, inside: window.__acm.teams.snapshot().inside, state: window.__acm.teams.snapshot().state }));
  // (Past the end's seam the scroll carries on past the start's by as much: it lands in the opening's first beats.)
  if (st.p > 0.05 || st.inside) console.log('  loop did not wrap:', JSON.stringify(st));
  await at(0, 1500);
  await snap(`loop ${i}`);
  if (!TRACE) continue;
  const dump = await ev(() => [...window.__live.values()].map((v) => v.id + ' ' + v.d));
  console.log('  live tracked:', dump.length);
  if (i === 2 || i === loops) (globalThis.__dumps ??= {})[i] = dump;
}
if (TRACE && loops >= 3) {
const counts = (arr) => arr.reduce((m, x) => ((m[x.replace(/^\d+ /, '')] = (m[x.replace(/^\d+ /, '')] || 0) + 1), m), {});
const c2 = counts(globalThis.__dumps[2]), cN = counts(globalThis.__dumps[loops]);
console.log('GREW between loop 2 and loop', loops, ':');
for (const k of Object.keys(cN)) if ((cN[k] || 0) > (c2[k] || 0)) console.log('  +' + (cN[k] - (c2[k] || 0)), k);
const stacks = await ev(() => [...window.__live.values()].slice(-16).map((v) => v.id + ' ' + v.d + '\n      ' + v.stack));
console.log(stacks.join('\n'));
}
console.log(logs.length ? logs.slice(0, 15).join('\n') : 'console: no errors/warnings');
await b.close();

