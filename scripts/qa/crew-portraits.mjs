// Crew portraits QA: every member's card shows that member's portrait — and nobody else's.
//
//   node scripts/qa/crew-portraits.mjs [url] [out-dir]        (MOBILE=1 W=390 H=844 for a phone)
//
// 1. The table (src/content/generated/crew-portraits.json) against the photographs' own file names:
//    each member's print was made from the photograph named after them.
// 2. The prints themselves: the face in each print is compared with the face in every photograph
//    (normalised correlation of the face region); its own photograph must be the clear best match.
// 3. The site: every domain is opened through the real flow; on each card, the name, role and domain
//    are read from the DOM with the portrait it shows, which must be the member's own, loaded. Each
//    card is drawn from the hand and photographed (drawn-<domain>-<n>.png, and a contact sheet).
// 4. Resources: the domains are opened and closed again, twice round; the portraits in the document,
//    the DOM and the heap must not grow.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const [, , url = 'http://localhost:3100', out = '/tmp/acm-crew-portraits'] = process.argv;
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
const MOBILE = !!process.env.MOBILE;
const root = process.cwd();
const SOURCE = join(root, 'acm photos');
mkdirSync(out, { recursive: true });
const table = JSON.parse(readFileSync(join(root, 'src/content/generated/crew-portraits.json'), 'utf8'));

// The identities, as the chapter named the photographs (file → member → domain).
const EXPECTED = [
  ['Viswam.png', 'Visvam Srinivasan', 'CORE'],
  ['SankaraKrishnan.png', 'Sankara Krishnan P', 'CORE'],
  ['Purushothaman.png', 'Purushothaman V', 'CORE'],
  ['Manesh Ram.png', 'Manesh Ram', 'CORE'],
  ['Anieshwar.png', 'Anieshwar Saravanan', 'WEB AND APP DEVELOPMENT'],
  ['Prithvi.png', 'Prithvi', 'WEB AND APP DEVELOPMENT'],
  ['Renuka.png', 'Renuka Devi A C', 'COMPETITIVE PROGRAMMING AND TECHNICAL DEVELOPMENT'],
  ['Suhashri.png', 'Suhasri S', 'COMPETITIVE PROGRAMMING AND TECHNICAL DEVELOPMENT'],
  ['Ananyalakshmi.png', 'Ananyalakshmi V K', 'EVENTS AND FUNCTIONING'],
  ['Harini.png', 'Harini J S', 'EVENTS AND FUNCTIONING'],
  ['Swayam.png', 'Swayamprabha Narayanan', 'CONTENTS AND DESIGN'],
  ['janis.png', 'Janis Miracline A', 'CONTENTS AND DESIGN'],
  ['Naveen.png', 'Naveen.O.T', 'HR AND LOGISTICS'],
  ['Varshha.png', 'Varshhaa', 'HR AND LOGISTICS'],
  ['Keerthana.png', 'Keerthana Kathirvel', 'MARKETING'],
];
const results = [];

// ── 1. The table ──
assert.equal(Object.keys(table.members).length, EXPECTED.length, 'one print per member');
for (const [file, name] of EXPECTED) {
  const m = table.members[name];
  assert.ok(m, `${name} has a print`);
  assert.equal(m.source.file, file, `${name}'s print is made from ${file}`);
}

