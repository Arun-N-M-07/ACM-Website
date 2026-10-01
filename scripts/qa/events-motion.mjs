// Real wheel input and explicit Back timing, without changing application clocks.
import { mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const [, , base = 'http://localhost:3303', out = '/tmp/acm-events-motion', mode = 'all'] = process.argv;
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [], failures = [], observations = [], passed = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, label, data) => (ok ? passed : failures).push(ok ? label : { label, data });
const p = await browser.newPage();
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await p.goto(`${base}/?debug`, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('.loader[data-state="ready"]', { timeout: 240000 });
await p.click('[aria-label="Enter silently"]');
await wait(1000);
const snap = () => p.evaluate(() => ({ ...window.__acm.events.snapshot(), y: scrollY, camera: window.__acm.teams.camera(), top: document.querySelector('.evx-page')?.getBoundingClientRect().top }));
async function fixture(part, t, i = 6) {
  await p.evaluate(() => window.__acm.jump(window.__acm.events.hubRest));
  await wait(250);
  await p.evaluate(({ part, t, i }) => { const a = window.__acm; a.events.room(i, 0); a.jump(a.events.at(part, t)); }, { part, t, i });
  await wait(450);
}
try {
  for (const delta of [24, 240, -240]) {
    await fixture('unfold', 0.6);
    const before = await snap();
    await p.mouse.wheel({ deltaY: delta });
    await wait(100);
    const early = await snap();
    await wait(200);
    const stopped = await snap();
    await wait(800);
    const late = await snap();
    observations.push({ type: 'wheel', delta, before, early, stopped, late });
    if (mode !== 'baseline') {
      check(Math.abs((early.y - before.y) - delta) <= 2, `wheel ${delta}: response within 100ms is pixel-for-pixel`, { early: early.y - before.y });
      check(Math.abs(late.y - stopped.y) <= 1, `wheel ${delta}: no artificial settling tail`, { tail: late.y - stopped.y });
      check(Math.abs((late.top - before.top) + delta) <= 2, `wheel ${delta}: sheet follows input velocity without extra easing`, { shift: late.top - before.top });
    }
  }
  for (const part of ['room', 'read']) {
    for (const t of (part === 'read' ? [0.1, 0.5] : [1])) {
      await fixture(part, t);
      await p.evaluate(() => {
        window.motionTrace = [];
        const start = performance.now();
        const sample = () => {
          const a = window.__acm;
          window.motionTrace.push({ ms: performance.now() - start, p: a.events.snapshot().target, camera: a.teams.camera() });
          if (performance.now() - start < 14000) window.motionRaf = requestAnimationFrame(sample);
        };
        sample();
        window.__acm.events.back();
      });
      await p.waitForFunction(() => !window.__acm.events.snapshot().visiting, { timeout: 18000 });
      const result = await p.evaluate(() => {
        cancelAnimationFrame(window.motionRaf);
        const a = window.__acm, K = a.events.track;
        return { trace: window.motionTrace, K, final: a.events.snapshot() };
      });
      const entry = result.trace.filter((s) => s.p > result.K.enter.start && s.p < result.K.enter.end);
      const travelMs = entry.length ? entry.at(-1).ms - entry[0].ms : 0;
      observations.push({ type: 'back', part, t, travelMs, ...result });
      if (mode !== 'baseline') check(travelMs > 1300, `Back from ${part} ${t}: room-to-wall travel is not compressed`, { travelMs });
    }
  }
  if (mode !== 'baseline') {
    const times = observations.filter((o) => o.type === 'back').map((o) => o.travelMs);
    check(Math.max(...times) - Math.min(...times) < 180, 'room-to-wall pace is independent of editorial starting depth', times);
    // Explicit actions may animate, but input owns the path again on the first wheel event.
    for (const action of ['visit', 'back']) {
      if (action === 'visit') {
        await p.evaluate(() => window.__acm.jump(window.__acm.events.hubRest));
        await wait(250);
        await p.evaluate(() => window.__acm.events.visit(1));
      } else {
        await fixture('read', 0.1);
        await p.evaluate(() => window.__acm.events.back());
      }
      await wait(500);
      await p.mouse.wheel({ deltaY: action === 'visit' ? -45 : 45 });
      // The 3D approach deliberately retains normal Lenis input settling;
      // only the editorial is immediate. Wait for that input, not the canceled flight.
      let settled = 0, last = await snap();
      for (let n = 0; n < 24 && settled < 3; n++) {
        await wait(250);
        const next = await snap();
        settled = next.y === last.y && Math.abs(next.target - last.target) < 1e-7 ? settled + 1 : 0;
        last = next;
      }
      check(settled === 3, `${action}: interrupted input settles normally`);
      const a = await snap();
      await wait(900);
      const b = await snap();
      check(a.y === b.y && Math.abs(a.target - b.target) < 1e-7, `${action}: user input interrupts navigation without restarting it`, { a, b });
      check(a.selected === b.selected && a.visiting === b.visiting, `${action}: canceled completion cannot navigate to another state`, { a: a.selected, b: b.selected });
      if (action === 'visit') check(b.view.enter < 0.9, 'interrupted Visit never autonomously reaches the room', b.view);
    }
    await fixture('unfold', 0.6);
    for (const [label, deltas, gap] of [['slow', [12, 12, 12, 12], 100], ['fast', [120, 120, 120, 120], 20], ['reverse', [-120, -120, 120, -120], 20]]) {
      const a = await snap();
      for (const deltaY of deltas) { await p.mouse.wheel({ deltaY }); await wait(gap); }
      await wait(150);
      const b = await snap();
      const input = deltas.reduce((s, d) => s + d, 0);
      check(Math.abs(b.y - a.y - input) <= 2 && Math.abs(b.top - a.top + input) <= 2, `${label}: input velocity and direction transfer directly to editorial motion`, { input, scroll: b.y - a.y, sheet: b.top - a.top });
    }
  }
  await fixture('unfold', 0.45, 0);
  await p.screenshot({ path: `${out}/layered-events.png` });
} finally {
  await browser.close();
  writeFileSync(`${out}/results.json`, JSON.stringify({ passed, failures, errors, observations }, null, 2));
  console.log(JSON.stringify({ passed: passed.length, failures, errors, observations: observations.map((o) => o.type === 'back' ? { type: o.type, part: o.part, t: o.t, travelMs: o.travelMs } : { type: o.type, delta: o.delta, early: o.early.y - o.before.y, tail: o.late.y - o.stopped.y }) }, null, 2));
  if (failures.length || errors.length) process.exitCode = 1;
}
