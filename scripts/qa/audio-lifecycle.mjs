// Browser lifecycle tests for the actual audio modules, isolated from the WebGL scene.
// No extra application loops or AudioContexts: the fixture imports the current TypeScript source.
// --baseline imports HEAD instead, recording pre-optimization failures without editing files.
//   node scripts/qa/audio-lifecycle.mjs http://localhost:3303 [--baseline]
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import puppeteer from 'puppeteer-core';

const url = process.argv[2] ?? 'http://localhost:3303';
const baseline = process.argv.includes('--baseline');
const read = (path) => baseline ? execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8' }) : fs.readFileSync(path, 'utf8');
const compile = (path) => ts.transpileModule(read(path), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const fixture = compile('src/config/music.ts') + compile('src/systems/audio/music.ts').replace(/import\s+\{\s*MUSIC\s*\}\s+from[^;]+;/, '') + compile('src/systems/audio/sfx.ts').replace(/import\s+\{\s*music\s*\}\s+from[^;]+;/, '').replaceAll('process.env.NODE_ENV', '"production"') + '\nwindow.__audio = { music, setLayer, cue, portalTravel, destroyEffects: typeof destroyEffects === "function" ? destroyEffects : null };';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 390, height: 844, hasTouch: true, isMobile: true } });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.setRequestInterception(true);
page.on('request', (r) => r.isNavigationRequest() ? r.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Audio lifecycle QA</title><button id="gesture">Gesture</button>' }) : r.continue());
await page.goto(url);
await page.evaluate(() => {
  window.__counts = { contexts: 0, mediaSources: 0, sources: 0, disconnectedSources: 0 };
  const Ctx = window.AudioContext;
  window.AudioContext = class extends Ctx { constructor(...args) { super(...args); window.__counts.contexts++; } };
  const media = Ctx.prototype.createMediaElementSource;
  Ctx.prototype.createMediaElementSource = function (...args) { window.__counts.mediaSources++; return media.apply(this, args); };
  for (const method of ['createBufferSource', 'createOscillator']) {
    const create = Ctx.prototype[method];
    Ctx.prototype[method] = function (...args) {
      const node = create.apply(this, args);
      window.__counts.sources++;
      const disconnect = node.disconnect.bind(node);
      let released = false;
      node.disconnect = (...args) => { if (!released) { released = true; window.__counts.disconnectedSources++; } return disconnect(...args); };
      return node;
    };
  }
});
await page.addScriptTag({ type: 'module', content: fixture });
await page.waitForFunction(() => window.__audio);
await page.evaluate(() => { window.__stopWatch = window.__audio.music.watchPage(true); });
const results = [];
const check = (name, pass, evidence) => results.push({ name, pass, evidence });
const ev = (fn, ...args) => page.evaluate(fn, ...args);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

await ev(() => window.__audio.music.preload());
await page.waitForFunction(() => window.__audio.music.ready || window.__audio.music.failed, { timeout: 15000 });
check('Preload does not create an AudioContext', await ev(() => window.__counts.contexts === 0));
const started = await ev(async () => { await window.__audio.music.enable(); await window.__audio.music.enable(); return { counts: window.__counts, running: window.__audio.music.running }; });
check('Repeated enabling owns one context and media source', started.running && started.counts.contexts === 1 && started.counts.mediaSources === 1, started);
const race = await ev(async () => { const m = window.__audio.music; const enabling = m.enable(); m.disable(); await enabling; return { wanted: m.wantsSound, state: m.state, retry: !!m.retry }; });
check('An obsolete enable cannot restore playing state', !race.wanted && race.state === 'idle' && !race.retry, race);

const retry = await ev(async () => {
  const m = window.__audio.music;
  await m.enable();
  const resume = m.context.resume.bind(m.context);
  m.context.resume = () => Promise.reject(new Error('gesture required'));
  await m.context.suspend();
  // Context statechange is dispatched asynchronously; wait for the real browser event.
  await new Promise((resolve) => m.context.addEventListener('statechange', resolve, { once: true }));
  await Promise.resolve();
  const armed = !!m.retry;
  m.disable();
  const disarmed = !m.retry;
  m.context.resume = resume;
  return { armed, disarmed };
});
check('Sound off removes a browser-policy gesture retry', retry.armed && retry.disarmed, retry);
await page.click('#gesture');
await pause(100);
const afterGesture = await ev(() => ({ wanted: window.__audio.music.wantsSound, context: window.__audio.music.context.state }));
check('An unrelated gesture cannot wake disabled sound', !afterGesture.wanted && afterGesture.context === 'suspended', afterGesture);

const hidden = await ev(async () => {
  const m = window.__audio.music;
  await m.enable();
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  document.dispatchEvent(new Event('visibilitychange'));
  await Promise.resolve();
  const paused = m.el.paused;
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  document.dispatchEvent(new Event('visibilitychange'));
  await m.context.resume();
  await m.el.play();
  await Promise.resolve();
  return { paused, resumed: !m.el.paused, contexts: window.__counts.contexts };
});
check('Mobile hide/show pauses and resumes without another context', hidden.paused && hidden.resumed && hidden.contexts === 1, hidden);

await ev(() => { window.__audio.cue('contact'); window.__audio.cue('rollTick'); window.__audio.cue('tileLock'); });
await pause(1100);
const cues = await ev(() => ({ ...window.__counts }));
check('Completed cues disconnect their sources', cues.sources > 0 && cues.disconnectedSources === cues.sources, cues);

await ev(() => { const travel = window.__audio.portalTravel(1, 0.2, 0.5); travel.stop(); });
await pause(450);
const travel = await ev(() => ({ ...window.__counts }));
check('Interrupted portal sound releases every source', travel.disconnectedSources === travel.sources, travel);

const destroyed = await ev(async () => {
  const { music: m, setLayer, destroyEffects } = window.__audio;
  setLayer('mistAir', 0.018);
  m.duck();
  const ctx = m.context;
  const enabling = m.enable();
  window.__stopWatch();
  destroyEffects?.();
  m.destroy();
  await enabling;
  await ctx.close().catch(() => undefined);
  return { context: m.context, state: m.state, gain: !!m.gain, filter: !!m.filter, seek: !!m.pendingSeek, retry: !!m.retry, oldContext: ctx.state, counts: window.__counts };
});
check('Teardown cancels pending playback and releases owned graph', !destroyed.context && destroyed.state === 'idle' && !destroyed.gain && !destroyed.filter && !destroyed.seek && !destroyed.retry && destroyed.oldContext === 'closed', destroyed);
check('Teardown releases all cue and bed sources', destroyed.counts.disconnectedSources === destroyed.counts.sources, destroyed.counts);
const replacement = await ev(async () => {
  const { music: m, setLayer, destroyEffects } = window.__audio;
  await m.enable();
  setLayer('mistAir', 0.018);
  const ctx = m.context;
  const before = { running: m.running, contexts: window.__counts.contexts, sources: window.__counts.sources, disconnected: window.__counts.disconnectedSources };
  destroyEffects?.();
  m.destroy();
  await ctx.close().catch(() => undefined);
  return { before, after: window.__counts, oldContext: ctx.state };
});
check('Replacing a closed graph recreates only the requested context', replacement.before.running && replacement.before.contexts === 2 && replacement.oldContext === 'closed', replacement);
check('Replacement effects graph also releases every source', replacement.after.disconnectedSources === replacement.after.sources, replacement.after);
check('No browser runtime errors', errors.length === 0, errors);
console.log(JSON.stringify({ baseline, passed: results.filter((r) => r.pass).length, failed: results.filter((r) => !r.pass).length, results }, null, 2));
await browser.close();
if (!baseline && results.some((r) => !r.pass)) process.exitCode = 1;
