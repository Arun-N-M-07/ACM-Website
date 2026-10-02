// Regression: real originals, responsive faculty, and one continuous portal walk.
// Images only: node scripts/qa/explore-portal.mjs BASE OUT [PREVIOUS_BUILD] images
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const [, , base = 'http://localhost:3350', out = '/tmp/acm-explore-portal-qa', baseline, mode = 'all'] = process.argv;
mkdirSync(out, { recursive: true });
const photoNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16];
const faculty = [
  ['ranjani.jpeg', 'RP_Mam.jpg', 'Dr. Ranjani Parthasarathi'],
  ['bama.png', 'BAMA_MAM.png', 'Dr. Bama Srinivasan'],
  ['Arockia Xavier.png', 'ANNIE_MAM.png', 'Dr. R Arockia Xavier Annie'],
];
const passed = [], errors = [], observations = [], limitations = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
assert.deepEqual(readdirSync('gallery').sort(), photoNumbers.map((i) => `${i}.jpg`).sort());
for (const n of photoNumbers) assert.equal(hash(`gallery/${n}.jpg`), hash(`public/media/explore/gallery/${n}.jpg`));
for (const [source, dest] of faculty) {
  try { assert.equal(hash(`Faculty heads/${source}`), hash(`public/media/team/Faculty/${dest}`)); }
  catch (error) {
    if (error.code !== 'EPERM') throw error;
    limitations.push(`macOS denied re-reading ${source} for checksum comparison; its installed copy is tested below`);
  }
}
passed.push(`Original asset checksums match (${18 - limitations.length} readable source files)`);

