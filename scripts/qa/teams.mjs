// Interaction QA for the portal and the Teams world, driven like a visitor
// (real pointer / touch / wheel input) in headless Chrome with the GPU.
//
//   node scripts/qa/teams.mjs <url> <out-dir> "<steps>"
//
// Steps (comma-separated):
//   portal[:f]           jump to stand before the portal (f = fraction of the portal segment, default .9)
//   at:<c>               place the camera inside the world at orbit coordinate c (no travel)
//   pose:<i>:<focus>     hold the entry into card i at focus 0..1 (the path, frame by frame)
//   trace:<l>:<ms>:<n>   sample orbit, scroll and camera every ms, n times (writes <l>.json)
//   p:<progress>         jump to raw progress
//   hold:<ms>            press the portal (pointer on its button), hold ms, release
//   touchhold:<ms>       the same with a touch (needs MOBILE=1)
//   down / up            press / release the portal without timing
//   wheel:<dy>           one wheel event at the centre
//   wheels:<dy>:<n>:<ms> n wheel events, ms apart
//   move:<x>:<y>         move the mouse (fractions of the viewport, 0..1)
//   click:<x>:<y>        click at fractions of the viewport
//   mdown:<x>:<y> / mup  press the mouse there and hold it / release it
//   tdown:<x>:<y> / tup  a finger down there and held / lifted (MOBILE=1)
//   sweep:<x0>:<y0>:<x1>:<y1>:<ms>  move the mouse across in real time
//   tap:<x>:<y>          touch tap at fractions of the viewport (MOBILE=1)
//   swipe:<dy>           touch swipe (px, + = content moves up / scroll down)
//   card:<i>             click the centre of card i on screen
//   key:<Key>            press a key (kdown:/kup: to hold one)
//   shot:<name>          screenshot
//   burst:<name>:<n>:<ms> n screenshots, ms apart
//   state[:<label>]      log the Teams snapshot
//   fstart / fstop:<label>  record frame times between the two
//   wait:<ms>
//   resize:<w>:<h>       change the viewport
//   eval:<js>            evaluate in the page (log the result; no commas)
//   evalfile:<path>      evaluate a file's contents in the page
// Env: W, H, MOBILE=1, DPR.
import puppeteer from 'puppeteer-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const [, , url = 'http://localhost:3100', out = '/tmp/acm-teams', steps = 'portal,shot:portal'] = process.argv;
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
const MOBILE = !!process.env.MOBILE;
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', `--window-size=${W},${H}`],
  defaultViewport: { width: W, height: H, deviceScaleFactor: Number(process.env.DPR ?? 1), isMobile: MOBILE, hasTouch: MOBILE },
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => ['error', 'warn'].includes(m.type()) && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cdp = await page.createCDPSession();

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('.loader[data-state="ready"]', { timeout: 180000 });
await sleep(800);
await page.click('.loader-enter button[aria-label="Enter silently"]');
await sleep(1800);
// The opening film owns the camera while it runs; the Teams steps below place
// the journey directly, so end the film first (no-op when it isn't playing).
await page.evaluate(() => {
  const intro = window.__acm?.intro;
  if (intro?.snapshot?.().active) intro.skip?.();
});
// The film's handoff pins the scroll position for 1.5 s (placeScroll); let it expire.
await sleep(1800);

let vw = W;
let vh = H;
const snap = async (label = '') => {
  const s = await page.evaluate(() => window.__acm.teams.snapshot());
  logs.push(`[state]${label ? ' ' + label : ''} ${JSON.stringify(s)}`);
  return s;
};
const portalCentre = async () =>
  page.evaluate(() => {
    const b = document.querySelector('.portal-target');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
const touch = (type, x, y) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });

