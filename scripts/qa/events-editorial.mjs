// Editorial-only QA. Debug jumps set fixtures; real wheel/swipe input tests
// ownership, reversal and settling. No test clocks are added to the application.
import { mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const [, , base = 'http://localhost:3304', out = '/tmp/acm-events-editorial-qa'] = process.argv;
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const passed = [], failures = [], errors = [], observations = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, label, detail) => (ok ? passed : failures).push(ok ? label : `${label}: ${JSON.stringify(detail)}`);
const titles = ['C.O.D.E', 'Tech Talks', 'MasterClass', 'Head Start', 'PatternX', 'CodeX', 'Prodigy', 'Open Source Mentorship Program', 'CodHer'];

async function boot(w, h, touch = false, reduced = false) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 });
  if (reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/audio/')) errors.push(`${r.status()} ${r.url()}`); });
  await p.goto(`${base}/?debug`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.loader[data-state="ready"]', { timeout: 240000 });
  await p.click('[aria-label="Enter silently"]');
  await wait(900);
  return p;
}
async function snap(p) {
  return p.evaluate(() => {
    const a = window.__acm, s = a.events.snapshot();
    const sheet = document.querySelector('.evx-sheet'), title = sheet.querySelector('.evx-title');
    const rect = (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
    const font = getComputedStyle(title);
    const all = [...sheet.querySelectorAll('h2,h3,p,dt,dd,a,button,li')];
    return {
      ...s, y: scrollY, sheet: rect(sheet), title: rect(title), text: title.textContent,
      label: rect(sheet.querySelector('.evx-meta')), height: a.events.record.height, screen: a.events.record.screen,
      camera: a.teams.camera(), bay: a.events.bay(4), fade: a.fx.fade,
      canvas: rect(document.querySelector('canvas')), overflow: document.documentElement.scrollWidth > innerWidth,
      localOverflow: all.filter((e) => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1 || e.scrollWidth > e.clientWidth + 2; }).map((e) => e.className),
      font: { family: font.fontFamily, weight: font.fontWeight, size: parseFloat(font.fontSize), line: parseFloat(font.lineHeight), spacing: parseFloat(font.letterSpacing), color: font.color },
      globalFont: getComputedStyle(document.querySelector('.topbar') ?? document.body).fontFamily,
      parts: [...sheet.querySelectorAll('.evx-split')].map((e) => ({ h: e.offsetHeight, margin: parseFloat(getComputedStyle(e).marginTop) })),
    };
  });
}
async function fixture(p, i, screens = 0) {
  await p.evaluate((i) => { const a = window.__acm; a.jump(a.events.hubRest); }, i);
  await wait(220);
  await p.evaluate((i) => { const a = window.__acm; a.events.room(i); a.jump(a.events.at('room', 1)); }, i);
  await wait(400);
  await p.evaluate((screens) => { const a = window.__acm; a.jump(a.events.track.unfold.start + screens * a.events.record.screen / a.events.span); }, screens);
  await wait(400);
}
async function stop(p, label) {
  let last = await snap(p), stable = 0;
  for (let k = 0; k < 35; k++) {
    await wait(150); const now = await snap(p);
    stable = now.y === last.y && now.view.page === last.view.page ? stable + 1 : 0;
    last = now;
    if (stable >= 3) break;
  }
  const a = await snap(p); await wait(500); const b = await snap(p);
  check(a.y === b.y && a.view.page === b.view.page && a.bay.y0 === b.bay.y0 && a.value === a.target, `${label}: stopped navigation and both layers stay exactly still`, { a, b });
  return b;
}
async function layouts() {
  const p = await boot(1440, 900);
  for (const [w, h] of [[1440, 900], [1920, 1080], [1024, 768], [768, 1024], [390, 844], [320, 640], [844, 390]]) {
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 }); await wait(500);
    for (let i = 0; i < titles.length; i++) {
      await fixture(p, i, 1);
      await p.evaluate(() => document.fonts.ready);
      const s = await snap(p), label = `${w}x${h} ${titles[i]}`;
      check(s.text === titles[i] && !s.overflow && !s.localOverflow.length, `${label}: complete title/content fit without horizontal overflow`, s.localOverflow);
      check(s.label.y - s.sheet.y >= 15 && s.label.y - s.sheet.y < 18 && s.title.y - s.sheet.y < 85, `${label}: label and title start immediately at the sheet edge`, { label: s.label, title: s.title, sheet: s.sheet });
      check(s.font.family.includes('Geist') && s.font.weight === '600' && Math.abs(s.font.line / s.font.size - 0.9) < 0.005 && Math.abs(s.font.spacing / s.font.size + 0.04) < 0.002, `${label}: scoped editorial font/weight/leading/tracking`, s.font);
      check(s.font.color === 'rgb(196, 196, 196)' && s.globalFont.includes('Geist'), `${label}: neutral editorial type; shared Geist typography`, { local: s.font.color, global: s.globalFont });
      check(s.parts.every((x) => x.margin <= 57), `${label}: sections use compact content rhythm, not viewport spacers`, s.parts);
      if ([0, 6, 7].includes(i) && [1440, 390, 320].includes(w)) await p.screenshot({ path: `${out}/${w}x${h}-${i + 1}-editorial.png` });
    }
  }
  await p.close();
}
async function layers(w, h, touch = false) {
  const p = await boot(w, h, touch), name = `${w}x${h}`;
  for (const i of [0, 6, 7]) {
    await fixture(p, i, 0); const first = await snap(p);
    for (const t of [0.25, 0.5, 0.75, 1, 0.5, 0]) {
      await p.evaluate((t) => { const a = window.__acm; a.jump(a.events.track.unfold.start + t * a.events.record.screen / a.events.span); }, t);
      await wait(450); const s = await stop(p, `${name} ${titles[i]} overlap ${t}`);
      const foreground = first.sheet.y - s.sheet.y, background = first.bay.y0 - s.bay.y0;
      check(Math.abs(foreground - first.screen * t) < 2, `${name} ${titles[i]} ${t}: foreground follows actual scroll px-for-px`, foreground);
      check(Math.abs(background - s.canvas.h * t * 0.14) < 1, `${name} ${titles[i]} ${t}: deep room moves only 14%, forward and reverse`, background);
      check(s.camera.x === first.camera.x && s.camera.y === first.camera.y && s.camera.z === first.camera.z && s.camera.fov === first.camera.fov && s.fade === 0, `${name} ${titles[i]} ${t}: unchanged room/lens, no hard fade`, { camera: s.camera, fade: s.fade });
      observations.push({ name, i, t, foreground, background, font: s.font });
      if (t === 0.5) await p.screenshot({ path: `${out}/${name}-${i + 1}-overlap.png` });
    }
  }
  // Real input: slow progression, stop, reverse and fast forward.
  await fixture(p, 6, 0); await p.mouse.move(w / 2, h / 2);
  const first = await snap(p);
  for (let k = 0; k < 6; k++) { await p.mouse.wheel({ deltaY: 35 }); await wait(80); }
  const slow = await stop(p, `${name} slow wheel`);
  check(Math.abs(slow.y - first.y - 210) < 3 && slow.view.page > first.view.page, `${name}: slow wheel has no hidden gain`, { first: first.y, slow: slow.y });
  for (let k = 0; k < 6; k++) { await p.mouse.wheel({ deltaY: -35 }); await wait(80); }
  const reverse = await stop(p, `${name} reverse wheel`);
  check(Math.abs(reverse.sheet.y - first.sheet.y) < 2 && Math.abs(reverse.bay.y0 - first.bay.y0) < 1, `${name}: reverse input reconstructs the same overlap`, { first: first.sheet, reverse: reverse.sheet });
  for (let k = 0; k < 3; k++) { await p.mouse.wheel({ deltaY: 300 }); await wait(20); }
  await stop(p, `${name} fast wheel`);
  if (touch) {
    await fixture(p, 6, 0.5);
    const cdp = await p.createCDPSession();
    for (const delta of [160, -160]) {
      const before = await snap(p); let y = h * (delta > 0 ? 0.65 : 0.35);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: w / 2, y, id: 1 }] });
      for (let k = 0; k < 10; k++) { y -= delta / 10; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: w / 2, y, id: 1 }] }); await wait(25); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const after = await stop(p, `${name} swipe ${delta}`);
      check(delta > 0 ? after.view.page > before.view.page : after.view.page < before.view.page, `${name}: real touch scrubs/reverses foreground`, { before: before.view.page, after: after.view.page });
    }
    await cdp.detach();
  }
  await fixture(p, 7, 0.5); const old = await snap(p);
  await p.setViewport({ width: h, height: w, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 }); await wait(1000);
  const rotated = await snap(p);
  check(Math.abs(rotated.target - old.target) < 2e-5 && !rotated.overflow && !rotated.localOverflow.length, `${name}: orientation preserves navigation and layout`, { old: old.target, new: rotated.target, overflow: rotated.localOverflow });
  await p.setViewport({ width: w, height: h, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 }); await wait(1000);
  await p.keyboard.press('Escape');
  // Back travels the editorial at a fixed reading pace, then the room at its own
  // fixed pace. Its total duration is deliberately no longer always 2.4 seconds.
  await p.waitForFunction(() => !window.__acm.events.snapshot().visiting, { timeout: 16000 });
  check(!(await snap(p)).visiting, `${name}: return from editorial still reaches matrix`);
  await p.close();
}
async function reduced() {
  const p = await boot(390, 844, true, true);
  await fixture(p, 6, 1);
  const before = await snap(p);
  const all = await p.evaluate(() => [...document.querySelectorAll('.evx-sheet [data-reveal]')].every((e) => getComputedStyle(e).opacity === '1'));
  check(all && before.label.y > 76 && !before.localOverflow.length, 'Reduced motion: complete still editorial, readable below chrome without flight/reveal transforms', before);
  await p.mouse.move(200, 600); await p.mouse.wheel({ deltaY: 550 }); await wait(700);
  const after = await snap(p);
  const inner = await p.evaluate(() => document.querySelector('.evx-record').scrollTop);
  check(inner > 0 && after.target === before.target, 'Reduced motion: native record scrolling does not consume global navigation', { inner, before: before.target, after: after.target });
  await p.screenshot({ path: `${out}/reduced-motion-editorial.png` });
  await p.keyboard.press('Escape'); await wait(1600);
  check(!(await snap(p)).visiting, 'Reduced motion: Escape returns to matrix');
  await p.close();
}
try { await layouts(); await layers(1440, 900); await layers(390, 844, true); await reduced(); }
catch (e) { failures.push(e.stack ?? String(e)); }
finally { await browser.close(); }
writeFileSync(`${out}/results.json`, JSON.stringify({ passed, failures, errors, observations }, null, 2));
console.log(`${passed.length} passed; ${failures.length} failed; ${errors.length} browser errors`);
for (const e of failures) console.log('FAIL', e);
for (const e of errors) console.log('ERROR', e);
process.exitCode = failures.length || errors.length ? 1 : 0;
