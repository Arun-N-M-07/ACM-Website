// Actual pointer/touch selection from projected room geometry, plus the five requested fixes.
// node scripts/qa/current-view-entry.mjs http://localhost:3351 /tmp/acm-current-view
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const [, , base = 'http://localhost:3351', out = '/tmp/acm-current-view'] = process.argv;
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const results = [], errors = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const snap = (page) => page.evaluate(() => ({ ...window.__acm.events.snapshot(), camera: window.__acm.teams.camera(), y: scrollY }));

try {
  for (const [width, height, touch] of [[1440, 900, false], [390, 844, true], [844, 390, true]]) {
    const page = await browser.newPage();
    const device = `${width}x${height}`;
    await page.setViewport({ width, height, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push(`${device}: ${e.message}`));
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/audio/')) errors.push(`${r.status()} ${r.url()}`); });
    await page.goto(`${base}/?debug`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.loader[data-state="ready"]', { timeout: 240000 });
    await page.click('[aria-label="Enter silently"]');
    await wait(600);
    const fixture = async (part, t) => {
      await page.evaluate(({ part, t }) => window.__acm.jump(window.__acm.events.at(part, t), 0, { fade: false }), { part, t });
      await wait(500);
    };
    // All nine real apertures are actionable at early, middle, late, and return viewpoints.
    const views = [['arrival', -0.15], ['arrival', 0.6], ['hub', 0.5], ['rejoin', 0.7]];
    for (const [part, t] of views) {
      await fixture(part, t);
      for (let i = 0; i < 9; i++) {
        const target = await page.evaluate((i) => {
          const b = document.querySelectorAll('.evx-bay')[i], r = b.getBoundingClientRect();
          const x = r.x + r.width / 2, y = r.y + r.height / 2;
          return { x, y, hit: document.elementFromPoint(x, y) === b, clip: getComputedStyle(b).clipPath, live: document.querySelector('.evx-hub').dataset.live };
        }, i);
        assert.equal(target.live, 'true', `${device} ${part}: matrix is live`);
        assert.equal(target.hit, true, `${device} ${part}: room ${i + 1} matches its visible geometry`);
        assert.ok(target.clip.startsWith('polygon('));
        if (!touch) {
          await page.mouse.move(target.x, target.y); await wait(60);
          assert.equal((await snap(page)).hover, i, `${device} ${part}: hover identifies room ${i + 1}`);
        }
      }
    }
    await page.mouse.move(2, 2); await wait(120);
    if (!touch) assert.equal((await snap(page)).hover, -1, 'Leaving the wall clears hover');

    const pacing = await page.evaluate(() => {
      const a = window.__acm;
      // Compare authored scroll distances, independent of ScrollTrigger's last visible viewport.
      const span = 180 / (a.events.track.arrival.end - a.events.track.arrival.start);
      const vh = (from, to) => (a.intro.progressAt(to) - a.intro.progressAt(from)) * span;
      return { prologue: vh(-44, -28), story: vh(4, 19), reveal: vh(84, 103), ascent: vh(120, 155.5), descent: vh(155.5, 201), arrival: (a.events.track.arrival.end - a.events.track.arrival.start) * span };
    });
    for (const [key, expected] of Object.entries({ prologue: 150.4, story: 141, reveal: 190, ascent: 355, descent: 455, arrival: 180 })) {
      assert.ok(Math.abs(pacing[key] - expected) < 0.1, `${device}: localized ${key} distance ${pacing[key]}`);
    }
    const logo = await page.$eval('.wordmark-logo', (img) => ({ loaded: img.complete && img.naturalWidth > 0, width: img.getBoundingClientRect().width, label: img.closest('button').getAttribute('aria-label') }));
    assert.ok(logo.loaded && logo.width <= 108 && logo.label.includes('ACM-CEG'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    // Each actual room is clicked; its origin rotates through the four tested viewpoints.
    for (let i = 0; i < 9; i++) {
      const [part, t] = views[i % views.length];
      await fixture(part, t);
      const point = await page.$eval(`.evx-bays li:nth-child(${i + 1}) button`, (b) => { const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      if (!touch) { await page.mouse.move(point.x, point.y); await wait(350); await page.mouse.down(); }
      const before = await snap(page);
      await page.evaluate(() => {
        window.entryFrames = [];
        window.entryUnsubscribe = window.__acm.progress.subscribe(() => window.entryFrames.push({ ...window.__acm.events.snapshot(), camera: window.__acm.teams.camera() }));
      });
      if (touch) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.up();
      await page.waitForFunction(() => { const s = window.__acm.events.snapshot(); return s.visiting && s.view.enter === 1 && s.view.room === 1; }, { timeout: 8000 });
      await wait(150);
      const arrived = await snap(page); await wait(450); const held = await snap(page);
      const frames = await page.evaluate(() => { window.entryUnsubscribe(); return window.entryFrames; });
      assert.equal(arrived.selected, i, `${device}: room ${i + 1} selected`);
      // The late wall joins at the same terminal pose, so its source progress changes at arrival.
      const source = frames.find((f) => f.entry)?.entry;
      assert.ok(source && distance(before.camera, source.pose) < 0.035, `${device}: room ${i + 1} captures the rendered origin`);
      assert.ok(frames.every((f) => f.view.unfold < 0.003), `${device}: no selection enters editorial`);
      assert.ok(frames.filter((f) => f.view.enter > 0 && f.view.enter < 1).length > 20, 'Entry has a continuous path');
      const pathLength = distance(source.pose, arrived.camera);
      for (let n = 1; n < frames.length; n++) assert.ok(distance(frames[n - 1].camera, frames[n].camera) < Math.max(1, pathLength * 0.2), `${device}: no camera snap in room ${i + 1}`);
      assert.deepEqual(arrived.camera, held.camera, `${device}: room ${i + 1} has no post-entry movement/FOV change`);
      assert.ok(held.view.play > arrived.view.play, `${device}: room ${i + 1} animation continues independently: ${JSON.stringify({ arrived: arrived.view, held: held.view, entry: held.entry, progress: held.progress })}`);

      if (i === 0) {
        // Camera pose is constant throughout the formerly separate extra-zoom interval.
        // A captured selection's approach spans that interval: test the terminal canonical shot
        // separately after clearing the captured entry, as a deep link uses it.
        await page.evaluate(() => window.__acm.events.room(0, 1));
        const fixed = [];
        for (const t of [0, 0.5, 1, 0.5, 0]) {
          await page.evaluate((t) => window.__acm.jump(window.__acm.events.at('room', t), 0, { fade: false }), t);
          await wait(180); fixed.push((await snap(page)).camera);
        }
        assert.ok(fixed.every((c) => JSON.stringify(c) === JSON.stringify(fixed[0])), 'Room interval holds one stable camera in both directions');
      }
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !window.__acm.events.snapshot().visiting, { timeout: 10000 });
      await wait(150);
      const returned = await snap(page);
      assert.ok(returned.view.hub > 0.99, `Room ${i + 1} reverse returns to the matrix: ${JSON.stringify(returned)}`);
      results.push(`${device}: room ${i + 1} from ${part} ${t}, continuous entry / stable arrival / playback / return`);
    }
    // Resize an entered room without moving its physical geometry or adding a camera owner.
    await fixture('hub', 0.3); await page.evaluate(() => window.__acm.events.visit(4)); await wait(3500);
    const transforms = await page.evaluate(() => window.__acm.scene.getObjectByName('events-matrix').matrixWorld.toArray());
    await page.setViewport({ width: height, height: width, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 }); await wait(650);
    assert.deepEqual(await page.evaluate(() => window.__acm.scene.getObjectByName('events-matrix').matrixWorld.toArray()), transforms);
    assert.equal((await snap(page)).selected, 4);
    assert.equal(await page.evaluate(() => document.querySelectorAll('.experience-canvas canvas').length), 1);
    await page.setViewport({ width, height, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 });
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !window.__acm.events.snapshot().visiting, { timeout: 10000 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await fixture('hub', 0.3); await page.click('.evx-bay'); await wait(700);
    assert.equal((await snap(page)).selected, 0); assert.equal((await snap(page)).view.enter, 1);
    await page.keyboard.press('Escape'); await wait(700);
    assert.equal((await snap(page)).visiting, false);
    await page.click('.wordmark'); await page.waitForSelector('.index');
    assert.equal(await page.$('.index a[href="/archive"]'), null, 'Redundant printed-edition link is removed');
    await page.click('.index-more button');
    await page.waitForFunction(() => document.documentElement.dataset.archive === 'open');
    assert.ok((await page.$eval('#archive .chapter-title', h => h.textContent)).includes('ACM'));
    await page.screenshot({ path: `${out}/${device}-text-version.png` });
    results.push(`${device}: logo, local scroll pacing, resize/orientation, reduced motion, Text Version retained without redundant link`);
    await page.close();
  }
  assert.deepEqual(errors, [], 'No runtime errors or failed asset/route requests');
} finally {
  await browser.close();
  writeFileSync(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify({ passed: results.length, errors, results }, null, 2));
}
