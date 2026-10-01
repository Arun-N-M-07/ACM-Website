// The Events: the matrix and its nine rooms, each visited and left, their records read to the choice
// at their end, the next event, the matrix opening onto the portal and the Crew beyond — forwards and
// back, at every pace, by pointer, keyboard and touch, and again and again (for leaks).
//   node scripts/qa/events.mjs [base] [outDir] [sections]
// sections: a comma-separated list of desktop, rooms, scroll, phone, landscape, reduced, cycles.
import { mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const [, , base = 'http://localhost:3100', out = '/tmp/acm-events', only = ''] = process.argv;
mkdirSync(out, { recursive: true });
const sections = new Set((only || 'desktop,rooms,scroll,phone,landscape,reduced,cycles').split(','));
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const errors = [];
const failures = [];
const passes = [];
const notes = [];
const hitches = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg, detail) => {
  if (ok) passes.push(msg);
  else failures.push(detail === undefined ? msg : `${msg} — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  return ok;
};

async function boot(name, width, height, { touch = false, reduced = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/audio/')) errors.push(`${name}: ${r.status()} ${r.url()}`); });
  await page.goto(`${base}/?debug`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.loader[data-state="ready"]', { timeout: 240000 });
  await sleep(600);
  await page.click('[aria-label="Enter silently"]');
  await sleep(1500);
  return page;
}

const snap = (page) => page.evaluate(() => window.__acm.events.snapshot());
const until = async (page, fn, arg, ms = 9000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn, arg)) return true;
    await sleep(80);
  }
  return false;
};

/** Record the camera and the Events' state every frame while `act` runs (and `tail` ms after). */
async function record(page, act, tail = 0) {
  await page.evaluate(() => {
    window.__rec = [];
    const gen = (window.__recGen = (window.__recGen ?? 0) + 1);
    window.__recOn = true;
    const t0 = performance.now();
    const step = () => {
      if (!window.__recOn || window.__recGen !== gen) return;
      const s = window.__acm.events.snapshot();
      window.__rec.push({ t: performance.now() - t0, c: window.__acm.teams.camera(), v: s.view, sel: s.selected, vis: s.visiting, p: s.value, tg: s.target, fade: window.__acm.fx.fade, ts: window.__acm.teams.snapshot().state });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  await act();
  if (tail) await sleep(tail);
  return page.evaluate(() => {
    window.__recOn = false;
    return window.__rec;
  });
}

/**
 * A cut in a trace: a frame whose camera moves far faster than the frames either side of it (speed,
 * so a slow frame that covers more ground isn't one), or turns or zooms faster than any camera move.
 */
function cuts(rec, { speed = 3, floor = 0.3, label = '' } = {}) {
  const d = [];
  for (let k = 1; k < rec.length; k++) {
    const a = rec[k - 1].c;
    const b = rec[k].c;
    if (!a || !b) continue;
    const dt = Math.max(1, rec[k].t - rec[k - 1].t) / (1000 / 60);
    if (dt > 3) hitches.push(`${label} ${Math.round(dt * 16.7)}ms`);
    const pos = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    d.push({ k, v: pos / dt, fov: Math.abs(b.fov - a.fov) / dt, turn: Math.max(Math.abs(b.yaw - a.yaw), Math.abs(b.pitch - a.pitch), Math.abs(b.roll - a.roll)) / dt });
  }
  let worst = null;
  for (let k = 1; k < d.length - 1; k++) {
    const x = d[k];
    const around = (key) => Math.max(d[k - 1][key], d[k + 1][key]);
    const jump = x.v > floor && x.v > speed * around('v');
    const zoom = (x.fov > 1.2 && x.fov > speed * around('fov')) || x.fov > 5;
    const spin = (x.turn > 0.12 && x.turn > speed * around('turn')) || x.turn > 0.5;
    if ((jump || zoom || spin) && (!worst || x.v > worst.v)) worst = { ...x, around: around('v'), t: rec[x.k].t, p: rec[x.k].p };
  }
  return worst;
}
const dark = (rec) => rec.some((r) => r.fade > 0.05);

const bayCentre = (page, i) => page.evaluate((i) => { const b = window.__acm.events.bay(i); return b && { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }; }, i);
const toHub = async (page) => {
  await page.evaluate(() => window.__acm.jump(window.__acm.events.hubRest));
  await until(page, () => window.__acm.events.snapshot().view.hub > 0.99, null, 5000);
  await sleep(500);
};
const EVENT_TITLES = ['C.O.D.E', 'Tech Talks', 'MasterClass', 'Head Start', 'PatternX', 'CodeX', 'Prodigy', 'Open Source Mentorship Program', 'CodHer'];

/** Visit room i by clicking its bay; returns the trace to the installation played. */
async function visitByClick(page, i) {
  const c = await bayCentre(page, i);
  await page.mouse.move(c.x, c.y, { steps: 5 });
  await sleep(300);
  return record(page, async () => {
    await page.mouse.click(c.x, c.y);
    await until(page, () => window.__acm.events.snapshot().view.room > 0.999, null, 14000);
  }, 200);
}
async function backByEsc(page) {
  return record(page, async () => {
    await page.keyboard.press('Escape');
    await until(page, () => { const s = window.__acm.events.snapshot(); return !s.visiting && s.view.hub > 0.99; }, null, 9000);
  }, 200);
}

// ─── Desktop: the matrix, the tracing, the flows ─────────────────────────────
async function desktop() {
  const name = 'desktop';
  const page = await boot(name, 1440, 900);
  // The arrival, by the wheel: the hall, the matrix, its rooms coming up.
  await page.evaluate(() => window.__acm.jump(window.__acm.segments.events.start + 0.0003));
  await sleep(2000);
  let tr = await record(page, async () => {
    await page.mouse.move(720, 450);
    for (let k = 0; k < 400; k++) {
      if ((await page.evaluate(() => window.__acm.events.snapshot().view.hub)) > 0.99) break;
      await page.mouse.wheel({ deltaY: 90 });
      await sleep(40);
    }
    await sleep(1200);
  });
  let cut = cuts(tr, { label: 'arrival' });
  check(!cut, `${name}: the arrival — no cut`, cut);
  check(tr.at(-1).v.reveal > 0.99 && tr.at(-1).v.hub > 0.99, `${name}: arrived at the whole matrix, every room up`, tr.at(-1).v);
  await page.screenshot({ path: `${out}/${name}-hub.png` });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: no sideways overflow`);

  // Every bay answers the pointer, alone, and names its event; the tracing runs.
  for (let i = 0; i < 9; i++) {
    const c = await bayCentre(page, i);
    await page.mouse.move(c.x, c.y, { steps: 4 });
    await sleep(480);
    const s = await snap(page);
    const lab = await page.evaluate(() => ({ on: document.querySelector('.evx-label').dataset.on, text: document.querySelector('.evx-label').textContent }));
    check(s.hover === i && s.lit[i] > 0.9 && s.lit.every((l, k) => k === i || l < 0.1), `${name}: bay ${i + 1} lights under the pointer, alone`, { hover: s.hover, lit: s.lit });
    check(lab.on === 'true' && lab.text.includes(EVENT_TITLES[i]) && /Visit/.test(lab.text), `${name}: bay ${i + 1} is named, with its Visit`, lab);
    if (i === 4) {
      await page.mouse.move(c.x - 5, c.y, { steps: 2 });
      await sleep(40);
      await page.screenshot({ path: `${out}/${name}-hover-05.png` });
    }
  }
  const trace = await page.evaluate(() => [...window.__acm.events.snapshot().lit]);
  await page.mouse.move(40, 880);
  await sleep(700);
  let s = await snap(page);
  check(s.hover === -1 && s.lit.every((l) => l < 0.03), `${name}: the pointer away — nothing lit, no label left`, s.lit);
  check((await page.evaluate(() => document.querySelector('.evx-label').dataset.on)) === 'false', `${name}: the label gone with it`);
  notes.push(`hover lit at bay 9: ${JSON.stringify(trace)}`);

  // The wall at the end of a record: scrolling on changes nothing (no event unasked).
  await page.evaluate(() => { window.__acm.jump(window.__acm.events.room(6, 0.02)); });
  await sleep(600);
  await page.evaluate(() => window.__acm.jump(window.__acm.events.wall));
  await sleep(1800);
  s = await snap(page);
  const wall = s.target;
  for (let k = 0; k < 20; k++) { await page.mouse.wheel({ deltaY: 200 }); await sleep(40); }
  await sleep(1400);
  s = await snap(page);
  check(s.selected === 6 && s.visiting && Math.abs(s.target - wall) < 1e-4 && s.view.decide > 0.95, `${name}: past the end of the record the scroll holds — the choice is the visitor's`, s);
  const links = await page.evaluate(() => ({ reg: [...document.querySelectorAll('.evx-register a')].map((a) => a.href), all: [...document.querySelectorAll('.evx-sheet a')].map((a) => a.href) }));
  check(JSON.stringify(links.reg.sort()) === JSON.stringify(['https://forms.gle/B28ropzrbtBJhhu57', 'https://forms.gle/Wq9mtdzBJwwWNTB5A']), `${name}: Prodigy's registration — its two real forms, nothing else`, links);
  await page.screenshot({ path: `${out}/${name}-decide-prodigy.png` });

  // Visit next: out to the matrix, into the next room — one continuous move.
  tr = await record(page, async () => {
    await page.click('.evx-next');
    await until(page, () => { const s = window.__acm.events.snapshot(); return s.selected === 7 && s.view.room > 0.999; }, null, 16000);
  }, 200);
  cut = cuts(tr, { label: 'next' });
  s = await snap(page);
  const switchedAt = tr.findIndex((r) => r.sel === 7);
  check(!cut && !dark(tr), `${name}: Visit next — no cut, no fade`, cut);
  check(s.selected === 7 && s.visiting && switchedAt > 0 && tr[switchedAt].v.enter < 0.02, `${name}: …the next room chosen only at the whole matrix, and entered`, { sel: s.selected, at: tr[switchedAt]?.v });
  // Back to full view from its record.
  await page.evaluate(() => window.__acm.jump(window.__acm.events.wall));
  await sleep(1800);
  tr = await record(page, async () => {
    await page.click('.evx-back');
    await until(page, () => { const s = window.__acm.events.snapshot(); return !s.visiting && s.view.hub > 0.99; }, null, 9000);
  }, 300);
  cut = cuts(tr, { label: 'back' });
  s = await snap(page);
  check(!cut && !dark(tr) && !s.visiting && s.selected === -1 && s.view.hub > 0.99, `${name}: Back to full view — unbroken, nothing left chosen`, { cut, s });

  // The last event's next is the Crew.
  await page.evaluate(() => { window.__acm.jump(window.__acm.events.room(8, 0.02)); });
  await sleep(600);
  await page.evaluate(() => window.__acm.jump(window.__acm.events.wall));
  await sleep(1800);
  const nextText = await page.evaluate(() => document.querySelector('.evx-next').textContent);
  check(/Crew/.test(nextText), `${name}: after the last event, the next is the Crew`, nextText);
  const cod = await page.evaluate(() => [...document.querySelectorAll('.evx-register a')].map((a) => a.href));
  check(cod.length === 1 && cod[0] === 'https://codher.in/', `${name}: CodHer's registration, its one real link`, cod);
  await page.evaluate(() => window.__acm.events.back());
  await until(page, () => !window.__acm.events.snapshot().visiting, null, 9000);
  // An event without a registration link has none.
  await page.evaluate(() => { window.__acm.jump(window.__acm.events.room(0, 0.02)); });
  await sleep(600);
  await page.evaluate(() => window.__acm.jump(window.__acm.events.at('read', 0.05)));
  await sleep(1800);
  check((await page.evaluate(() => document.querySelectorAll('.evx-register').length)) === 0, `${name}: C.O.D.E — no registration shown (it has none)`);
  await page.screenshot({ path: `${out}/${name}-record-code.png` });
  await page.keyboard.press('Escape');
  await until(page, () => !window.__acm.events.snapshot().visiting, null, 9000);

  // Keyboard: a bay by Tab, in by Enter, out by Esc, and focus back at the bay.
  await toHub(page);
  await page.evaluate(() => document.querySelectorAll('.evx-bay')[2].focus());
  await sleep(500);
  s = await snap(page);
  check(s.hover === 2 && s.lit[2] > 0.8, `${name}: keyboard focus lights a bay`, s.hover);
  await page.keyboard.press('Enter');
  await until(page, () => window.__acm.events.snapshot().view.room > 0.999, null, 14000);
  s = await snap(page);
  check(s.selected === 2 && s.visiting, `${name}: Enter visits it`, s.selected);
  await page.keyboard.press('Escape');
  await until(page, () => { const s = window.__acm.events.snapshot(); return !s.visiting && s.view.hub > 0.99; }, null, 9000);
  await sleep(500);
  check(await page.evaluate(() => document.activeElement === document.querySelectorAll('.evx-bay')[2]), `${name}: Esc — back, the keyboard at the bay again`);

  // Turned round: a visit reversed half-way by the wheel.
  await toHub(page);
  {
    const c = await bayCentre(page, 3);
    await page.mouse.move(c.x, c.y, { steps: 3 });
    await sleep(200);
    tr = await record(page, async () => {
      await page.mouse.click(c.x, c.y);
      await sleep(1300);
      for (let k = 0; k < 30; k++) { await page.mouse.wheel({ deltaY: -120 }); await sleep(30); }
      await sleep(2500);
    });
    cut = cuts(tr, { label: 'reverse-entry' });
    const peak = Math.max(...tr.map((r) => r.v.enter));
    s = await snap(page);
    check(!cut && peak > 0.1 && peak < 1 && s.view.enter < 0.05, `${name}: a room's entry turned round by the scroll — back to the matrix, unbroken`, { cut, peak, enter: s.view.enter });
  }

  // Visit the Crew: the matrix opens, the passage, the portal — then through it.
  await toHub(page);
  tr = await record(page, async () => {
    await page.click('.evx-crew-btn');
    await until(page, () => window.__acm.teams.snapshot().state === 'portalIdle', null, 12000);
  }, 600);
  cut = cuts(tr, { label: 'crew' });
  check(!cut && !dark(tr), `${name}: Visit the Crew — no cut, no fade`, cut);
  check(tr.some((r) => r.v.split > 0.3 && r.v.split < 0.7) && tr.at(-1).v.split > 0.99, `${name}: …the matrix opening on the way`, tr.at(-1).v.split);
  await page.screenshot({ path: `${out}/${name}-portal.png` });
  const pt = await page.evaluate(() => { const b = document.querySelector('.portal-target'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (check(!!pt, `${name}: the portal's hold offered`)) {
    await page.mouse.move(pt.x, pt.y);
    await page.mouse.down();
    await sleep(2600);
    await page.mouse.up();
    const inside = await until(page, () => window.__acm.teams.snapshot().state === 'teamsActive', null, 15000);
    check(inside, `${name}: held — into the Crew`);
    await page.screenshot({ path: `${out}/${name}-crew.png` });
  }
  await page.close();
}

// ─── Every room: in, its installation played at its pace, back ───────────────
async function rooms() {
  const name = 'rooms';
  const page = await boot(name, 1440, 900);
  for (let i = 0; i < 9; i++) {
    await toHub(page);
    const tr = await visitByClick(page, i);
    const cut = cuts(tr, { label: `room ${i + 1}` });
    const s = await snap(page);
    // How long the installation took to play (its clock from the threshold to the end).
    const t0 = tr.find((r) => r.v.room > 0.02)?.t ?? 0;
    const t1 = tr.find((r) => r.v.room > 0.98)?.t ?? 0;
    const insideAt = tr.find((r) => r.v.inside > 0.99)?.t ?? 0;
    check(!cut && !dark(tr), `${name}: room ${i + 1} (${EVENT_TITLES[i]}) — entered without a cut or a fade`, cut);
    check(s.selected === i && s.view.inside > 0.99 && s.view.room > 0.99, `${name}: room ${i + 1} — inside, its installation played`, s.view);
    check(t1 - t0 >= 3800, `${name}: room ${i + 1} — the installation given its time (${((t1 - t0) / 1000).toFixed(1)} s)`, { t0, t1 });
    notes.push(`room ${i + 1}: through the frame at ${(insideAt / 1000).toFixed(1)} s, its installation ${((t1 - t0) / 1000).toFixed(1)} s`);
    await page.screenshot({ path: `${out}/room-${String(i + 1).padStart(2, '0')}.png` });
    const bk = await backByEsc(page);
    const c2 = cuts(bk, { label: `room ${i + 1} back` });
    const s2 = await snap(page);
    check(!c2 && !s2.visiting && s2.selected === -1 && s2.view.hub > 0.99, `${name}: room ${i + 1} — back to the whole matrix, unbroken`, c2);
  }
  await page.close();
}

// ─── The scroll: from the matrix on to the portal and back, at three paces ────
async function scroll() {
  const name = 'scroll';
  const page = await boot(name, 1440, 900);
  const sweep = (delta, gap, goal) =>
    record(page, async () => {
      await page.mouse.move(40, 870);
      const fwd = delta > 0;
      for (let k = 0; k < 3000; k++) {
        const t = await page.evaluate(() => window.__acm.progress.target);
        if (fwd ? t >= goal : t <= goal) break;
        await page.mouse.wheel({ deltaY: delta });
        await sleep(gap);
      }
      await sleep(1800);
    });
  const P = await page.evaluate(() => ({ stand: window.__acm.segments.portal.start + (window.__acm.segments.portal.end - window.__acm.segments.portal.start) * 0.66, start: window.__acm.segments.events.start + 0.003, seams: window.__acm.events.seams }));
  for (const [label, delta, gap] of [['slow', 50, 45], ['normal', 140, 40], ['fast', 480, 26]]) {
    await toHub(page);
    let tr = await sweep(delta, gap, P.stand);
    let cut = cuts(tr, { speed: label === 'fast' ? 5 : 3, floor: label === 'fast' ? 1 : 0.3, label });
    const shifted = tr.some((r, k) => k && r.tg - tr[k - 1].tg > (P.seams.rejoin - P.seams.hub) * 0.5);
    check(!cut, `${name}: ${label} — from the matrix on through its opening, no cut`, cut);
    check(shifted && tr.every((r) => r.v.enter < 0.001), `${name}: ${label} — the scroll goes on past the rooms (none entered unasked)`, { shifted });
    check(tr.at(-1).v.split > 0.99 && tr.at(-1).ts === 'portalIdle', `${name}: ${label} — at the portal`, { split: tr.at(-1).v.split, ts: tr.at(-1).ts });
    tr = await sweep(-delta, gap, P.start);
    cut = cuts(tr, { speed: label === 'fast' ? 5 : 3, floor: label === 'fast' ? 1 : 0.3, label: `${label} back` });
    check(!cut, `${name}: ${label} reverse — the portal, the matrix closing, the hall, back to the lobby: no cut`, cut);
    // (Back at the door the matrix is still in sight through it, coming up as the door opens: not dark, not whole.)
    check(tr.some((r) => r.v.hub > 0.99 && r.v.split < 0.01) && tr.at(-1).v.hub < 0.01 && tr.at(-1).v.reveal < 0.95, `${name}: ${label} reverse — the matrix whole again, and left`, tr.at(-1).v);
  }
  // Turned round in the middle of the opening.
  await toHub(page);
  const mid = await page.evaluate(() => { const s = window.__acm.segments.portal; return s.start + (s.end - s.start) * 0.15; });
  await page.evaluate((p) => window.__acm.scroll(p, 1.2), mid);
  await sleep(2400);
  const tr = await record(page, async () => {
    await page.mouse.move(40, 870);
    for (let k = 0; k < 16; k++) { await page.mouse.wheel({ deltaY: 120 }); await sleep(35); }
    await sleep(300);
    for (let k = 0; k < 40; k++) { await page.mouse.wheel({ deltaY: -120 }); await sleep(35); }
    await sleep(2500);
  });
  const cut = cuts(tr, { label: 'mid-split' });
  check(!cut, `${name}: the opening turned round half-way — no cut`, cut);
  // The record read by the wheel and back: the sheet rises and falls with the scroll.
  await page.evaluate(() => { window.__acm.jump(window.__acm.events.room(5, 0.98)); });
  await sleep(2400);
  const up = await record(page, async () => {
    await page.mouse.move(700, 450);
    for (let k = 0; k < 80; k++) { await page.mouse.wheel({ deltaY: 100 }); await sleep(35); }
    await sleep(1500);
    for (let k = 0; k < 40; k++) { await page.mouse.wheel({ deltaY: -100 }); await sleep(35); }
    await sleep(1500);
  });
  check(!cuts(up, { label: 'read' }) && up.some((r) => r.v.read > 0.5) && up.at(-1).v.read < up.reduce((m, r) => Math.max(m, r.v.read), 0), `${name}: a record read on and back by the wheel — the camera steady, the sheet with the scroll`);
  await page.close();
}

// ─── Phone ────────────────────────────────────────────────────────────────────
async function phone(name, width, height) {
  const page = await boot(name, width, height, { touch: true });
  await toHub(page);
  await page.screenshot({ path: `${out}/${name}-hub.png` });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: no sideways overflow`);
  for (const i of [0, 4, 8]) {
    const c = await bayCentre(page, i);
    check(c && c.x > 0 && c.x < width && c.y > 0 && c.y < height, `${name}: bay ${i + 1} on screen`, c);
  }
  // A tap: the room focused, named, its Visit offered large.
  const c = await bayCentre(page, 6);
  const hit = await page.evaluate((c) => { const el = document.elementFromPoint(c.x, c.y); return el ? `${el.className} ${el.getAttribute('aria-label') ?? ''}`.slice(0, 60) : null; }, c);
  notes.push(`${name}: tap at ${Math.round(c.x)},${Math.round(c.y)} → ${hit}`);
  await page.touchscreen.tap(c.x, c.y);
  await sleep(700);
  let s = await snap(page);
  const bar = await page.evaluate(() => { const b = document.querySelector('.evx-focusbar'); const v = document.querySelector('.evx-focusbar-visit'); return { on: b?.dataset.on, text: b?.textContent ?? '', h: v?.getBoundingClientRect().height ?? 0 }; });
  check(s.hover === 6 && s.lit[6] > 0.9 && !s.visiting && bar.on === 'true' && bar.text.includes('Prodigy') && bar.h >= 44, `${name}: a tap focuses the room — its name, and Visit (not a small target)`, { hover: s.hover, bar });
  await page.screenshot({ path: `${out}/${name}-tap.png` });
  // Tap Visit.
  let tr = await record(page, async () => {
    await (await page.$('.evx-focusbar-visit')).tap();
    await until(page, () => window.__acm.events.snapshot().view.room > 0.999, null, 15000);
  }, 200);
  let cut = cuts(tr, { label: `${name} visit` });
  s = await snap(page);
  check(!cut && s.selected === 6 && s.view.inside > 0.99, `${name}: Visit — into the room, unbroken`, cut);
  await page.screenshot({ path: `${out}/${name}-room.png` });
  // Swipe to read the record.
  const cdp = await page.createCDPSession();
  const swipe = async (dy) => {
    const x = width / 2;
    let y = height * 0.62;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    for (let k = 0; k < 10; k++) { y -= dy / 10; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] }); await sleep(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  for (let k = 0; k < 8; k++) { await swipe(height * 0.45); await sleep(250); }
  await sleep(1200);
  s = await snap(page);
  check(s.view.unfold > 0.99 && s.view.read > 0.05, `${name}: swiping — the record risen over the room, and read`, s.view);
  await page.screenshot({ path: `${out}/${name}-record.png` });
  // To the end, and the choice by touch.
  await page.evaluate(() => window.__acm.jump(window.__acm.events.wall));
  await sleep(1800);
  await page.screenshot({ path: `${out}/${name}-decide.png` });
  tr = await record(page, async () => {
    await (await page.$('.evx-back')).tap();
    await until(page, () => { const s = window.__acm.events.snapshot(); return !s.visiting && s.view.hub > 0.99; }, null, 9000);
  }, 200);
  cut = cuts(tr, { label: `${name} back` });
  s = await snap(page);
  check(!cut && !s.visiting && s.view.hub > 0.99, `${name}: Back to full view, by touch`, cut);
  // Visit the Crew.
  await sleep(600);
  notes.push(`${name}: before the Crew — ${JSON.stringify(await page.evaluate(() => { const b = document.querySelector('.evx-crew-btn'); const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { r: [r.left, r.top, r.width, r.height].map(Math.round), at: el && (el.className || el.tagName).toString().slice(0, 30), live: document.querySelector('.evx-hub').dataset.live, away: document.querySelector('.evx-crew').dataset.away, sx: scrollX, vv: window.visualViewport ? [visualViewport.offsetLeft, visualViewport.offsetTop, visualViewport.scale] : null }; }))}`);
  await page.screenshot({ path: `${out}/${name}-before-crew.png` });
  tr = await record(page, async () => {
    await (await page.$('.evx-crew-btn')).tap();
    await until(page, () => window.__acm.teams.snapshot().state === 'portalIdle', null, 12000);
  }, 300);
  cut = cuts(tr, { label: `${name} crew` });
  check(!cut && tr.at(-1).v.split > 0.99, `${name}: Visit the Crew — the matrix opens, unbroken`, cut);
  await page.screenshot({ path: `${out}/${name}-portal.png` });
  await page.close();
}

// ─── Reduced motion ──────────────────────────────────────────────────────────
async function reduced() {
  const name = 'reduced';
  const page = await boot(name, 1280, 800, { reduced: true });
  await page.evaluate(() => window.__acm.jump(window.__acm.events.hubRest));
  await sleep(1600);
  const c = await bayCentre(page, 1);
  await page.mouse.click(c.x, c.y);
  await sleep(1400);
  let s = await snap(page);
  check(s.selected === 1 && s.visiting && s.view.room > 0.99, `${name}: Visit — to the room's framed still at once (behind a fade, no flight)`, s);
  await page.keyboard.press('n');
  await sleep(1400);
  s = await snap(page);
  check(s.view.unfold > 0.99, `${name}: N — the record's still`, s.view);
  const all = await page.evaluate(() => [...document.querySelectorAll('.evx-sheet [data-reveal]')].every((e) => getComputedStyle(e).opacity === '1'));
  check(all, `${name}: the whole record there at once`);
  await page.screenshot({ path: `${out}/${name}-record.png` });
  for (let k = 0; k < 4; k++) { await page.keyboard.press('n'); await sleep(900); }
  s = await snap(page);
  check(s.visiting && s.target <= (await page.evaluate(() => window.__acm.events.wall)) + 1e-6, `${name}: N stops at the choice (never on to another event)`, s);
  await page.keyboard.press('Escape');
  await sleep(1400);
  s = await snap(page);
  check(!s.visiting && s.view.hub > 0.99, `${name}: Esc — the whole matrix`, s);
  await page.close();
}

// ─── Again and again: resources ──────────────────────────────────────────────
async function cycles() {
  const name = 'cycles';
  const page = await boot(name, 1280, 800);
  await toHub(page);
  const m0 = await page.evaluate(() => ({ ...window.__acm.memory(), dom: document.getElementsByTagName('*').length }));
  for (let n = 0; n < 10; n++) {
    await visitByClick(page, n % 9);
    await backByEsc(page);
  }
  const m1 = await page.evaluate(() => ({ ...window.__acm.memory(), dom: document.getElementsByTagName('*').length }));
  check(m1.geometries <= m0.geometries + 4 && m1.textures <= m0.textures + 4 && m1.programs <= m0.programs, `${name}: ten visits and returns — GPU resources steady`, { m0, m1 });
  check(Math.abs(m1.dom - m0.dom) < 60, `${name}: …and the page's own elements`, { d0: m0.dom, d1: m1.dom });
  // Events → the Crew → the loop, twice.
  for (let n = 0; n < 2; n++) {
    await toHub(page);
    await page.click('.evx-crew-btn');
    await until(page, () => window.__acm.teams.snapshot().state === 'portalIdle', null, 12000);
    await page.evaluate(() => window.__acm.teams.enter());
    await until(page, () => window.__acm.teams.snapshot().state === 'teamsActive', null, 15000);
    await page.evaluate(() => window.__acm.jump(1));
    await sleep(3500);
    const w = await page.evaluate(() => ({ p: window.__acm.progress.value, inside: window.__acm.teams.snapshot().inside, e: window.__acm.events.snapshot() }));
    check(!w.inside && w.p < 0.1 && !w.e.visiting && w.e.selected === -1, `${name}: Events → Crew → the loop (${n + 1}) leaves nothing behind`, w);
  }
  const m2 = await page.evaluate(() => ({ ...window.__acm.memory(), dom: document.getElementsByTagName('*').length }));
  notes.push(`memory: start ${JSON.stringify(m0)} · after visits ${JSON.stringify(m1)} · after two loops ${JSON.stringify(m2)}`);
  check(m2.geometries <= m0.geometries + 10 && m2.textures <= m0.textures + 6, `${name}: two whole loops — GPU resources steady`, { m0, m2 });
  await page.close();
}

try {
  if (sections.has('desktop')) await desktop();
  if (sections.has('rooms')) await rooms();
  if (sections.has('scroll')) await scroll();
  if (sections.has('phone')) await phone('phone', 390, 844);
  if (sections.has('landscape')) await phone('landscape', 844, 390);
  if (sections.has('reduced')) await reduced();
  if (sections.has('cycles')) await cycles();
} catch (e) {
  failures.push(`threw: ${e.stack ?? e}`);
} finally {
  await browser.close();
}
if (hitches.length) notes.push(`hitches (frames over 50 ms): ${hitches.length} — ${hitches.slice(0, 10).join('; ')}`);
writeFileSync(`${out}/results.json`, JSON.stringify({ passes: passes.length, failures, errors, notes, passed: passes }, null, 2));
console.log(`${passes.length} passed, ${failures.length} failed, ${errors.length} browser errors`);
for (const f of failures) console.log('FAIL', f);
for (const e of errors) console.log('ERROR', e);
for (const n of notes) console.log('NOTE', n);
process.exitCode = failures.length || errors.length ? 1 : 0;
