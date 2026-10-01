// Current architecture mobile regression/stress coverage. Fixtures place a scene;
// touch/keyboard input, not debug action helpers, activate and close interactions.
// Chrome viewport emulation is NOT real mobile chrome, Safari, thermals or safe-area hardware.
// node scripts/qa/mobile-stress.mjs [base] [out] [matrix,touch,resize,safeareas,loops,lifecycle,reduced]
import { mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const [, , base = 'http://localhost:3303', out = '/tmp/acm-mobile-stress', groups = 'matrix,touch,resize,safeareas,loops,lifecycle,reduced'] = process.argv;
const selected = new Set(groups.split(','));
const formats = [['small', 360, 640], ['standard', 375, 812], ['tall', 390, 844], ['large', 430, 932], ['short', 390, 600], ['landscape', 844, 390], ['short-landscape', 740, 320]].filter(([name]) => !process.env.FORMATS || process.env.FORMATS.split(',').includes(name));
const passed = [], failures = [], errors = [], observations = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const check = (ok, label, data = null) => (ok ? passed : failures).push(ok ? label : { label, data });
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc'], defaultViewport: null });

async function boot(name = 'phone', width = 390, height = 844, { reduced = false, slow = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: Number(process.env.DPR ?? 1), isMobile: true, hasTouch: true });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${name}: ${r.status()} ${r.url()}`); });
  await page.evaluateOnNewDocument(() => {
    // Count LIVE window/document listeners by identity/capture, not addEventListener calls.
    const ids = new WeakMap(); let next = 0;
    const id = (o) => { if (!ids.has(o)) ids.set(o, ++next); return ids.get(o); };
    const live = new Set();
    const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
    const key = (target, type, listener, options) => `${id(target)}:${type}:${id(listener)}:${!!(typeof options === 'boolean' ? options : options?.capture)}`;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if ((this === window || this === document) && listener) live.add(key(this, type, listener, options));
      return add.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      if ((this === window || this === document) && listener) live.delete(key(this, type, listener, options));
      return remove.call(this, type, listener, options);
    };
    window.__mobileListeners = live;
  });
  const cdp = await page.createCDPSession();
  if (slow) {
    await page.setCacheEnabled(false);
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 750000 / 8, uploadThroughput: 250000 / 8 });
  }
  const started = Date.now();
  await page.goto(`${base}/?debug`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('.loader[data-state="ready"]', { timeout: 240000 });
  observations.push({ name, loadReadyMs: Date.now() - started, simulatedSlowNetwork: slow });
  await page.touchscreen.tap(...Object.values(await centre(page, '[aria-label="Enter silently"]')));
  await sleep(900);
  return { page, cdp, name };
}
async function centre(page, selector) {
  return page.$eval(selector, (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
}
async function tap(page, selector) { const p = await centre(page, selector); await page.touchscreen.tap(p.x, p.y); }
async function until(page, predicate, timeout = 10000) {
  try { await page.waitForFunction(predicate, { timeout, polling: 50 }); return true; } catch { return false; }
}
async function snapshot(page) {
  return page.evaluate(() => {
    const a = window.__acm, c = a.teams.camera();
    return { target: a.progress.target, value: a.progress.value, phase: a.store.getState().phase, quality: a.store.getState().quality, reduced: a.store.getState().reducedMotion, teams: a.teams.snapshot(), events: a.events.snapshot(), camera: c, memory: a.memory(), dom: document.getElementsByTagName('*').length, listeners: window.__mobileListeners.size, heap: performance.memory?.usedJSHeapSize, canvas: document.querySelectorAll('.experience-canvas canvas').length, overflow: document.documentElement.scrollWidth > innerWidth, dimensions: [innerWidth, innerHeight], stage: (() => { const r = document.querySelector('.stage').getBoundingClientRect(); return [r.width, r.height]; })() };
  });
}
async function assertScene(page, label) {
  const s = await snapshot(page);
  check(s.canvas === 1 && !s.overflow && Object.values(s.camera).filter((v) => typeof v === 'number').every(Number.isFinite), `${label}: one finite camera/canvas, no horizontal overflow`, s);
  const size = await page.evaluate(() => { const c = document.querySelector('.experience-canvas canvas'); const r = c.getBoundingClientRect(); return { ratio: r.width / r.height, stage: document.querySelector('.stage').getBoundingClientRect().width / document.querySelector('.stage').getBoundingClientRect().height, width: r.width, height: r.height }; });
  check(size.width > 0 && size.height > 0 && Math.abs(size.ratio - size.stage) < 1e-5, `${label}: canvas and stage aspect agree`, size);
  return s;
}
async function outside(page) {
  if (await page.evaluate(() => window.__acm.teams.snapshot().inside)) {
    // A fixture move is explicit about world ownership; a raw jump cannot cross the portal wall.
    await page.evaluate(() => window.__acm.teams.exit());
    await until(page, () => !window.__acm.teams.snapshot().inside && window.__acm.store.getState().phase === 'cinematic');
    await sleep(200);
  }
}
async function intro(page, beat) { await outside(page); await page.evaluate((t) => window.__acm.intro.at(t), beat); await sleep(350); }
async function crew(page, i) { await page.evaluate((i) => window.__acm.teams.domain(i), i); await sleep(650); }
async function hub(page) { await outside(page); await page.evaluate(() => window.__acm.jump(window.__acm.events.hubRest)); await sleep(900); }
async function portal(page) { await outside(page); await page.evaluate(() => { const a = window.__acm, s = a.segments.portal; a.jump(s.start + (s.end - s.start) * 0.9); }); await until(page, () => window.__acm.teams.snapshot().state === 'portalIdle'); await sleep(500); }
async function swipe({ page, cdp }, delta, duration = 200) {
  const v = page.viewport(); const x = v.width * 0.25, y = delta > 0 ? v.height * 0.78 : v.height * 0.22;
  const count = Math.max(2, Math.round(duration / 16));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let i = 1; i <= count; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - delta * i / count, id: 1 }] }); await sleep(duration / count); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function hold(ctx, duration, cancel = false) {
  const p = await centre(ctx.page, '.portal-target');
  await ctx.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...p, id: 1 }] });
  await sleep(duration);
  await ctx.cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
}
async function assertInvitation(page, name, width, height) {
  const invitation = await page.evaluate(() => {
    const rect = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const items = [...document.querySelectorAll('.evx-crew-hint, .evx-crew-btn')].map(rect);
    const bays = [...document.querySelectorAll('.evx-bay')].map(rect);
    const overlaps = items.flatMap((r, i) => bays.filter((b) => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top).map((b) => ({ item: i, r, b })));
    return { items, overlaps };
  });
  observations.push({ label: `${name}: Events invitation`, ...invitation });
  check(invitation.overlaps.length === 0 && invitation.items.every((r) => r.left >= 0 && r.right <= width && r.top >= 0 && r.bottom <= height), `${name}: Events invitation clears every room hit region and viewport`, invitation);
}
async function domain(ctx, i, label) {
  await crew(ctx.page, i);
  const orbit = await snapshot(ctx.page);
  const p = await ctx.page.evaluate((i) => window.__acm.teams.cardScreen(i), i);
  check(!!p, `${label}: domain ${i} has a visible pick point`, p);
  if (!p) return;
  await ctx.page.touchscreen.tap(p.x, p.y);
  const opened = await until(ctx.page, () => window.__acm.teams.snapshot().state === 'domainDetail');
  const s = await snapshot(ctx.page);
  check(opened && s.teams.selected === i && s.teams.focus > 0.999, `${label}: real tap enters domain ${i}`, s.teams);
  if (!opened) return;
  await sleep(250);
  const cards = await ctx.page.$$eval('.hand-card', (els) => els.map((el) => ({ text: el.textContent.trim(), disabled: el.disabled })));
  check(cards.length > 0 && cards.every((c) => c.text && !c.disabled), `${label}: domain ${i} has accessible member cards`, cards);
  if (i === 0) check(['Visvam Srinivasan', 'Sankara Krishnan P', 'Purushothaman V', 'Manesh Ram'].every((name) => cards.some((c) => c.text.includes(name))), `${label}: CORE preserves all four officers`);
  if (i === 1) check(cards.some((c) => c.text.includes('Prithvi')), `${label}: Prithvi remains in Web/App`);
  if (i === 5) check(cards.some((c) => c.text.includes('Varshhaa')), `${label}: Varshhaa remains in HR/Logistics`);
  await tap(ctx.page, '.hand-card');
  await sleep(500);
  check(await ctx.page.$eval('.hand-card', (b) => b.getAttribute('aria-pressed') === 'true'), `${label}: member can be drawn by touch`);
  await ctx.page.keyboard.press('Escape');
  await sleep(300);
  check(await ctx.page.$eval('.hand-card', (b) => b.getAttribute('aria-pressed') === 'false'), `${label}: member Escape returns it to the hand`);
  await tap(ctx.page, '.domain-controls button[aria-label="Close"]');
  check(await until(ctx.page, () => window.__acm.teams.snapshot().state === 'teamsActive'), `${label}: touch Close returns domain ${i}`);
  const restored = await snapshot(ctx.page);
  check(Math.abs(restored.teams.c - orbit.teams.c) < 0.005 && Math.abs(restored.target - orbit.target) < 2e-5, `${label}: domain ${i} returns to the same orbit/navigation`, { before: [orbit.teams.c, orbit.target], after: [restored.teams.c, restored.target] });
  await assertScene(ctx.page, `${label}: closed domain ${i}`);
}

async function matrix() {
  const beats = [-42, -28, -13, 13, 28, 45, 64, 79, 95, 117, 127, 135, 147, 160, 175, 185, 195];
  for (const [name, width, height] of formats) {
    const ctx = await boot(name, width, height);
    for (const beat of beats) {
      await intro(ctx.page, beat); await assertScene(ctx.page, `${name}: Intro ${beat}`);
      if ([-13, 45, 95, 127, 147, 185].includes(beat)) await ctx.page.screenshot({ path: `${out}/${name}-intro-${beat}.png` });
    }
    await ctx.page.screenshot({ path: `${out}/${name}-door.png` });
    await hub(ctx.page); await assertScene(ctx.page, `${name}: Events matrix`);
    const bays = await ctx.page.$$eval('.evx-bay', (els) => els.map((b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }));
    check(bays.length === 9 && bays.every((b) => b.w >= 24 && b.h >= 24 && b.cx > 0 && b.cx < width && b.cy > 0 && b.cy < height), `${name}: all nine room touch regions are visible and usable`, bays);
    await assertInvitation(ctx.page, name, width, height);
    await ctx.page.screenshot({ path: `${out}/${name}-events.png` });
    for (let i = 0; i < 7; i++) await domain(ctx, i, name);
    await ctx.page.screenshot({ path: `${out}/${name}-crew.png` });
    await ctx.page.close();
  }
}
async function invitation() {
  for (const [name, width, height] of formats) {
    const ctx = await boot(name, width, height); await hub(ctx.page);
    await assertInvitation(ctx.page, name, width, height);
    await ctx.page.screenshot({ path: `${out}/${name}-events-invitation.png` });
    await ctx.page.close();
  }
}
async function touch() {
  const ctx = await boot('touch');
  await hub(ctx.page);
  const fixture = await snapshot(ctx.page);
  for (const [label, d, ms] of [['slow', 80, 700], ['normal', 150, 200], ['fast', 210, 64], ['reverse', -140, 160], ['tiny', 4, 200]]) {
    const before = await snapshot(ctx.page); await swipe(ctx, d, ms); await sleep(650); const after = await snapshot(ctx.page);
    check((Math.abs(d) < 10 || (after.target - before.target) * d > 0) && after.phase === 'cinematic', `${label}: real swipe follows input without a lock`, { before: before.target, after: after.target });
  }
  await portal(ctx.page);
  await hold(ctx, 350, true); await sleep(500);
  let s = await snapshot(ctx.page);
  check(!s.teams.holding && !s.teams.inside && s.teams.hold < 0.05, 'interrupted portal hold releases cleanly', s.teams);
  await hold(ctx, 250); await sleep(500); s = await snapshot(ctx.page);
  check(!s.teams.holding && !s.teams.inside, 'short repeated portal hold does not activate twice', s.teams);
  await hold(ctx, 2300);
  check(await until(ctx.page, () => window.__acm.teams.snapshot().state === 'teamsActive'), 'real touch hold enters Crew');
  check((await snapshot(ctx.page)).teams.inside, 'portal travel reaches the same Crew world');
  await sleep(1700);
  for (let i = 0; i < 7; i++) await domain(ctx, i, 'touch');
  observations.push({ touchFixture: fixture });
  await ctx.page.close();
}
async function resize() {
  const ctx = await boot('resize');
  for (const [name, fixture] of [['gas', () => intro(ctx.page, -13)], ['building', () => intro(ctx.page, 95)], ['cloud', () => intro(ctx.page, 147)], ['events', () => hub(ctx.page)], ['room', async () => { await hub(ctx.page); await ctx.page.evaluate(() => window.__acm.jump(window.__acm.events.room(6, 0.55))); await sleep(500); }], ['crew', () => crew(ctx.page, 4)], ['final', () => crew(ctx.page, 6)], ['loop', async () => { await crew(ctx.page, 6); await ctx.page.evaluate(() => { const a = window.__acm, r = a.segments.return; a.jump(r.start + 0.72 * (r.end - r.start)); }); await sleep(1100); }]]) {
    await fixture();
    let prev = await snapshot(ctx.page);
    for (const [width, height] of [[390, 744], [390, 900], [844, 390], [390, 844]]) {
      await ctx.page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: true, hasTouch: true }); await sleep(1000);
      const s = await assertScene(ctx.page, `${name}: resize ${width}x${height}`);
      observations.push({ label: `${name}: resize ${width}x${height}`, before: prev.target, after: s.target, memory: s.memory, teams: s.teams.state });
      check(Math.abs(s.target - prev.target) < 2e-5 && s.teams.inside === prev.teams.inside && s.events.selected === prev.events.selected, `${name}: resize preserves journey/selection`, { before: prev.target, after: s.target });
      prev = s;
    }
  }
  await ctx.page.close();
}
async function safeareas() {
  const ctx = await boot('safeareas');
  for (const [label, width, height, insets] of [['portrait', 390, 844, { top: 44, bottom: 34, left: 0, right: 0 }], ['landscape', 844, 390, { top: 0, bottom: 21, left: 44, right: 44 }]]) {
    await ctx.page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await ctx.cdp.send('Emulation.setSafeAreaInsetsOverride', { insets });
    await hub(ctx.page); await sleep(600);
    const boxes = await ctx.page.$$eval('.topbar button, .topbar a', (els) => els.map((el) => { const r = el.getBoundingClientRect(); return { label: el.textContent.trim(), left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height }; }).filter((r) => r.w && r.h));
    check(boxes.every((r) => r.left >= insets.left && r.right <= width - insets.right && r.top >= insets.top && r.bottom <= height - insets.bottom), `${label}: simulated safe-area chrome bounds`, boxes);
    await crew(ctx.page, 2); const p = await ctx.page.evaluate(() => window.__acm.teams.cardScreen(2)); await ctx.page.touchscreen.tap(p.x, p.y); await until(ctx.page, () => window.__acm.teams.snapshot().state === 'domainDetail'); await sleep(300);
    const detail = await ctx.page.$$eval('.domain-controls button, .hand-title', (els) => els.map((el) => { const r = el.getBoundingClientRect(); return { label: el.textContent.trim(), left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }));
    check(detail.every((r) => r.left >= insets.left && r.right <= width - insets.right && r.top >= insets.top && r.bottom <= height - insets.bottom), `${label}: long domain heading/controls clear simulated safe areas`, detail);
    await ctx.page.screenshot({ path: `${out}/${label}-safe-area-domain.png` });
    await tap(ctx.page, '.domain-controls button[aria-label="Close"]'); await until(ctx.page, () => window.__acm.teams.snapshot().state === 'teamsActive');
  }
  await ctx.page.close();
}
async function resources(page, label) {
  await page.evaluate(() => window.gc?.()); await sleep(150);
  const s = await snapshot(page); observations.push({ label, ...s }); return s;
}
async function loops() {
  const ctx = await boot('loops'); const samples = [];
  for (let loop = 1; loop <= 5; loop++) {
    for (const beat of [-13, 28, 95, 127, 147, 195]) await intro(ctx.page, beat);
    await hub(ctx.page);
    for (const i of [0, 6, 8]) { await ctx.page.evaluate((i) => window.__acm.jump(window.__acm.events.room(i, 0.7)), i); await sleep(400); }
    await portal(ctx.page); await hold(ctx, 2200); await until(ctx.page, () => window.__acm.teams.snapshot().state === 'teamsActive'); await sleep(1600);
    for (let i = 0; i < 7; i++) await domain(ctx, i, `loop ${loop}`);
    // Place just BEFORE the real seam, then CROSS it with actual user input.
    await ctx.page.evaluate(() => { const a = window.__acm, r = a.segments.return; a.jump(r.start + 0.78 * (r.end - r.start)); }); await sleep(1100);
    await swipe(ctx, 150, 220); await sleep(1700);
    let s = await snapshot(ctx.page);
    check(!s.teams.inside && s.target < 0.05, `loop ${loop}: real forward touch crosses end→start`, s);
    // Reverse the same seam with touch, then continue into the last Crew card.
    await swipe(ctx, -190, 240); await sleep(1800); s = await snapshot(ctx.page);
    check(s.teams.inside && s.target > 0.85, `loop ${loop}: real reverse touch crosses start→end`, s);
    // Canonical sample point, after exercising both seams and all seven member hands.
    await ctx.page.evaluate(() => { const a = window.__acm, r = a.segments.return; a.jump(r.start + 0.78 * (r.end - r.start)); }); await sleep(900); await swipe(ctx, 150, 220); await sleep(1600);
    await intro(ctx.page, 0); await sleep(600); samples.push(await resources(ctx.page, `loop ${loop}`));
  }
  const warm = samples[1], end = samples.at(-1);
  check(end.memory.geometries <= warm.memory.geometries && end.memory.textures <= warm.memory.textures && end.memory.programs <= warm.memory.programs, 'five loops: GPU resources plateau after warming', samples.map((s) => s.memory));
  check(end.listeners <= warm.listeners && end.dom <= warm.dom + 4, 'five loops: listener identities and DOM do not accumulate', samples.map((s) => ({ listeners: s.listeners, dom: s.dom })));
  check(end.heap === undefined || end.heap <= warm.heap + 8 * 1048576, 'five loops: collected JS heap remains within 8MiB of warmed state', samples.map((s) => s.heap));
  await ctx.page.close();
}
async function reduced() {
  const ctx = await boot('reduced', 390, 844, { reduced: true });
  check((await snapshot(ctx.page)).reduced, 'mobile reduced-motion preference detected');
  for (const beat of [-13, 95, 147, 195]) { await intro(ctx.page, beat); await sleep(650); await assertScene(ctx.page, `reduced Intro ${beat}`); }
  await hub(ctx.page); await tap(ctx.page, '.evx-bay:nth-child(7)');
  check(await until(ctx.page, () => window.__acm.events.snapshot().view.room > 0.99), 'reduced touch opens the event framed still');
  await ctx.page.keyboard.press('Escape'); await sleep(700); await portal(ctx.page); await hold(ctx, 2200); await until(ctx.page, () => window.__acm.teams.snapshot().state === 'teamsActive');
  for (let i = 0; i < 7; i++) await domain(ctx, i, 'reduced');
  await ctx.page.keyboard.press('n'); await sleep(800);
  check(!(await snapshot(ctx.page)).teams.inside, 'reduced N past final domain loops to opening still');
  await ctx.page.keyboard.press('p'); await sleep(800);
  check((await snapshot(ctx.page)).teams.inside, 'reduced P before opening still returns to Crew');
  await ctx.page.close();
}
async function lifecycle() {
  const ctx = await boot('lifecycle');
  for (const [label, fixture] of [['Intro', () => intro(ctx.page, 95)], ['Events', () => hub(ctx.page)], ['Crew', () => crew(ctx.page, 4)]]) {
    await fixture(); const before = await snapshot(ctx.page);
    await ctx.cdp.send('Page.setWebLifecycleState', { state: 'frozen' }); await sleep(600); await ctx.cdp.send('Page.setWebLifecycleState', { state: 'active' }); await sleep(700);
    const after = await snapshot(ctx.page);
    check(Math.abs(before.target - after.target) < 2e-5 && before.teams.inside === after.teams.inside && before.listeners === after.listeners && after.canvas === 1, `${label}: browser lifecycle freeze/resume preserves position/ownership`, { before, after });
  }
  for (const [label, fixture] of [['Intro', () => intro(ctx.page, 95)], ['Events', () => hub(ctx.page)], ['Crew', () => crew(ctx.page, 6)], ['loop', async () => { await crew(ctx.page, 6); await ctx.page.evaluate(() => { const a = window.__acm, r = a.segments.return; a.jump(r.start + 0.72 * (r.end - r.start)); }); await sleep(700); }], ['repeated', () => intro(ctx.page, 147)]]) {
    await fixture(); await ctx.page.reload({ waitUntil: 'domcontentloaded' }); await ctx.page.waitForSelector('.loader[data-state="ready"]', { timeout: 240000 });
    await tap(ctx.page, '[aria-label="Enter silently"]'); await sleep(1000); const s = await assertScene(ctx.page, `${label}: reload`);
    check(!s.teams.inside && s.events.selected === -1 && s.target < 0.05, `${label}: reload starts deterministically, no stale selection`, s);
  }
  // Context loss should recover once, then fall back if repeated shortly afterward.
  await ctx.page.evaluate(() => {
    window.__mobileOldCanvas = document.querySelector('.experience-canvas canvas');
    window.__mobileContextLosses = 0;
    window.__mobileOldCanvas.addEventListener('webglcontextlost', () => window.__mobileContextLosses++, { once: true });
    window.__mobileOldCanvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();
  });
  check(await until(ctx.page, () => window.__mobileContextLosses === 1 && window.__acm.store.getState().webgl === 'ok' && document.querySelectorAll('.experience-canvas canvas').length === 1 && document.querySelector('.experience-canvas canvas') !== window.__mobileOldCanvas && window.__acm.memory().geometries > 0, 15000), 'one context loss replaces the lost canvas and recovers a single rendered world');
  await ctx.page.evaluate(() => { delete window.__mobileOldCanvas; });
  await sleep(1000); await assertScene(ctx.page, 'after context recovery');
  await ctx.page.evaluate(() => document.querySelector('.experience-canvas canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  check(await until(ctx.page, () => document.documentElement.dataset.fallback === 'true'), 'repeated context loss falls back to accessible print');
  await ctx.page.close();
  const slow = await boot('slow-network', 390, 844, { slow: true }); await assertScene(slow.page, 'slower-network opening'); await slow.page.close();
}

try {
  for (const [name, run] of Object.entries({ invitation, matrix, touch, resize, safeareas, loops, lifecycle, reduced })) {
    if (!selected.has(name)) continue;
    console.log(`START ${name}`);
    try { await run(); } catch (e) { failures.push({ label: `${name}: suite exception`, data: e.stack }); }
    writeFileSync(`${out}/results.json`, JSON.stringify({ passed, failures, errors, observations }, null, 2));
    console.log(`END ${name}: ${passed.length} checks passed, ${failures.length} failures`);
  }
} finally { await browser.close(); }
writeFileSync(`${out}/results.json`, JSON.stringify({ passed, failures, errors, observations }, null, 2));
console.log(JSON.stringify({ passed: passed.length, failures, errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