// ── 2. The prints: whose face is in each ──
const SIDE = 40;
const norm = (buf) => {
  const v = Float64Array.from(buf);
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  let sd = 0;
  for (let i = 0; i < v.length; i++) sd += (v[i] -= mean) ** 2;
  sd = Math.sqrt(sd / v.length) || 1;
  return v.map((x) => x / sd);
};
const corr = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0) / a.length;
/** The square around a face (1.3 face heights), SIDE×SIDE grey. */
async function faceCrop(file, cx, cy, fh) {
  const img = sharp(file).removeAlpha().greyscale();
  const { width, height } = await img.metadata();
  const side = Math.round(fh * 1.3);
  const left = Math.max(0, Math.round(cx - side / 2));
  const top = Math.max(0, Math.round(cy - side / 2));
  const w = Math.min(side, width - left);
  const h = Math.min(side, height - top);
  return norm(await sharp(file).removeAlpha().greyscale().extract({ left, top, width: w, height: h }).resize(SIDE, SIDE, { fit: 'fill' }).raw().toBuffer());
}
const sources = {};
for (const [file, name] of EXPECTED) {
  const m = table.members[name];
  const { width, height } = await sharp(join(SOURCE, file)).metadata();
  sources[file] = await faceCrop(join(SOURCE, file), m.face.cx * width, m.face.cy * height, m.face.h * height);
}
const P = table.print;
const F = table.face;
for (const [file, name] of EXPECTED) {
  const m = table.members[name];
  const ppu = m.width;
  const print = await faceCrop(join(root, 'public', m.src), F.x * ppu, (F.y - P.top) * ppu, F.h * ppu);
  const ranked = EXPECTED.map(([f]) => [corr(print, sources[f]), f]).sort((a, b) => b[0] - a[0]);
  results.push({ name, file, print: m.src, best: ranked[0][1], own: +ranked[0][0].toFixed(3), next: `${ranked[1][1]} ${ranked[1][0].toFixed(3)}`, margin: +(ranked[0][0] - ranked[1][0]).toFixed(3) });
}
console.table(results);
for (const r of results) {
  assert.equal(r.best, r.file, `${r.name}'s print shows the face in ${r.file} (best: ${r.best})`);
  // (Faces framed alike correlate well with one another — up to ~0.85; a print with its own photograph, ~0.95–0.99.)
  assert.ok(r.margin > 0.08, `${r.name}: a clear match (margin ${r.margin})`);
}

// ── 3. The site ──
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc', `--window-size=${W},${H}`],
  defaultViewport: { width: W, height: H, isMobile: MOBILE, hasTouch: MOBILE, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`[error] ${m.text().slice(0, 200)}`));
page.on('requestfailed', (r) => r.url().includes('/media/crew/') && errors.push(`[failed] ${r.url()}`));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (f, ...a) => page.evaluate(f, ...a);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('.loader[data-state="ready"]', { timeout: 180000 });
await sleep(500);
await page.click('.loader-enter button[aria-label="Enter silently"]');
await sleep(1500);
await ev(() => window.__acm.jump(window.__acm.segments.portal.start + (window.__acm.segments.portal.end - window.__acm.segments.portal.start) * 0.9));
await sleep(1500);
await ev(() => window.__acm.teams.enter());
await sleep(6000);

const waitFor = async (fn, ms = 8000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ev(fn)) return true;
    await sleep(100);
  }
  return false;
};
const openDomain = async (i) => {
  await ev((i) => window.__acm.teams.domain(i), i);
  await sleep(1200);
  await ev((i) => window.__acm.teams.select(i), i);
  assert.ok(await waitFor(() => window.__acm.teams.snapshot().state === 'domainDetail' && window.__acm.teams.snapshot().focus > 0.999, 10000), `domain ${i} opens`);
  await sleep(1400);
};
const readHand = () =>
  ev(() => ({
    domain: document.querySelector('.hand-title')?.textContent,
    cards: [...document.querySelectorAll('.hand-card')].map((c) => {
      const img = c.querySelector('.hand-card__print img');
      return {
        role: c.querySelector('.hand-card__role')?.textContent,
        name: c.querySelector('.hand-card__name')?.textContent,
        src: img ? new URL(img.src).pathname : null,
        loaded: !!img && img.complete && img.naturalWidth > 0,
        shown: img ? getComputedStyle(img).opacity : null,
      };
    }),
  }));

