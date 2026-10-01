// Regressions missed by the old hub-only QA: doorway geometry, lens changes and real click/tap entry.
// node scripts/qa/events-visual.mjs BASE OUT [baseline|all]
import { mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const [, , base = 'http://localhost:3303', out = '/tmp/acm-events-visual', mode = 'all'] = process.argv;
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [], failures = [], passed = [], data = [];
const wait = (n) => new Promise((r) => setTimeout(r, n));
const check = (ok, label, detail) => (ok ? passed : failures).push(ok ? label : `${label}: ${JSON.stringify(detail)}`);
async function snap(p) { return p.evaluate(() => ({ ...window.__acm.events.snapshot(), c: window.__acm.teams.camera(), intro: window.__acm.intro.snapshot(), y: scrollY })); }
async function settled(p) {
  let last = await snap(p), n = 0;
  for (let k = 0; k < 32; k++) {
    await wait(200); const s = await snap(p);
    n = s.y === last.y ? n + 1 : 0; last = s;
    if (n >= 3) break;
  }
  return last;
}
async function geometry(p) {
  return p.evaluate(() => {
    const scene = window.__acm.scene, hall = scene.getObjectByName('events-hall'), lobby = scene.getObjectByName('intro-lobby');
    // Exact convex triangle intersection area, not AABB overlap (adjacent triangles share edges).
    function clip(poly, tri) {
      const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const sign = Math.sign(cross(...tri));
      for (let i = 0; i < 3; i++) {
        const a = tri[i], b = tri[(i + 1) % 3], next = [];
        for (let j = 0; j < poly.length; j++) {
          const s = poly[j], e = poly[(j + 1) % poly.length], ds = sign * cross(a, b, s), de = sign * cross(a, b, e);
          if (ds >= -1e-7) next.push(s);
          if ((ds >= 0) !== (de >= 0)) { const t = ds / (ds - de); next.push([s[0] + (e[0] - s[0]) * t, s[1] + (e[1] - s[1]) * t]); }
        }
        poly = next;
      }
      return Math.abs(poly.reduce((s, a, i) => { const b = poly[(i + 1) % poly.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
    }
    function triangles(mesh, axis) {
      const g = mesh.geometry, pos = g.attributes.position, normal = g.attributes.normal, out = [];
      const axes = [0, 1, 2].filter((x) => x !== axis);
      for (let i = 0; i < pos.count; i += 3) {
        if (Math.abs(normal.array[i * 3 + axis]) < 0.999) continue;
        const v = [i, i + 1, i + 2].map((j) => mesh.position.clone().set(pos.getX(j), pos.getY(j), pos.getZ(j)).applyMatrix4(mesh.matrixWorld).toArray());
        out.push({ plane: v[0][axis], tri: v.map((a) => axes.map((k) => a[k])) });
      }
      return out;
    }
    function area(a, b, axis) {
      const aa = triangles(a, axis), bb = triangles(b, axis); let sum = 0;
      for (const x of aa) for (const y of bb) if (Math.abs(x.plane - y.plane) < 1e-4) sum += clip(x.tri, y.tri);
      return sum;
    }
    return { floor: area(hall.children[0], lobby.children[0], 1), jamb: area(hall.children[1], lobby.children[1], 0) };
  });
}
async function run(w, h, touch) {
  const p = await browser.newPage(), name = `${w}x${h}`;
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch });
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`${base}/?debug`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.loader[data-state="ready"]', { timeout: 240000 });
  await p.click('[aria-label="Enter silently"]'); await wait(1000);
  const overlap = await geometry(p); data.push({ name, overlap });
  if (mode !== 'baseline') check(overlap.floor < 1e-5 && overlap.jamb < 1e-5, `${name}: no coplanar lobby/Events floor or jamb overlap`, overlap);
  const samples = [];
  for (const t of [-0.75, -0.45, -0.08, 0, 0.1, 0.35, 0.65, 1]) {
    await p.evaluate((t) => { const a = window.__acm; a.jump(a.events.at('arrival', t)); }, t);
    await wait(1000); const s = await snap(p); samples.push(s);
    await p.screenshot({ path: `${out}/${name}-arrival-${t}.png` });
  }
  data.push({ name, samples });
  if (mode !== 'baseline') {
    const f = samples.filter((s) => !s.intro.active).map((s) => s.c.fov);
    check(Math.max(...f) - Math.min(...f) < 0.01, `${name}: approach uses one lens, not a shelf zoom`, f);
  }
  if (mode === 'baseline') { await p.close(); return; }
  // Native wheel crosses the doorway seam in both directions, not just debug-cutting to the hub.
  await p.evaluate(() => {
    const a = window.__acm; a.jump(a.events.at('arrival', -0.08));
    window.__seamTrace = []; window.__seamOn = true;
    const frame = () => { if (!window.__seamOn) return; const a = window.__acm; window.__seamTrace.push({ t: performance.now(), ...a.events.snapshot(), c: a.teams.camera() }); requestAnimationFrame(frame); }; requestAnimationFrame(frame);
  }); await wait(900);
  const before = await snap(p);
  for (let k = 0; k < 6; k++) { await p.mouse.wheel({ deltaY: 50 }); await wait(100); }
  const after = await settled(p);
  check(after.value > before.value && Math.abs(after.value - after.target) < 1e-7, `${name}: wheel follows actual approach scroll`);
  for (let k = 0; k < 6; k++) { await p.mouse.wheel({ deltaY: -50 }); await wait(100); }
  const back = await settled(p);
  const seam = await p.evaluate(() => { window.__seamOn = false; return window.__seamTrace; });
  writeFileSync(`${out}/${name}-seam.json`, JSON.stringify(seam, null, 2));
  check(Math.abs(before.value - back.value) < 1e-5, `${name}: approach reverses to the same scroll position`);
  // A fast fling must use the same lens and input gain through the doorway.
  await p.evaluate(() => window.__acm.jump(window.__acm.events.at('arrival', -0.08))); await wait(900);
  const fastStart = await snap(p);
  for (let k = 0; k < 4; k++) { await p.mouse.wheel({ deltaY: 120 }); await wait(20); }
  const fastEnd = await settled(p);
  check(Math.abs(fastEnd.y - fastStart.y - 480) < 2 && Math.abs(fastEnd.value - fastEnd.target) < 1e-7, `${name}: fast doorway input keeps 1:1 gain and one progress owner`, { fastStart, fastEnd });
  await wait(700); const fastHold = await snap(p);
  check(fastHold.y === fastEnd.y && fastHold.c.z === fastEnd.c.z, `${name}: fast doorway input settles without autonomous shelf travel`);
  for (let k = 0; k < 4; k++) { await p.mouse.wheel({ deltaY: -120 }); await wait(20); }
  const fastBack = await settled(p);
  // A debug fixture keeps fractional progress when its rounded native pixel is already current.
  // Actual wheel input is read from integer CSS pixels: reversal must restore THAT exact pixel.
  check(fastBack.y === fastStart.y, `${name}: fast doorway input is reversible`, { start: fastStart.y, back: fastBack.y });
  // The user's screenshot was before arrival, not at the hub. Those visible
  // rooms must be actionable once the existing gate has fully retracted.
  await p.evaluate(() => window.__acm.intro.at(197.5)); await wait(1000);
  const early = await p.evaluate(() => { const b = window.__acm.events.bay(4); return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }; });
  if (touch) await p.touchscreen.tap(early.x, early.y); else await p.mouse.click(early.x, early.y);
  await settled(p);
  const earlyEntered = await snap(p);
  check(earlyEntered.selected === 4 && earlyEntered.view.room > 0.99, `${name}: visible doorway room accepts selection and enters the correct room`, earlyEntered);
  await p.keyboard.press('Escape'); await settled(p);
  for (let i = 0; i < 9; i++) {
    await p.evaluate(() => window.__acm.jump(window.__acm.events.hubRest)); await wait(800);
    const b = await p.evaluate((i) => { const b = window.__acm.events.bay(i); return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }; }, i);
    if (touch) await p.touchscreen.tap(b.x, b.y); else await p.mouse.click(b.x, b.y);
    // No debug scroll after selecting: the actual UI must take the user into the chosen room.
    await wait(350);
    const moving = await snap(p);
    check(moving.selected === i && moving.view.enter > 0, `${name}: one ${touch ? 'tap' : 'click'} begins room ${i + 1} entry`, moving.view);
    if (i === 0) {
      if (touch) {
        const cdp = await p.createCDPSession();
        let y = h * 0.4;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: w / 2, y, id: 1 }] });
        for (let n = 0; n < 6; n++) { y += 15; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: w / 2, y, id: 1 }] }); await wait(30); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
      } else await p.mouse.wheel({ deltaY: -90 });
      const stopped = await settled(p);
      await wait(700); const held = await snap(p);
      check(stopped.y === held.y && stopped.view.enter === held.view.enter, `${name}: reverse input interrupts click entry; no resumed flight`, { stopped, held });
      await p.evaluate(() => window.__acm.scroll(window.__acm.events.at('room', 0.65), 1));
    }
    await settled(p);
    const inside = await snap(p);
    check(inside.selected === i && inside.view.enter === 1 && inside.view.room > 0.5, `${name}: selected room ${i + 1} reached by the UI`, inside.view);
    check(Math.abs(inside.c.fov - samples.at(-1).c.fov) < 0.01, `${name}: room ${i + 1} shares the approach lens`);
    if (i === 0 || i === 6 || i === 8) await p.screenshot({ path: `${out}/${name}-room-${i + 1}.png` });
    await p.keyboard.press('Escape'); await settled(p); await wait(300);
    const returned = await snap(p);
    check(!returned.visiting && returned.view.hub > 0.99, `${name}: room ${i + 1} returns to the matrix`, returned.view);
  }
  await p.close();
}
try { await run(1440, 900, false); await run(390, 844, true); } catch (e) { failures.push(e.stack ?? String(e)); }
finally { await browser.close(); }
writeFileSync(`${out}/results.json`, JSON.stringify({ passed, failures, errors, data }, null, 2));
console.log(`${passed.length} passed; ${failures.length} failed; ${errors.length} browser errors`);
for (const f of failures) console.log('FAIL', f);
process.exitCode = failures.length || errors.length ? 1 : 0;
