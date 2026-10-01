// Acceptance checks for the cloud-wordmark port, global Geist and normal Events hall scrolling.
import { mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const [, , base = 'http://localhost:3304', out = '/tmp/acm-site-refinements'] = process.argv;
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const passed = [], failures = [], errors = [], observations = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, name, detail) => (ok ? passed : failures).push(ok ? name : { name, detail });
try {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const p = await browser.newPage(), label = `${w}x${h}`;
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(`${base}/?debug`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.loader[data-state="ready"]', { timeout: 240000 });
    await p.click('[aria-label="Enter silently"]');
    await wait(1000);
    const poseAt = async (t) => {
      await p.evaluate((t) => window.__acm.intro.at(t), t); await wait(850);
      return p.evaluate(() => {
        const a = window.__acm, g = a.scene.getObjectByName('intro-acm-ceg');
        return { intro: a.intro.snapshot(), visible: g?.visible, letters: g?.children.map((m) => ({ y: m.position.y, visible: m.visible, rotation: m.rotation.toArray().slice(0, 3) })), material: g?.children[0].material.type, count: g?.children.length, overflow: document.documentElement.scrollWidth > innerWidth };
      });
    };
    const rise = await poseAt(141), whole = await poseAt(144.6), reverse = await poseAt(141);
    check(rise.visible && rise.count === 7 && rise.letters[0].visible && !rise.letters.at(-1).visible, `${label}: seven physical letters emerge sequentially`, rise);
    check(whole.letters.every((m) => m.visible && Math.abs(m.y) < 1e-5), `${label}: full wordmark settles into place`, whole);
    check(whole.material === 'ShaderMaterial' && whole.letters.every((m) => m.rotation.every((n) => n === 0)), `${label}: imported lacquer material and straight physical rise`, whole);
    check(JSON.stringify(rise.letters) === JSON.stringify(reverse.letters), `${label}: reverse scroll reconstructs the identical reveal`, { rise, reverse });
    await poseAt(150.5); await p.screenshot({ path: `${out}/${label}-wordmark.png` });
    const fonts = await p.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return { body: getComputedStyle(document.body).fontFamily, rail: getComputedStyle(document.querySelector('.rail')).fontFamily, canvas: ['--font-serif', '--font-sans', '--font-mono'].map((v) => s.getPropertyValue(v)), count: document.querySelectorAll('canvas').length };
    });
    check(fonts.body.includes('Geist') && fonts.rail.includes('Geist') && fonts.canvas.every((f) => f.includes('Geist')), `${label}: page/navigation and every canvas-text role share Geist`, fonts);
    check(fonts.count === 1, `${label}: no second rendering canvas`, fonts);
    // Normal physical scrolling from the opening door, at different input speeds.
    for (const [name, delta, n, gap] of [['slow', 30, 8, 80], ['fast', 120, 6, 20], ['reverse', -30, 8, 40]]) {
      await poseAt(name === 'reverse' ? 195 : 189.5);
      const before = await p.evaluate(() => ({ y: scrollY, p: window.__acm.events.snapshot().target }));
      for (let k = 0; k < n; k++) { await p.mouse.wheel({ deltaY: delta }); await wait(gap); }
      await wait(1600);
      const after = await p.evaluate(() => ({ y: scrollY, ...window.__acm.events.snapshot() }));
      check(Math.abs(after.y - before.y - delta * n) <= 3, `${label}: ${name} door scroll has constant input gain`, { before, after, input: delta * n });
      observations.push({ label, name, input: delta * n, actual: after.y - before.y });
    }
    await p.evaluate(() => window.__acm.jump(window.__acm.events.at('arrival', 0.25))); await wait(600);
    const early = await p.evaluate(() => scrollY); await p.mouse.wheel({ deltaY: 120 }); await wait(100);
    const response = await p.evaluate(() => scrollY);
    check(response - early > 0 && response - early < 120, `${label}: physical hall retains normal input smoothing, not raw camera steps`, { early, response });
    await wait(1600);
    const a = await p.evaluate(() => ({ ...window.__acm.events.snapshot(), c: window.__acm.teams.camera() })); await wait(500);
    const b = await p.evaluate(() => ({ ...window.__acm.events.snapshot(), c: window.__acm.teams.camera() }));
    check(a.target === b.target && Math.abs(a.value - b.value) < 1e-7, `${label}: settled hall navigation does not advance itself`, { a, b });
    const range = await p.evaluate(() => { const a = window.__acm; return (a.events.track.arrival.end - a.events.track.arrival.start) * a.events.span / innerHeight; });
    check(range > 1.75 && range < 1.85, `${label}: doorway-to-shelf travel is spread across 1.8 viewports`, range);
    await p.screenshot({ path: `${out}/${label}-hall.png` });
    await p.close();
  }
  const page = await browser.newPage();
  await page.goto(`${base}/archive`, { waitUntil: 'networkidle0' });
  check((await page.evaluate(() => getComputedStyle(document.body).fontFamily)).includes('Geist'), 'Archive shares global Geist');
  await page.goto(`${base}/events/prodigy`, { waitUntil: 'networkidle0' });
  check((await page.evaluate(() => getComputedStyle(document.body).fontFamily)).includes('Geist'), 'Static event page shares global Geist');
} catch (e) { failures.push(e.stack ?? String(e)); }
finally { await browser.close(); }
writeFileSync(`${out}/results.json`, JSON.stringify({ passed, failures, errors, observations }, null, 2));
console.log(JSON.stringify({ passed: passed.length, failures, errors, observations }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