const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const snap = (p) => p.evaluate(() => {
  const a = window.__acm, s = a.segments.portal;
  return { ...a.events.snapshot(), y: scrollY, span: a.events.span, u: (a.progress.value - s.start) / (s.end - s.start), camera: a.teams.camera(), columns: [-1, 0, 1].map((i) => a.scene.getObjectByName(`matrix-column-${i}`).position.toArray()) };
});
async function enter(p, url) {
  await p.goto(`${url}/?debug`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.loader[data-state="ready"]', { timeout: 240000 });
  await p.click('[aria-label="Enter silently"]'); await wait(500);
}
async function jump(p, u) {
  await p.evaluate((u) => { const a = window.__acm, s = a.segments.portal; a.jump(s.start + (s.end - s.start) * u, 0, { fade: false }); }, u);
  await wait(350);
}
try {
  const views = mode === 'images'
    ? [[1440, 900, false], [768, 1024, true], [390, 844, true], [320, 568, true], [844, 390, true]]
    : [[1440, 900, false], [390, 844, true], [844, 390, true]];
  for (const [width, height, touch] of views) {
    const p = await browser.newPage(), label = `${width}x${height}`;
    await p.setViewport({ width, height, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 });
    p.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
    p.on('response', (r) => { if (r.status() >= 400) errors.push(`${label}: ${r.status()} ${r.url()}`); });
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`${label}: ${m.text()}`); });
    let previousContent;
    if (baseline) {
      await p.goto(`${baseline}/archive`, { waitUntil: 'domcontentloaded' });
      await p.evaluate(() => document.fonts.ready);
      previousContent = await p.evaluate(() => ({
        gallery: Array.from(document.querySelectorAll('.gallery figure')).filter((f) => f.querySelector('img')).map((f) => ({ src: new URL(f.querySelector('img').src).searchParams.get('url'), caption: f.querySelector('figcaption').textContent, alt: f.querySelector('img').alt })),
        faculty: Array.from(document.querySelectorAll('.faculty li')).map((li) => ({ name: li.querySelector('strong').textContent, role: li.querySelector('.role').textContent, bio: li.querySelector('p')?.textContent ?? null, family: getComputedStyle(li.querySelector('strong')).fontFamily })),
        crewNameSize: getComputedStyle(document.querySelector('.domain strong')).fontSize,
      }));
    }
    const response = await p.goto(`${base}/archive`, { waitUntil: 'domcontentloaded' });
    assert.ok([200, 304].includes(response.status()), 'Archive loads or is served from its valid cache');
    await p.evaluate(() => document.fonts.ready);
    // Exercise actual lazy loading for every supplied slot, not just its src attribute.
    for (const selector of ['.gallery img', '.faculty img']) {
      for (const el of await p.$$(selector)) {
        await el.scrollIntoView();
        await p.waitForFunction((img) => img.complete && img.naturalWidth > 0, { timeout: 30000 }, el);
      }
    }
    const photos = await p.evaluate(() => {
      const photo = (el) => {
        const r = el.getBoundingClientRect(), css = getComputedStyle(el);
        return { src: el instanceof HTMLImageElement ? new URL(el.currentSrc).searchParams.get('url') : null, request: el instanceof HTMLImageElement ? new URL(el.currentSrc).searchParams.get('w') : null, width: r.width, height: r.height, fit: css.objectFit, alt: el.getAttribute('alt') };
      };
      return { gallery: Array.from(document.querySelectorAll('.gallery figure')).map((f) => ({ ...photo(f.firstElementChild), caption: f.querySelector('figcaption').textContent })), placeholders: document.querySelectorAll('.gallery .photo-slot').length, faculty: Array.from(document.querySelectorAll('.faculty li')).map((li) => ({ ...photo(li.firstElementChild), name: li.querySelector('strong').textContent, nameSize: parseFloat(getComputedStyle(li.querySelector('strong')).fontSize), family: getComputedStyle(li.querySelector('strong')).fontFamily, role: li.querySelector('.role').textContent, roleSize: getComputedStyle(li.querySelector('.role')).fontSize, bio: li.querySelector('p')?.textContent ?? null, bioSize: li.querySelector('p') && getComputedStyle(li.querySelector('p')).fontSize })), overflow: document.documentElement.scrollWidth > innerWidth, crewNameSize: getComputedStyle(document.querySelector('.domain strong')).fontSize };
    });
    assert.equal(photos.gallery.length, 15);
    assert.equal(photos.placeholders, 0);
    assert.equal(new Set(photos.gallery.filter((g) => g.src).map((g) => g.src)).size, 15);
    for (const [i, n] of photoNumbers.entries()) {
      const g = photos.gallery[i];
      assert.equal(g.src, `/media/explore/gallery/${n}.jpg`);
      assert.ok(Math.abs(g.width / g.height - 4 / 3) < 0.001);
      assert.equal(g.fit, 'cover');
      assert.ok(+g.request <= (touch ? 640 : 750), 'Responsive photo, not the full 6000px source');
    }
    assert.equal(photos.faculty.length, 3);
    for (const [i, [, filename, name]] of faculty.entries()) {
      const f = photos.faculty[i];
      assert.equal(f.src, `/media/team/Faculty/${filename}`);
      assert.equal(f.name, name); assert.equal(f.alt, name);
      assert.ok(f.width >= 96 && f.width <= 180 && f.height >= 96, 'Larger, bounded responsive portraits');
      assert.ok(Math.abs(f.width / f.height - (i === 0 ? 336 / 393 : 1)) < 0.001, 'Original image ratio; no face crop/distortion');
      assert.ok(f.nameSize >= 22 && f.nameSize <= 36, 'Faculty name is a prominent heading');
      assert.equal(f.roleSize, '10px');
      if (f.bio) assert.equal(f.bioSize, '14px');
      assert.equal(f.fit, 'cover');
    }
    if (previousContent) {
      assert.deepEqual(photos.gallery.map(({ src, caption, alt }) => ({ src, caption, alt })), previousContent.gallery, 'Retained photo order, captions, categories and alt text');
      assert.deepEqual(photos.faculty.map(({ name, role, bio, family }) => ({ name, role, bio, family })), previousContent.faculty, 'Faculty order/content/font family preserved');
      assert.equal(photos.crewNameSize, previousContent.crewNameSize, 'Faculty font changes do not affect student names');
    }
    assert.equal(photos.overflow, false);
    await p.$eval('.gallery', (e) => e.scrollIntoView()); await wait(100);
    await p.screenshot({ path: `${out}/${label}-gallery.png` });
    await p.$eval('.faculty', (e) => e.scrollIntoView()); await wait(100);
    await p.screenshot({ path: `${out}/${label}-faculty.png` });
    observations.push({ label, faculty: photos.faculty.map(({ name, width, height, nameSize }) => ({ name, width, height, nameSize })) });
    passed.push(`${label}: exactly 15 loaded photos, zero placeholders/duplicates, retained metadata/grid, larger native-ratio faculty portraits/names, no overflow`);

    if (mode === 'images') {
      await enter(p, base);
      await p.keyboard.press('t'); await p.waitForFunction(() => document.documentElement.dataset.archive === 'open');
      assert.equal(await p.$$eval('#archive .gallery figure', (items) => items.length), 15);
      assert.equal(await p.$$eval('#archive .gallery .photo-slot', (items) => items.length), 0);
      await p.$eval('#archive .faculty', (e) => e.scrollIntoView());
      await p.waitForFunction(() => Array.from(document.querySelectorAll('#archive .faculty img')).every((img) => img.complete && img.naturalWidth > 0));
      await p.screenshot({ path: `${out}/${label}-explore-faculty.png` });
      passed.push(`${label}: Explore text-version uses the same clean gallery and faculty renderer`);
      await p.close();
      continue;
    }

    // Optional existing build comparison: geometry and pose path, not screenshots or guessed offsets.
    let old;
    if (baseline) {
      await enter(p, baseline);
      old = await p.evaluate(() => {
        const a = window.__acm, s = a.segments.portal, pose = (u) => a.events.pose(s.start + (s.end - s.start) * u);
        return { poses: Array.from({ length: 1001 }, (_, i) => pose(i / 1000)), total: 180 / (a.events.track.arrival.end - a.events.track.arrival.start), segments: a.segments };
      });
    }
    await enter(p, base);
    const authored = await p.evaluate(() => {
      const a = window.__acm, s = a.segments.portal, total = 180 / (a.events.track.arrival.end - a.events.track.arrival.start);
      return { poses: Array.from({ length: 1001 }, (_, i) => a.events.pose(s.start + (s.end - s.start) * i / 1000)), total, segments: a.segments };
    });
    assert.ok(Math.abs((authored.segments.portal.end - authored.segments.portal.start) * authored.total - 197.4) < 1e-7);
    if (old) {
      for (const [id, s] of Object.entries(authored.segments)) {
        const length = (s.end - s.start) * authored.total, previous = (old.segments[id].end - old.segments[id].start) * old.total;
        assert.ok(Math.abs(length - previous * (id === 'portal' ? 0.94 : 1)) < 1e-7, `${id}: only the portal's physical scroll length changes`);
      }
      for (let i = 0; i <= 320; i++) for (const k of Object.keys(authored.poses[i])) assert.ok(Math.abs(authored.poses[i][k] - old.poses[i][k]) < 1e-9, `Opening choreography unchanged: ${i} ${k}`);
      for (let i = 350; i <= 1000; i++) {
        const next = authored.poses[i];
        // Locate the same point on the old path by its depth, then compare every other pose channel.
        let j = 0; while (j < 999 && old.poses[j + 1].z > next.z) j++;
        const a = old.poses[j], b = old.poses[j + 1], t = Math.abs(b.z - a.z) > 1e-12 ? (next.z - a.z) / (b.z - a.z) : 0;
        for (const k of Object.keys(next)) assert.ok(Math.abs(next[k] - (a[k] + (b[k] - a[k]) * t)) < 0.0001, `Same physical camera path: ${i} ${k}`);
      }
    }
    for (let i = 321; i <= 699; i++) assert.ok(authored.poses[i].z < authored.poses[i - 1].z, `No interior depth dead zone at ${i / 1000}`);
    const steps = [508, 510, 512].map((i) => authored.poses[i - 1].z - authored.poses[i + 1].z);
    assert.ok(Math.min(...steps) > 0.1 && Math.max(...steps) / Math.min(...steps) < 1.1, 'No intermediate ease-to-zero at the former approach pause');
    passed.push(`${label}: same opening/path/end pose; 6% shorter portal only; continuous intermediate velocity`);

    for (const [name, start, deltas, gap] of [
      ['slow', 0.36, [12, 12, 12, 12, 12], 100],
      ['normal', 0.39, [60, 60, 60], 70],
      ['fast', 0.36, [120, 120, 120, 120, 120], 35],
      ['reverse', 0.62, [-120, -120, -120], 35],
    ]) {
      await jump(p, start); const before = await snap(p);
      for (const deltaY of deltas) { await p.mouse.wheel({ deltaY }); await wait(gap); }
      await wait(1600); const stopped = await snap(p);
      await wait(400); const held = await snap(p);
      const input = deltas.reduce((a, b) => a + b, 0);
      // A landscape screen's shorter passage can end during the large fling. Its existing
      // terminal gate must stop it there, rather than allowing unrequested Crew entry.
      const expected = Math.min(input, (before.lockMax - before.target) * before.span);
      assert.ok(Math.abs(stopped.y - before.y - expected) <= 2, `${label} ${name}: constant physical input gain up to the existing terminal gate`);
      assert.ok(Math.abs(stopped.target - stopped.value) < 1e-9, 'No stacked camera-progress smoothing');
      assert.equal(stopped.y, held.y); assert.equal(stopped.value, held.value);
      assert.ok(Math.sign(stopped.camera.z - before.camera.z) === -Math.sign(input));
      observations.push({ label, name, input, expected, actual: stopped.y - before.y, stoppedAt: stopped.u });
    }
    for (const u of [0.25, 0.4, 0.55, 0.66]) {
      await jump(p, u); const first = await snap(p);
      await jump(p, 0.1); await jump(p, u); const reentered = await snap(p);
      assert.deepEqual(reentered.columns, first.columns);
      assert.ok(Math.abs(first.value - reentered.value) < 1e-9);
    }
    if (touch) {
      await jump(p, 0.4); const before = await snap(p);
      const cdp = await p.createCDPSession(), x = width * 0.9, y = height * 0.8;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 10 }] }); await wait(60); }
      // Pause the finger before release to isolate position control from native fling momentum.
      await wait(250); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await wait(600); const after = await snap(p);
      assert.ok(after.y > before.y && after.camera.z < before.camera.z, 'Touch moves through the same physical passage');
      await cdp.detach();
    }
    await jump(p, 0.55); const beforeResize = await snap(p);
    await p.setViewport({ width: height, height: width, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 }); await wait(800);
    const afterResize = await snap(p);
    assert.ok(Math.abs(beforeResize.value - afterResize.value) < 0.00005, 'Orientation retains normalized navigation');
    assert.deepEqual(beforeResize.columns, afterResize.columns, 'Architecture remains locked in world space on resize');
    await p.setViewport({ width, height, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 }); await wait(650);
    await jump(p, 0.55); await p.screenshot({ path: `${out}/${label}-portal.png` });
    await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await wait(1000);
    await jump(p, 0.9); await wait(650);
    const still = await snap(p); await wait(400); const held = await snap(p);
    assert.deepEqual(still.camera, held.camera, 'Reduced-motion portal is stable');
    assert.equal((await p.evaluate(() => window.__acm.teams.snapshot())).inside, false, 'No forced Crew progression');
    assert.equal(await p.evaluate(() => document.querySelectorAll('.experience-canvas canvas').length), 1);
    await p.keyboard.press('t'); await p.waitForFunction(() => document.documentElement.dataset.archive === 'open');
    assert.equal(await p.$$eval('#archive .gallery img', (imgs) => imgs.length), 15, 'Explore text version uses the same mapped photos');
    passed.push(`${label}: slow/normal/fast/stop/reverse/re-entry, resize, reduced motion, shared Explore renderer${touch ? ', native touch' : ''}`);
    await p.close();
  }
  assert.deepEqual(errors, [], 'No runtime/console errors or failed requests');
} finally {
  await browser.close();
  writeFileSync(`${out}/results.json`, JSON.stringify({ passed, errors, limitations, observations }, null, 2));
  console.log(JSON.stringify({ passed: passed.length, errors, limitations, observations }, null, 2));
}
