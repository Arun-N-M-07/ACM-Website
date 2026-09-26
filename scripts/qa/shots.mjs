// Visual QA: screenshot any point of the journey in headless Chrome (GPU).
//   node scripts/qa/shots.mjs <url> <out-dir> "<items>"
// Items (comma-separated):
//   0.2           raw scroll progress 0..1
//   gfacility:0.4 40% through a timeline segment (see src/config/timeline.ts)
//   r3:0.5        half-way through the visit to event room 3 (0-based)
//   x3:0.5        half-way through the walk from room 2 into room 3
//   c2.5          inside the Teams world at orbit coordinate 2.5 (0 = card 01 … 5 = card 06)
//   wait1500      pause
// Env: W, H (viewport), MOBILE=1 (touch/mobile emulation), SETTLE (ms after each jump).
// Needs: npm i -D puppeteer-core   and Google Chrome installed (path below).
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const [, , url = 'http://localhost:3100', out = '/tmp/acm-shots', list = '0,0.1,0.2'] = process.argv;
const width = Number(process.env.W ?? 1600);
const height = Number(process.env.H ?? 1000);
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', `--window-size=${width},${height}`],
  defaultViewport: { width, height, deviceScaleFactor: 1, isMobile: !!process.env.MOBILE, hasTouch: !!process.env.MOBILE },
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => ['error', 'warn'].includes(m.type()) && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('response', (r) => r.status() >= 400 && logs.push(`[${r.status()}] ${r.url()}`));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('.loader[data-state="ready"]', { timeout: 120000 });
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: `${out}/entrance.png` });
await page.click('.loader-enter button[aria-label="Enter silently"]');
await new Promise((r) => setTimeout(r, 2000));

const jump = (p) => page.evaluate((v) => window.__acm.jump(v), p);
for (const item of list.split(',')) {
  if (item.startsWith('wait')) {
    await new Promise((r) => setTimeout(r, Number(item.slice(4)) || 1000));
    continue;
  }
  let p;
  const [head, arg] = item.slice(1).split(':');
  if (item[0] === 'g') p = await page.evaluate((s, f) => { const g = window.__acm.segments[s]; return g.start + (g.end - g.start) * f; }, head, Number(arg));
  else if (item[0] === 'r') p = await page.evaluate((i, d) => window.__acm.roomProgress(i, d), Number(head), Number(arg));
  else if (item[0] === 'x') p = await page.evaluate((i, f) => { const r = window.__acm.roomProgress; const a = r(i - 1, 1); return a + (r(i, 0) - a) * f; }, Number(head), Number(arg));
  else if (item[0] === 'c') p = null;
  else p = Number(item);
  if (p === null) await page.evaluate((c) => window.__acm.teams.at(c), Number(item.slice(1)));
  else await jump(p);
  await new Promise((r) => setTimeout(r, Number(process.env.SETTLE ?? 2800)));
  const info = await page.evaluate(() => {
    const s = window.__acm.store.getState();
    return { phase: s.phase, segment: s.segment, room: s.activeRoom, teams: window.__acm.teams.snapshot().state, p: window.__acm.progress.value.toFixed(4) };
  });
  const name = `${out}/${item.replace(/[^a-z0-9.]+/gi, '_')}.png`;
  await page.screenshot({ path: name });
  logs.push(`[shot] ${item} ${JSON.stringify(info)}`);
}
writeFileSync(`${out}/log.txt`, logs.join('\n'));
console.log(logs.join('\n'));
await browser.close();
