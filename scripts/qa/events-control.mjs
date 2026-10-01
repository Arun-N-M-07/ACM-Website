// Events navigation is a function of the actual scroll, not a playback clock.
// Run with [base] [outDir] [baseline|all]; baseline records the old failure without asserting it away.
import { mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const [, , base = 'http://localhost:3303', out = '/tmp/acm-events-control', mode = 'all'] = process.argv;
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const errors = [], failures = [], passed = [], observations = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, label, detail) => (ok ? passed : failures).push(ok ? label : `${label}: ${JSON.stringify(detail)}`);
async function boot(w, h, touch = false) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch });
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`${base}/?debug`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.loader[data-state="ready"]', { timeout: 240000 });
  await p.click('[aria-label="Enter silently"]');
  await wait(1000);
  return p;
}
async function snapshot(p) {
  return p.evaluate(() => {
    const a = window.__acm, s = a.events.snapshot(), scene = a.scene;
    const c = a.teams.camera();
    return {
      ...s, camera: c, scroll: scrollY, memory: a.memory(),
      rooms: Array.from({ length: 9 }, (_, i) => {
        const r = scene.getObjectByName(`room-${['code', 'tech-talks', 'masterclass', 'head-start', 'patternx', 'codex', 'prodigy', 'open-source-mentorship-program', 'codher'][i]}`);
        return r && { name: r.name, matrix: r.matrixWorld.toArray(), visible: r.parent.visible };
      }),
      frames: scene.getObjectByName('events-matrix').children.map((g) => g.children[0].visible),
      lights: scene.children.filter((o) => o.isPointLight).map((l) => ({ pos: l.position.toArray(), intensity: l.intensity, distance: l.distance, color: l.color.toArray() })),
      pageTop: document.querySelector('.evx-page')?.getBoundingClientRect().top,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
}
async function jump(p, part, t, i) {
  await p.evaluate(({ part, t, i }) => {
    const a = window.__acm;
    if (i !== undefined) a.events.room(i, 0);
    a.jump(a.events.at(part, t));
  }, { part, t, i });
  await wait(550);
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
async function hold(p, label) {
  // Lenis owns input settling. Test a stopped actual scroll, not a fixed delay
  // after the last wheel event (GPU-heavy runs can still be settling then).
  if (mode !== 'baseline') {
    const deadline = Date.now() + 6000;
    let prior = await snapshot(p);
    let stable = 0;
    while (Date.now() < deadline) {
      await wait(250);
      const next = await snapshot(p);
      stable = prior.scroll === next.scroll && Math.abs(prior.target - next.target) < 1e-7 ? stable + 1 : 0;
      if (stable >= 3) break;
      prior = next;
    }
    if (prior.view.hub > 0) await wait(1600); // pointer-only hub parallax
  }
  const a = await snapshot(p);
  await wait(mode === 'baseline' ? 1400 : 700);
  const b = await snapshot(p);
  observations.push({ label, a, b });
  if (mode !== 'baseline') {
    check(Math.abs(a.target - b.target) < 1e-7 && Math.abs(a.value - a.target) < 1e-7, `${label}: scroll is the navigation source`, { a: a.value, b: b.value, target: a.target });
    check(a.view.enter === b.view.enter && a.view.room === b.view.room && a.view.page === b.view.page && distance(a.camera, b.camera) < 1e-6, `${label}: no autonomous camera/entry/page progression`, { distance: distance(a.camera, b.camera), a: a.view, b: b.view });
  }
  return b;
}
async function suite(w, h, touch) {
  const p = await boot(w, h, touch), name = `${w}x${h}`;
  await p.evaluate(() => window.__acm.jump(window.__acm.events.hubRest));
  await wait(1000);
  await p.screenshot({ path: `${out}/${name}-wide.png` });
  const wide = await snapshot(p);
  await p.evaluate(() => window.__acm.events.visit(0));
  await wait(450);
  if (mode !== 'baseline') {
    const moving = await snapshot(p);
    check(moving.selected === 0 && moving.view.enter > 0, `${name}: explicit selection begins entry`, moving.view);
    await p.mouse.wheel({ deltaY: -70 });
  }
  const selected = await hold(p, `${name}: select`);
  if (mode !== 'baseline') check(selected.selected === 0, `${name}: interrupted selection retains the chosen room`, selected.view);
  if (mode === 'baseline') {
    await wait(500);
    await p.screenshot({ path: `${out}/${name}-old-entry.png` });
    observations.push({ label: `${name}: old frame culling`, state: await snapshot(p) });
    await p.close();
    return;
  }
  for (const i of Array.from({ length: 9 }, (_, i) => i)) {
    for (const t of [0.25, 0.5, 0.98]) {
      await jump(p, 'enter', t, i);
      const s = await hold(p, `${name}: room ${i + 1} entry ${t}`);
      check(s.frames.every(Boolean), `${name}: room ${i + 1} frame retained before physical entry ${t}`, s.frames);
      check(s.rooms.every((r, k) => JSON.stringify(r.matrix) === JSON.stringify(wide.rooms[k].matrix)), `${name}: room ${i + 1} all room transforms remain locked ${t}`);
      if ([0, 6].includes(i) && [0.5, 0.98].includes(t)) await p.screenshot({ path: `${out}/${name}-room-${i + 1}-entry-${t}.png` });
    }
    await jump(p, 'room', 0.55, i);
    const s = await hold(p, `${name}: room ${i + 1} established`);
    check(s.view.enter === 1 && !s.overflow, `${name}: room ${i + 1} established, no overflow`, s.view);
    // Same navigation pose regardless of installation playback age or scroll history.
    await jump(p, 'enter', 0.6);
    const before = await snapshot(p);
    await jump(p, 'room', 0.8);
    await jump(p, 'enter', 0.6);
    const after = await snapshot(p);
    check(distance(before.camera, after.camera) < 1e-6 && before.camera.fov === after.camera.fov, `${name}: room ${i + 1} reverse returns the same pose`, { before: before.camera, after: after.camera });
  }
  // Editorial uses scroll progress without an installation-completion gate.
  // Background/foreground travel differs (tested by events-editorial.mjs).
  await jump(p, 'room', 1, 0);
  const start = await snapshot(p);
  await p.evaluate(() => { const a = window.__acm; a.jump(a.events.track.unfold.start + 0.5 * a.events.record.screen / a.events.span); });
  await wait(600);
  const half = await hold(p, `${name}: half editorial`);
  const readingScreen = await p.evaluate(() => window.__acm.events.record.screen);
  check(Math.abs(half.view.unfold - 0.5) < 0.015 && Math.abs(half.pageTop - (h - readingScreen * 0.5)) < 3, `${name}: foreground sheet follows half its chrome-safe reading viewport`, half.view);
  await jump(p, 'room', 1);
  const reverse = await snapshot(p);
  check(reverse.view.page === 0 && distance(start.camera, reverse.camera) < 1e-6, `${name}: editorial reverses into the same room`, reverse.view);
  await p.evaluate(() => window.__acm.events.back());
  await wait(3000);
  check(!(await snapshot(p)).visiting, `${name}: explicit Back returns to the matrix`);
  // Real wheel input is not multiplied by a second camera-follow clock.
  // Settle the setup jump before selecting. A reverse jump from a prior room
  // intentionally clears the old visit at the hub seam on the next frame.
  // Selecting before that frame would test an invalid fixture, not input gain.
  await p.evaluate(() => window.__acm.jump(window.__acm.events.hubRest));
  await wait(700);
  await p.evaluate(() => window.__acm.events.room(6));
  await wait(250);
  check((await snapshot(p)).selected === 6, `${name}: wheel fixture has a selected room before input`);
  await p.mouse.move(20, 30);
  const traces = [];
  for (const [label, delta, gap] of [['slow', 30, 80], ['fast', 400, 20], ['reverse', -220, 30]]) {
    const before = await snapshot(p);
    for (let n = 0; n < 8; n++) {
      await p.mouse.wheel({ deltaY: delta }); await wait(gap);
      traces.push({ label, ...(await snapshot(p)) });
    }
    await hold(p, `${name}: ${label} wheel settles`);
    const after = await snapshot(p);
    check(Math.abs(after.scroll - before.scroll - delta * 8) < 3, `${name}: ${label} wheel input keeps pixel-for-pixel gain`, { pixels: after.scroll - before.scroll, input: delta * 8 });
    await hold(p, `${name}: ${label} native scroll stop`);
  }
  writeFileSync(`${out}/${name}-native.json`, JSON.stringify(traces, null, 2));
  // Internal performance remains at 1/4 per second whether the visitor scrolls slowly or quickly.
  const rates = [];
  for (const delta of [10, 350]) {
    await p.evaluate(() => { const a = window.__acm; a.jump(a.events.hubRest); a.events.room(6); a.jump(a.events.at('room', 0.15)); });
    await wait(100);
    const a = await p.evaluate(() => ({ t: performance.now(), play: window.__acm.events.snapshot().view.play }));
    for (let k = 0; k < 8; k++) { await p.mouse.wheel({ deltaY: delta }); await wait(40); }
    const b = await p.evaluate(() => ({ t: performance.now(), play: window.__acm.events.snapshot().view.play }));
    rates.push((b.play - a.play) / ((b.t - a.t) / 1000));
  }
  check(rates.every((r) => Math.abs(r - 0.25) < 0.035), `${name}: slow/fast scrolling leaves installation playback at its fixed rate`, rates);
  if (touch) {
    await jump(p, 'enter', 0.5, 6);
    const cdp = await p.createCDPSession();
    for (const dy of [180, -180]) {
      let y = h * (dy > 0 ? 0.65 : 0.35);
      const before = await snapshot(p);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: w / 2, y, id: 1 }] });
      for (let n = 0; n < 12; n++) { y -= dy / 12; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: w / 2, y, id: 1 }] }); await wait(20); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await wait(900);
      const after = await hold(p, `${name}: touch ${dy > 0 ? 'forward' : 'reverse'} stop`);
      check(dy > 0 ? after.view.enter > before.view.enter : after.view.enter < before.view.enter, `${name}: actual touch swipe scrubs and reverses entry`, { before: before.view.enter, after: after.view.enter });
    }
    await cdp.detach();
  }
  // Resize/rotation while halfway into a bay, then scrub/reverse again.
  await jump(p, 'enter', 0.5, 6);
  for (const [rw, rh] of [[h, w], [w, h], [w, Math.round(h * 0.85)], [w, h]]) {
    const prior = await snapshot(p);
    await p.setViewport({ width: rw, height: rh, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch });
    await wait(900);
    const s = await snapshot(p);
    check(Math.abs(prior.target - s.target) < 2e-5 && !s.overflow, `${name}: resize ${rw}x${rh} preserves navigation`, { before: prior.target, after: s.target });
    check(s.rooms.every((r, k) => JSON.stringify(r.matrix) === JSON.stringify(wide.rooms[k].matrix)), `${name}: resize ${rw}x${rh} leaves physical room/shelf transforms fixed`);
  }
  await p.screenshot({ path: `${out}/${name}-final.png` });
  await p.close();
}
try {
  await suite(1440, 900, false);
  await suite(390, 844, true);
} catch (e) { failures.push(e.stack ?? String(e)); }
finally { await browser.close(); }
writeFileSync(`${out}/results.json`, JSON.stringify({ passed, failures, errors, observations }, null, 2));
console.log(`${passed.length} passed; ${failures.length} failed; ${errors.length} browser errors`);
for (const f of failures) console.log('FAIL', f);
for (const e of errors) console.log('ERROR', e);
if (mode === 'baseline') for (const o of observations) console.log(o.label, JSON.stringify({ a: o.a?.view, b: o.b?.view, distance: o.a ? distance(o.a.camera, o.b.camera) : undefined, state: o.state?.view, frames: o.state?.frames }));
process.exitCode = failures.length || errors.length ? 1 : 0;
