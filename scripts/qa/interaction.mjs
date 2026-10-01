// Regression checks for the connected journey and its accessible reading paths.
// node scripts/qa/interaction.mjs http://localhost:3101 /tmp/acm-interaction
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const [, , base = 'http://localhost:3100', out = '/tmp/acm-interaction'] = process.argv;
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const errors = [];
const results = [];
const settle = (ms = 1800) => new Promise((r) => setTimeout(r, ms));
try {
  for (const [name, width, height] of [['desktop', 1440, 960], ['phone', 390, 844]]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: name === 'phone', hasTouch: name === 'phone' });
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`${name}: ${r.status()} ${r.url()}`); });
    await page.goto(`${base}/?debug`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.loader[data-state="ready"]', { timeout: 120000 });
    await settle();
    assert.equal(await page.evaluate(() => document.querySelector('.loader').textContent.includes('public/audio')), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `${out}/${name}-entrance.png` });
    await page.click('[aria-label="Enter silently"]');
    await settle();
    await page.keyboard.press('n');
    await settle();
    assert.ok(await page.evaluate(() => window.__acm.progress.value > 0), 'N moves to the next stop');
    // The opening keeps the page's chrome out of the way; skipping it lands in the Events, where the top bar is.
    await page.click('.intro-skip');
    await settle();
    await page.click('.ctl-index');
    await page.waitForSelector('.index');
    await page.screenshot({ path: `${out}/${name}-index.png` });
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('.index button:not(:disabled), .index a[href]')];
      buttons.at(-1).focus();
    });
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.index button')), true, 'Index traps focus');
    await page.click('.index-rooms button');
    await settle(2600);
    assert.equal(await page.evaluate(() => window.__acm.store.getState().activeRoom), 0, 'The index takes you into event 01\'s room');
    // (The dossier: opened from the index, over the room.)
    await page.click('.ctl-index');
    await page.waitForSelector('.index');
    await page.click('.index-rooms .text-link');
    await page.waitForSelector('.dossier');
    const before = await page.evaluate(() => window.__acm.progress.value);
    await page.mouse.wheel({ deltaY: 800 });
    await settle(600);
    assert.ok(Math.abs(await page.evaluate(() => window.__acm.progress.value) - before) < .0001, 'Dossier freezes the journey');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.dossier', { hidden: true });

    // The light route: from the lobby across the hall to the matrix, on through its opening to the portal —
    // and back, exactly.
    const signal = async (p) => {
      await page.evaluate((p) => window.__acm.jump(p), p);
      await settle();
      return page.evaluate(() => {
        const g = window.__acm.scene.getObjectByName('connected-signal');
        return { count: g.children[1].geometry.drawRange.count, head: g.children[2].position.toArray() };
      });
    };
    const hub = await page.evaluate(() => window.__acm.events.hubRest);
    const opened = await page.evaluate(() => { const s = window.__acm.segments.portal; return s.start + (s.end - s.start) * 0.5; });
    const first = await signal(hub);
    const later = await signal(opened);
    assert.ok(later.count > first.count, 'Light route grows forward');
    const reversed = await signal(hub);
    assert.deepEqual(reversed, first, 'Light route rewinds exactly');

    // The portal: walled until held. The Teams world has no closing plate or footer: past the sixth
    // card the return runs on down the spine, and at its end the journey begins again (the loop).
    await page.evaluate(() => { const g = window.__acm.segments.portal; window.__acm.jump(g.start + (g.end - g.start) * .9); });
    await settle(3000);
    assert.equal(await page.evaluate(() => window.__acm.teams.snapshot().state), 'portalIdle');
    await page.evaluate(() => window.__acm.jump(1));
    await settle();
    assert.equal(await page.evaluate(() => window.__acm.teams.snapshot().inside), false, 'The gate holds without the portal');
    await page.evaluate(() => window.__acm.teams.at(5.9));
    await settle(3000);
    assert.equal(await page.$('.teams-outro'), null, 'No closing plate or footer at the end of the ring');
    await page.screenshot({ path: `${out}/${name}-finale.png` });
    await page.evaluate(() => window.__acm.jump(1));
    await settle(3500);
    // (Past the end's seam the scroll carries on past the start's by as much: back in the opening, at its first beats.)
    const wrapped = await page.evaluate(() => ({ p: window.__acm.progress.value, beat: window.__acm.intro.snapshot().t, chapter: window.__acm.store.getState().chapter, inside: window.__acm.teams.snapshot().inside, room: window.__acm.store.getState().activeRoom, dossier: window.__acm.store.getState().dossier }));
    assert.ok(wrapped.p < 0.05 && wrapped.beat < -40 && wrapped.chapter === 'arrival' && !wrapped.inside && wrapped.room === -1 && wrapped.dossier === null, `The journey loops back to its beginning (${JSON.stringify(wrapped)})`);
    await page.evaluate(() => { window.__acm.store.getState().set({ reducedMotion: true }); });
    await settle(2500);
    assert.equal(await page.evaluate(() => window.__acm.store.getState().reducedMotion), true);
    await page.screenshot({ path: `${out}/${name}-reduced.png` });
    await page.keyboard.press('t');
    await settle(700);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.archive), 'open');
    assert.ok(await page.$eval('#archive', (el) => el.textContent.includes('Head Start')));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    results.push(`${name}: entrance, navigation, focus, dossier, exact signal rewind, portal gate, the loop at the end, reduced motion and archive passed`);
    await page.close();
  }
  const fallback = await browser.newPage();
  await fallback.evaluateOnNewDocument(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return /webgl/i.test(kind) ? null : getContext.call(this, kind, ...args);
    };
  });
  await fallback.goto(`${base}/?debug`, { waitUntil: 'networkidle0' });
  await fallback.waitForSelector('html[data-fallback="true"]');
  assert.ok(await fallback.$eval('#archive', (el) => el.textContent.includes('ACM')));
  await fallback.setJavaScriptEnabled(false);
  await fallback.goto(`${base}/archive`, { waitUntil: 'domcontentloaded' });
  assert.ok((await fallback.$$eval('h1', (els) => els.map((el) => el.textContent).join(' '))).includes('ACM'));
  await fallback.goto(`${base}/events/head-start`, { waitUntil: 'domcontentloaded' });
  assert.ok((await fallback.$$eval('h1', (els) => els.map((el) => el.textContent).join(' '))).includes('Head Start'));
  results.push('WebGL failure, no-JavaScript archive and event page passed');
  assert.deepEqual(errors, [], 'No browser errors or failed requests');
  console.log(results.join('\n'));
  writeFileSync(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
} finally {
  await browser.close();
}
