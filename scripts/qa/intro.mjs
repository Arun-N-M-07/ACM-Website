// Visual / interaction QA for the opening, driven like a visitor in headless
// Chrome with the GPU. The opening is scrubbed by the page's scroll, so steps
// move the scroll (or read where it has put everything).
//
//   node scripts/qa/intro.mjs <url> <out-dir> "<steps>"
//
// Steps (comma-separated):
//   enter / enter:quiet  cross the threshold (with sound if the score exists / without)
//   at:<beat>            cut the scroll to that beat of the opening
//   scroll:<beat>:<s>    scroll smoothly to that beat over s seconds
//   room:<i>:<visit>     cut to event room i, `visit` (0..1) through its installation
//   settle               wait until the camera has caught up with the scroll (and a cut's fade has cleared)
//   wheel:<dy>           one wheel event at the centre (px; + = forward)
//   wheels:<dy>:<n>:<ms> n wheel events, ms apart
//   swipe:<dy>           touch swipe (needs MOBILE=1; + = forward)
//   key:<Key>            press a key
//   shot:<name>          screenshot
//   burst:<name>:<n>:<ms> n screenshots, ms apart
//   state[:<label>]      log the opening's snapshot (beat, progress, chapter…)
//   fstart / fstop:<label>  frame timing between the two
//   wait:<ms>
//   resize:<w>:<h>
//   reduced:<0|1>        reduced motion off / on
//   eval:<js>            evaluate in the page (no commas)
// Env: W, H, MOBILE=1, DPR.
import puppeteer from 'puppeteer-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const [, , url = 'http://localhost:3100', out = '/tmp/acm-intro', steps = 'enter,shot:start'] = process.argv;
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
const MOBILE = !!process.env.MOBILE;
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', `--window-size=${W},${H}`],
  defaultViewport: { width: W, height: H, deviceScaleFactor: Number(process.env.DPR ?? 1), isMobile: MOBILE, hasTouch: MOBILE },
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => ['error', 'warn'].includes(m.type()) && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('response', (r) => r.status() >= 400 && logs.push(`[${r.status()}] ${r.url()}`));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cdp = await page.createCDPSession();

const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('.loader[data-state="ready"]', { timeout: 180000 });
logs.push(`[ready] ${Date.now() - t0}ms`);
await sleep(600);

const snap = () => page.evaluate(() => window.__acm.intro.snapshot());
let frameProbe = false;

for (const step of steps.split(',').map((s) => s.trim()).filter(Boolean)) {
  const [op, ...a] = step.split(':');
  const ts = Date.now();
  try {
    if (op === 'enter') {
      const sel = a[0] === 'quiet' ? '.loader-enter button[aria-label="Enter silently"]' : '.loader-enter .threshold-enter';
      await page.click(sel);
    } else if (op === 'at') await page.evaluate((t) => window.__acm.intro.at(t), Number(a[0]));
    else if (op === 'scroll') await page.evaluate((t, sec) => window.__acm.intro.scroll(t, sec), Number(a[0]), Number(a[1] ?? 2));
    else if (op === 'room') await page.evaluate((r, v) => window.__acm.jump(window.__acm.roomProgress(r, v)), Number(a[0]), Number(a[1] ?? 0.6));
    else if (op === 'settle') {
      const end = Date.now() + 30000;
      await sleep(200);
      while (Date.now() < end && (await page.evaluate(() => Math.abs(window.__acm.progress.target - window.__acm.progress.value))) > 2e-5) await sleep(60);
      // (A jump cuts behind a short fade from black: let it clear.)
      await sleep(700);
    } else if (op === 'wheel') {
      await page.mouse.move(W / 2, H / 2);
      await page.mouse.wheel({ deltaY: Number(a[0]) });
    } else if (op === 'wheels') {
      await page.mouse.move(W / 2, H / 2);
      for (let i = 0; i < Number(a[1]); i++) {
        await page.mouse.wheel({ deltaY: Number(a[0]) });
        await sleep(Number(a[2]));
      }
    } else if (op === 'swipe') {
      const dy = Number(a[0]);
      const x = W / 2;
      const y0 = dy > 0 ? H * 0.75 : H * 0.25;
      const n = 10;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
      for (let i = 1; i <= n; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - (dy * i) / n }] });
        await sleep(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else if (op === 'key') await page.keyboard.press(a[0]);
    else if (op === 'shot') await page.screenshot({ path: `${out}/${a[0]}.png` });
    else if (op === 'burst') {
      for (let i = 0; i < Number(a[1]); i++) {
        await page.screenshot({ path: `${out}/${a[0]}-${String(i).padStart(2, '0')}.png` });
        await sleep(Number(a[2]));
      }
    } else if (op === 'state') logs.push(`[state] ${a[0] ?? ''} ${JSON.stringify(await snap())}`);
    else if (op === 'fstart') {
      frameProbe = true;
      await page.evaluate(() => {
        window.__frames = [];
        let last = performance.now();
        const tick = (now) => {
          window.__frames.push(now - last);
          last = now;
          if (window.__framesOn) requestAnimationFrame(tick);
        };
        window.__framesOn = true;
        requestAnimationFrame(tick);
      });
    } else if (op === 'fstop') {
      const f = await page.evaluate(() => {
        window.__framesOn = false;
        const d = window.__frames.slice(2).sort((x, y) => x - y);
        const avg = d.reduce((s, x) => s + x, 0) / Math.max(1, d.length);
        return { n: d.length, avgMs: +avg.toFixed(1), p95: +(d[Math.floor(d.length * 0.95)] ?? 0).toFixed(1), max: +(d[d.length - 1] ?? 0).toFixed(1), over33: d.filter((x) => x > 33.4).length, over50: d.filter((x) => x > 50).length };
      });
      logs.push(`[frames] ${a[0] ?? ''} ${JSON.stringify(f)}`);
    } else if (op === 'wait') await sleep(Number(a[0]));
    else if (op === 'resize') await page.setViewport({ width: Number(a[0]), height: Number(a[1]), deviceScaleFactor: Number(process.env.DPR ?? 1), isMobile: MOBILE, hasTouch: MOBILE });
    else if (op === 'reduced') await page.evaluate((v) => window.__acm.store.getState().set({ reducedMotion: v === '1' }), a[0]);
    else if (op === 'eval') logs.push(`[eval] ${JSON.stringify(await page.evaluate(a.join(':')))}`);
    else if (op === 'evalfile') logs.push(`[eval] ${JSON.stringify(await page.evaluate(readFileSync(a.join(':'), 'utf8')))}`);
    else logs.push(`[warn] unknown step ${step}`);
  } catch (e) {
    logs.push(`[error] ${step}: ${e.message}`);
  }
  logs.push(`${String(Date.now() - ts).padStart(6)}ms ${step}`);
}
void frameProbe;
writeFileSync(`${out}/log.txt`, logs.join('\n'));
console.log(logs.join('\n'));
await browser.close();