const t0 = Date.now();
for (const step of steps.split(',').filter(Boolean)) {
  const [op, ...a] = step.split(':');
  try {
    if (op === 'portal') {
      const f = a[0] ? Number(a[0]) : 0.9;
      await page.evaluate((f) => { const g = window.__acm.segments.portal; window.__acm.jump(g.start + (g.end - g.start) * f); }, f);
      await sleep(3200);
    } else if (op === 'at') {
      await page.evaluate((c) => window.__acm.teams.at(c), Number(a[0]));
      await sleep(Number(process.env.SETTLE ?? 2400));
    } else if (op === 'pose') {
      // pose:<card>:<focus> — hold the entry into a card at a point on its path.
      await page.evaluate((i, f) => window.__acm.teams.pose(i, f), Number(a[0]), Number(a[1]));
      await sleep(Number(process.env.POSE_SETTLE ?? 500));
    } else if (op === 'p') {
      await page.evaluate((p) => window.__acm.jump(p), Number(a[0]));
      await sleep(2800);
    } else if (op === 'hold' || op === 'down') {
      const c = await portalCentre();
      if (!c) { logs.push(`[warn] no portal target for ${step}`); continue; }
      await page.mouse.move(c.x, c.y);
      await page.mouse.down();
      if (op === 'hold') { await sleep(Number(a[0])); await page.mouse.up(); }
    } else if (op === 'up') {
      await page.mouse.up();
    } else if (op === 'touchhold') {
      const c = await portalCentre();
      if (!c) { logs.push(`[warn] no portal target for ${step}`); continue; }
      await touch('touchStart', c.x, c.y);
      await sleep(Number(a[0]));
      await touch('touchEnd', c.x, c.y);
    } else if (op === 'wheel') {
      await page.mouse.move(vw / 2, vh / 2);
      await page.mouse.wheel({ deltaY: Number(a[0]) });
    } else if (op === 'wheels') {
      await page.mouse.move(vw / 2, vh / 2);
      for (let i = 0; i < Number(a[1]); i++) { await page.mouse.wheel({ deltaY: Number(a[0]) }); await sleep(Number(a[2])); }
    } else if (op === 'move') {
      await page.mouse.move(Number(a[0]) * vw, Number(a[1]) * vh, { steps: 10 });
    } else if (op === 'mdown') {
      // mdown:<x>:<y> — move there and press the mouse (held until mup).
      await page.mouse.move(Number(a[0]) * vw, Number(a[1]) * vh, { steps: 4 });
      await page.mouse.down();
    } else if (op === 'mup') {
      await page.mouse.up();
    } else if (op === 'sweep') {
      // sweep:<x0>:<y0>:<x1>:<y1>:<ms> — move the mouse across in real time.
      const [x0, y0, x1, y1, ms] = a.map(Number);
      const n = Math.max(2, Math.round(ms / 16));
      for (let k = 0; k <= n; k++) {
        await page.mouse.move((x0 + ((x1 - x0) * k) / n) * vw, (y0 + ((y1 - y0) * k) / n) * vh);
        await sleep(ms / n);
      }
    } else if (op === 'click') {
      await page.mouse.click(Number(a[0]) * vw, Number(a[1]) * vh);
    } else if (op === 'tap') {
      const x = Number(a[0]) * vw;
      const y = Number(a[1]) * vh;
      await touch('touchStart', x, y);
      await sleep(60);
      await touch('touchEnd', x, y);
    } else if (op === 'tdown') {
      // tdown:<x>:<y> — a finger down there (held until tup).
      await touch('touchStart', Number(a[0]) * vw, Number(a[1]) * vh);
    } else if (op === 'tup') {
      await touch('touchEnd', 0, 0);
    } else if (op === 'swipe') {
      const dy = Number(a[0]);
      const x = vw / 2;
      const y0 = vh * 0.7;
      await touch('touchStart', x, y0);
      for (let i = 1; i <= 12; i++) { await touch('touchMove', x, y0 - (dy * i) / 12); await sleep(16); }
      await touch('touchEnd', x, y0 - dy);
    } else if (op === 'card') {
      const pt = await page.evaluate((i) => window.__acm.teams.cardScreen(i), Number(a[0]));
      if (!pt) { logs.push(`[warn] card ${a[0]} not on screen`); continue; }
      await page.mouse.move(pt.x, pt.y, { steps: 8 });
      await sleep(250);
      await page.mouse.click(pt.x, pt.y);
    } else if (op === 'key') {
      await page.keyboard.press(a[0]);
    } else if (op === 'kdown') {
      await page.keyboard.down(a[0]);
    } else if (op === 'kup') {
      await page.keyboard.up(a[0]);
    } else if (op === 'shot') {
      await page.screenshot({ path: `${out}/${a[0]}.png` });
    } else if (op === 'burst') {
      for (let i = 0; i < Number(a[1]); i++) {
        await page.screenshot({ path: `${out}/${a[0]}-${String(i).padStart(2, '0')}.png` });
        await sleep(Number(a[2]));
      }
    } else if (op === 'state') {
      await snap(a[0]);
    } else if (op === 'trace') {
      // trace:<label>:<everyMs>:<n> — sample the orbit, scroll and camera on
      // the page's own clock (for settle time, overshoot, reversal lag).
      const [label = 'trace', every = '50', n = '40'] = a;
      const rows = await page.evaluate(async (every, n) => {
        const out = [];
        const t0 = performance.now();
        for (let i = 0; i < n; i++) {
          const s = window.__acm.teams.snapshot();
          const p = window.__acm.progress;
          out.push({ t: Math.round(performance.now() - t0), c: s.c, cVel: s.cVel, pt: +p.target.toFixed(5), pv: +p.value.toFixed(5), focus: s.focus, cam: window.__acm.teams.camera?.() });
          await new Promise((r) => setTimeout(r, every));
        }
        return out;
      }, Number(every), Number(n));
      writeFileSync(`${out}/${label}.json`, JSON.stringify(rows));
      const settle = rows.findIndex((r, i) => i > 0 && rows.slice(i).every((q) => Math.abs(q.c - rows[rows.length - 1].c) < 0.002));
      logs.push(`[trace] ${label} n=${rows.length} c ${rows[0].c}→${rows[rows.length - 1].c} settled≈${settle >= 0 ? rows[settle].t : '—'}ms`);
    } else if (op === 'fstart') {
      await page.evaluate(() => {
        window.__ft = [];
        let last = performance.now();
        window.__ftOn = true;
        const tick = (t) => {
          if (!window.__ftOn) return;
          window.__ft.push(t - last);
          last = t;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    } else if (op === 'fstop') {
      const st = await page.evaluate(() => {
        window.__ftOn = false;
        const f = window.__ft.slice(2).sort((x, y) => x - y);
        const avg = f.reduce((a, b) => a + b, 0) / f.length;
        return { n: f.length, avgMs: +avg.toFixed(1), p95: +f[Math.floor(f.length * 0.95)].toFixed(1), max: +f[f.length - 1].toFixed(1), over33: f.filter((x) => x > 33.4).length, over50: f.filter((x) => x > 50).length };
      });
      logs.push(`[frames] ${a[0] ?? ''} ${JSON.stringify(st)}`);
    } else if (op === 'wait') {
      await sleep(Number(a[0]));
    } else if (op === 'resize') {
      vw = Number(a[0]);
      vh = Number(a[1]);
      await page.setViewport({ width: vw, height: vh, deviceScaleFactor: Number(process.env.DPR ?? 1), isMobile: MOBILE, hasTouch: MOBILE });
      await sleep(1200);
    } else if (op === 'eval') {
      const r = await page.evaluate(a.join(':'));
      logs.push(`[eval] ${JSON.stringify(r)}`);
    } else if (op === 'evalfile') {
      const r = await page.evaluate(readFileSync(a.join(':'), 'utf8'));
      logs.push(`[eval] ${JSON.stringify(r)}`);
    } else logs.push(`[warn] unknown step ${step}`);
  } catch (e) {
    logs.push(`[error] ${step}: ${e.message}`);
  }
  logs.push(`${String(Date.now() - t0).padStart(6)}ms ${step}`);
}
const mem = await page.evaluate(() => {
  const r = window.__acm.renderInfo?.();
  return r ? { calls: r.calls, triangles: r.triangles, points: r.points } : null;
});
logs.push(`[render] ${JSON.stringify(mem)}`);
writeFileSync(`${out}/log.txt`, logs.join('\n'));
console.log(logs.join('\n'));
await browser.close();
