// Actual pointer/key entry, including moving targets, repeated clicks and a held press.
import { mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const [, , base = 'http://localhost:3303', out = '/tmp/acm-event-selection', mode = 'all'] = process.argv;
mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const passed = [], failures = [], errors = [], cases = [];
const check = (ok, label, detail) => (ok ? passed : failures).push(ok ? label : { label, detail });
const snap = (p) => p.evaluate(() => ({ ...window.__acm.events.snapshot(), y: scrollY, camera: window.__acm.teams.camera() }));
async function run(w, h, touch) {
  const p = await browser.newPage(), device = `${w}x${h}`;
  await p.setViewport({ width: w, height: h, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`${base}/?debug`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.loader[data-state="ready"]', { timeout: 240000 });
  await p.click('[aria-label="Enter silently"]'); await wait(600);
  const reset = async (part = 'hub', t = 0.3) => {
    await p.evaluate(({ part, t }) => {
      const a = window.__acm;
      a.jump(a.events.at(part, t));
    }, { part, t });
    await wait(600);
  };
  const point = (i, edge = false) => p.evaluate(({ i, edge }) => {
    const r = document.querySelectorAll('.evx-bay')[i].getBoundingClientRect();
    const x = edge ? r.left + 2 : r.left + r.width / 2, y = edge ? r.top + 2 : r.top + r.height / 2;
    return { x, y, hit: document.elementFromPoint(x, y)?.className };
  }, { i, edge });
  const trace = async () => p.evaluate(() => {
    window.selectionFrames = []; window.selectionInputs = []; window.selectionStart = performance.now();
    const input = (e) => window.selectionInputs.push({ ms: performance.now() - window.selectionStart, type: e.type, cls: e.target?.className, y: scrollY });
    window.selectionInput = input;
    for (const k of ['pointerdown', 'pointerup', 'pointercancel', 'click', 'wheel', 'touchmove']) document.addEventListener(k, input, true);
    const sample = () => {
      window.selectionFrames.push({ ms: performance.now() - window.selectionStart, ...window.__acm.events.snapshot(), camera: window.__acm.teams.camera() });
      window.selectionRaf = requestAnimationFrame(sample);
    }; sample();
  });
  for (const kind of ['stable', 'held-edge', 'moving-press', 'double', 'keyboard', 'after-record']) {
    const i = kind === 'after-record' ? 4 : 6;
    if (kind === 'after-record') {
      await p.evaluate(() => { const a = window.__acm; a.events.room(0, 1); a.jump(a.events.at('read', 0.1)); }); await wait(450);
      await p.keyboard.press('Escape');
      await p.waitForFunction(() => !window.__acm.events.snapshot().visiting, { timeout: 15000 }); await wait(350);
    } else await reset(kind === 'moving-press' ? 'arrival' : 'hub', kind === 'moving-press' ? 0.6 : 0.3);
    await trace();
    let at = await point(i, kind === 'held-edge');
    if (kind === 'moving-press') {
      await p.mouse.wheel({ deltaY: 500 }); await wait(50); at = await point(i);
    }
    if (kind === 'keyboard') { await p.evaluate((i) => document.querySelectorAll('.evx-bay')[i].focus({ preventScroll: true }), i); await p.keyboard.press('Enter'); }
    else if (touch && ['held-edge', 'moving-press'].includes(kind)) {
      const cdp = await p.createCDPSession();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y, id: 1 }] });
      await wait(kind === 'held-edge' ? 450 : 250);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
    }
    else if (touch) {
      await p.touchscreen.tap(at.x, at.y);
      if (kind === 'double') await p.touchscreen.tap(at.x, at.y);
    }
    else {
      await p.mouse.move(at.x, at.y); await p.mouse.down();
      await wait(kind === 'held-edge' ? 450 : kind === 'moving-press' ? 250 : 20);
      await p.mouse.up();
      if (kind === 'double') await p.mouse.click(at.x, at.y);
    }
    await wait(4800);
    const end = await snap(p);
    const result = await p.evaluate(() => {
      cancelAnimationFrame(window.selectionRaf);
      for (const k of ['pointerdown', 'pointerup', 'pointercancel', 'click', 'wheel', 'touchmove']) document.removeEventListener(k, window.selectionInput, true);
      return { frames: window.selectionFrames, inputs: window.selectionInputs };
    });
    cases.push({ device, kind, at, end, ...result });
    if (mode !== 'baseline') {
      check(end.selected === i && end.view.room > 0.99, `${device}: ${kind} selects and reaches the intended 3D room`, end);
      check(end.view.unfold < 0.003 && result.frames.every((f) => f.view.unfold < 0.003), `${device}: ${kind} never skips directly to editorial`, end.view);
      const entry = result.frames.filter((f) => f.view.enter > 0.01 && f.view.enter < 0.99);
      check(entry.length > 25 && entry.at(-1)?.ms - entry[0]?.ms > 1200, `${device}: ${kind} preserves a real smooth approach`, { n: entry.length, ms: entry.at(-1)?.ms - entry[0]?.ms });
      const backwards = result.frames.some((f, n) => n > 0 && f.target < result.frames[n - 1].target - 1e-5 && f.selected === i);
      check(!backwards, `${device}: ${kind} does not reset or stutter backward during entry`);
    }
  }
  // A late/duplicated handler must never switch rooms under an already-open editorial.
  await p.evaluate(() => { const a = window.__acm; a.events.room(0, 1); a.jump(a.events.at('read', 0.1)); }); await wait(500);
  const staleBefore = await snap(p); await p.evaluate(() => window.__acm.events.visit(4)); await wait(300);
  const staleAfter = await snap(p);
  cases.push({ device, kind: 'stale-selection', before: staleBefore, end: staleAfter, inputs: [] });
  if (mode !== 'baseline') check(staleBefore.selected === staleAfter.selected && staleBefore.target === staleAfter.target,
    `${device}: late selection cannot replace room/editorial content`, { staleBefore, staleAfter });
  await reset();
  const at = await point(6);
  if (touch) {
    const cdp = await p.createCDPSession();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y, id: 1 }] });
    for (let n = 1; n <= 5; n++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: at.x, y: at.y + n * 18, id: 1 }] }); await wait(25);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
  } else {
    await p.mouse.move(at.x, at.y); await p.mouse.down(); await p.mouse.move(at.x + 45, at.y + 45, { steps: 5 }); await p.mouse.up();
  }
  await wait(700);
  if (mode !== 'baseline') check((await snap(p)).selected < 0, `${device}: a drag/swipe is not mistaken for selection`);
  await p.screenshot({ path: `${out}/${device}-after-drag.png` });
  await p.evaluate(() => window.__acm.intro.at(150.5)); await wait(800);
  await p.screenshot({ path: `${out}/${device}-wordmark.png` });
  if (mode !== 'baseline') check(await p.evaluate(() => window.__acm.scene.getObjectByName('intro-acm-ceg').children[0].material.uniforms.uFace.value.getHexString() === '50107b'), `${device}: darker purple face is rendered by the physical wordmark material`);
  await p.close();
}
try { await run(1440, 900, false); await run(390, 844, true); }
catch (e) { failures.push(e.stack ?? String(e)); }
finally { await browser.close(); }
writeFileSync(`${out}/results.json`, JSON.stringify({ passed, failures, errors, cases }, null, 2));
console.log(JSON.stringify({ passed: passed.length, failures, errors, cases: cases.map(({ device, kind, at, end, inputs }) => ({ device, kind, at, selected: end.selected, room: end.view.room, page: end.view.page, inputs })) }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
