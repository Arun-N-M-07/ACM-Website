// Frame-time probe: smooth-scroll a range of the journey and report slow frames.
//   node scripts/qa/probe.mjs <url> <fromProgress> <toProgress> <seconds>
import puppeteer from 'puppeteer-core';
const [, , url = 'http://localhost:3100', a = '0', b = '1', secs = '60'] = process.argv;
const from = Number(a);
const to = Number(b);
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,720'],
  defaultViewport: { width: 1280, height: 720 },
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errs.push(`[error] ${m.text()}`));
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.loader[data-state="ready"]', { timeout: 120000 });
await page.click('.loader-enter button[aria-label="Enter silently"]');
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate((p) => window.__acm.jump(p), from);
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => {
  window.__frames = [];
  let last = performance.now();
  const tick = (t) => {
    const s = window.__acm.store.getState();
    window.__frames.push([t - last, window.__acm.progress.value, s.segment]);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const steps = Math.round(Number(secs) * 4);
for (let i = 1; i <= steps; i++) {
  await page.evaluate((v) => window.__acm.scroll(v, 0.25), from + ((to - from) * i) / steps);
  await new Promise((r) => setTimeout(r, 250));
  if ((await page.evaluate(() => window.__acm.store.getState().phase)) === 'impact') await new Promise((r) => setTimeout(r, 2200));
}
const frames = await page.evaluate(() => window.__frames);
const dts = frames.map((f) => f[0]).sort((x, y) => x - y);
const q = (k) => dts[Math.floor(k * (dts.length - 1))].toFixed(1);
console.log(`frames=${frames.length} median=${q(0.5)}ms p95=${q(0.95)}ms p99=${q(0.99)}ms max=${dts[dts.length - 1].toFixed(0)}ms`);
console.log(frames.filter((f) => f[0] > 50).slice(0, 30).map((f) => `${f[0].toFixed(0)}ms @${f[1].toFixed(4)} ${f[2]}`).join('\n'));
console.log(errs.slice(0, 20).join('\n'));
await browser.close();