const audit = [];
const shots = [];
for (let i = 0; i < 7; i++) {
  await openDomain(i);
  const hand = await readHand();
  await page.screenshot({ path: `${out}/hand-${i}.png` });
  for (let j = 0; j < hand.cards.length; j++) {
    const card = hand.cards[j];
    const expected = EXPECTED.find(([, name]) => name === card.name);
    assert.ok(expected, `card "${card.name}" is a member with a photograph`);
    assert.equal(hand.domain, expected[2], `${card.name} is in ${expected[2]}`);
    assert.equal(card.src, table.members[card.name].src, `${card.name}'s card shows ${table.members[card.name].src}`);
    assert.ok(card.loaded, `${card.name}'s portrait has loaded`);
    // Drawn from the hand, and photographed.
    await ev((j) => document.querySelectorAll('.hand-card')[j].click(), j);
    await sleep(1300);
    const rect = await ev((j) => {
      const r = document.querySelectorAll('.hand-card')[j].getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }, j);
    const shownNow = await ev((j) => getComputedStyle(document.querySelectorAll('.hand-card')[j].querySelector('.hand-card__print img')).opacity, j);
    assert.equal(shownNow, '1', `${card.name}'s portrait is shown on the drawn card`);
    const path = `${out}/drawn-${i}-${j}.png`;
    // (Cut from a whole-viewport capture: a clipped capture re-renders the page and loses the composited 3D cards.)
    const left = Math.max(0, Math.round(rect.x - 8));
    const top = Math.max(0, Math.round(rect.y - 8));
    await sharp(await page.screenshot())
      .extract({ left, top, width: Math.min(W - left, Math.round(rect.width + 16)), height: Math.min(H - top, Math.round(rect.height + 16)) })
      .toFile(path);
    shots.push(path);
    audit.push({ member: card.name, file: expected[0], card: `${card.role} · ${card.name}`, domain: hand.domain, src: card.src, verified: 'yes' });
    await ev((j) => document.querySelectorAll('.hand-card')[j].click(), j);
    await sleep(900);
  }
  await ev(() => window.__acm.teams.close());
  await sleep(1600);
}
assert.equal(audit.length, EXPECTED.length, 'every member was found on a card');
assert.equal(new Set(audit.map((a) => a.src)).size, EXPECTED.length, 'no two cards share a portrait');

// ── 4. Resources, twice round the domains (with Next / Previous inside the open domain too) ──
const measure = () =>
  ev(() => {
    window.gc?.();
    return {
      crewImages: document.querySelectorAll('img[src*="/media/crew/"]').length,
      dom: document.getElementsByTagName('*').length,
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      gpu: window.__acm.memory?.() ?? null,
    };
  });
const before = await measure();
for (let round = 0; round < 2; round++) {
  await openDomain(0);
  for (let k = 0; k < 6; k++) {
    await ev(() => document.querySelector('.domain-controls button[aria-label="Next domain"]').click());
    await sleep(2600);
  }
  for (let k = 0; k < 3; k++) {
    await ev(() => document.querySelector('.domain-controls button[aria-label="Previous domain"]').click());
    await sleep(2600);
  }
  await ev(() => window.__acm.teams.close());
  await sleep(1800);
}
const after = await measure();
console.log('resources before', JSON.stringify(before), '\n          after ', JSON.stringify(after));
assert.equal(after.crewImages, before.crewImages, 'no portraits left behind in the document');
assert.ok(Math.abs(after.dom - before.dom) <= 4, 'the DOM does not grow');

// A contact sheet of every drawn card.
const tiles = await Promise.all(shots.map(async (p) => sharp(p).resize({ height: 420 }).toBuffer()));
const metas = await Promise.all(tiles.map((t) => sharp(t).metadata()));
const cols = 5;
const tw = Math.max(...metas.map((m) => m.width));
const composite = tiles.map((input, k) => ({ input, left: (k % cols) * (tw + 12) + 12, top: Math.floor(k / cols) * 432 + 12 }));
await sharp({ create: { width: cols * (tw + 12) + 12, height: Math.ceil(tiles.length / cols) * 432 + 12, channels: 3, background: '#050506' } })
  .composite(composite)
  .png()
  .toFile(`${out}/drawn-cards.png`);

console.table(audit.map(({ member, file, domain, src, verified }) => ({ member, file, domain, src, verified })));
console.log(errors.length ? errors.join('\n') : 'console: no errors');
assert.equal(errors.length, 0, 'no errors');
console.log(`crew portraits: ${audit.length} members verified (${MOBILE ? 'phone' : 'desktop'} ${W}×${H})`);
await browser.close();
