// Audio QA (dev server — it taps the effects bus, window.__sfxBus, dev builds only): enters with
// sound and runs the film's sections — the stone's storms, the rise into and out of the cloud, the
// ACM-CEG hold and the descent, the shaft to the Events, standing in the Events, the Prodigy wall
// (forward, then back), the portal (in, out, abandoned) — reporting for each the cues that played,
// the effects' level (median / max dBFS), the layers still sounding, and tonal peaks in the
// average spectrum (narrow bins ≥ 18 dB over their neighbourhood: a hum or a buzz would show here).
// It measures; it doesn't listen — do that too.
//
//   node scripts/qa/audio.mjs [url]
import puppeteer from 'puppeteer-core';
const url = process.argv[2] ?? 'http://localhost:3100';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--autoplay-policy=no-user-gesture-required', '--window-size=1440,900'], defaultViewport: { width: 1440, height: 900 } });
const page = await b.newPage();
const logs = [];
page.on('console', (m) => ['error', 'warn'].includes(m.type()) && logs.push(`[${m.type()}] ${m.text().slice(0, 160)}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('.loader[data-state="ready"]', { timeout: 180000 });
await sleep(500);
await page.evaluate(() => { window.__sfxLog = []; window.__sfxLayers = {}; });
await page.click('.loader-enter .threshold-enter');
await sleep(1500);
const ev = (f, ...a) => page.evaluate(f, ...a);
// Start a meter on the SFX bus: RMS per 100 ms, and at the end of a window, the spectrum's tonal peaks.
const setupMeter = () => ev(() => {
  const ctx = window.__acm.music.context; const bus = window.__sfxBus;
  if (!ctx || !bus) return 'no bus';
  const an = ctx.createAnalyser(); an.fftSize = 8192; an.smoothingTimeConstant = 0; bus.connect(an);
  window.__meter = { an, rms: [], spec: null };
  const td = new Float32Array(an.fftSize);
  window.__meterId = setInterval(() => { an.getFloatTimeDomainData(td); let s = 0; for (const x of td) s += x * x; window.__meter.rms.push(Math.sqrt(s / td.length)); }, 100);
  return 'ok ' + ctx.sampleRate;
});
const window_ = async (label, fn, ms) => {
  await ev(() => { window.__sfxLog = []; window.__meter.rms = []; window.__spec = []; window.__specId = setInterval(() => { const an = window.__meter.an; const f = new Float32Array(an.frequencyBinCount); an.getFloatFrequencyData(f); window.__spec.push(f); }, 250); });
  await fn();
  await sleep(ms);
  const r = await ev(() => {
    clearInterval(window.__specId);
    const rms = window.__meter.rms; const db = (x) => (x > 0 ? 20 * Math.log10(x) : -200);
    const sorted = [...rms].sort((a, b) => a - b);
    // Average spectrum; tonal peaks = bins more than 18 dB above the median of their ±40-bin neighbourhood, persisting (avg).
    const n = window.__spec.length; let peaks = [];
    if (n) {
      const L = window.__spec[0].length; const avg = new Float32Array(L);
      for (const f of window.__spec) for (let i = 0; i < L; i++) avg[i] += f[i] / n;
      const sr = window.__acm.music.context.sampleRate; const hz = (i) => (i * sr) / (2 * L);
      for (let i = 40; i < L - 40; i++) {
        if (avg[i] < -90) continue;
        const nb = []; for (let k = -40; k <= 40; k++) if (Math.abs(k) > 3) nb.push(avg[i + k]);
        nb.sort((a, b) => a - b); const med = nb[nb.length >> 1];
        if (avg[i] - med > 18 && avg[i] >= avg[i - 1] && avg[i] >= avg[i + 1]) peaks.push(`${hz(i).toFixed(0)}Hz ${avg[i].toFixed(0)}dB(+${(avg[i] - med).toFixed(0)})`);
      }
    }
    return { cues: window.__sfxLog.map((x) => x.split('@')[0]), rmsMedDb: +db(sorted[sorted.length >> 1] ?? 0).toFixed(1), rmsMaxDb: +db(sorted[sorted.length - 1] ?? 0).toFixed(1), layers: Object.fromEntries(Object.entries(window.__sfxLayers).filter(([, v]) => v > 0.0005).map(([k, v]) => [k, +v.toFixed(4)])), tonalPeaks: peaks.slice(0, 8), t: window.__acm.intro.snapshot().t };
  });
  const cues = r.cues.reduce((acc, c) => { const last = acc[acc.length - 1]; if (last && last[0] === c) last[1]++; else acc.push([c, 1]); return acc; }, []).map(([c, k]) => (k > 1 ? `${c}x${k}` : c)).join(' ');
  console.log(`\n== ${label}  (beat ${r.t})  level median ${r.rmsMedDb} dB, max ${r.rmsMaxDb} dB`);
  console.log('   cues:', cues || '(none)');
  console.log('   layers at end:', JSON.stringify(r.layers));
  console.log('   tonal peaks:', r.tonalPeaks.length ? r.tonalPeaks.join(', ') : 'none');
};
const at = (t) => ev((t) => window.__acm.intro.at(t), t);
const scroll = (t, s) => ev((t, s) => window.__acm.intro.scroll(t, s), t, s);
// (The effects bus is made with the first sound: run the release first.)
await at(-30); await sleep(1200); await scroll(-26, 1.5); await sleep(2500);
console.log('meter', await setupMeter());
await at(38); await sleep(1500);
await window_('lightning at the stone (38→50)', () => scroll(50, 5), 9000);
await at(118); await sleep(1500);
await window_('rise into cloud and out (118→140)', () => scroll(140, 7), 7600);
await window_('ACM-CEG hold, descend through cloud (140→168)', () => scroll(168, 7), 11000);
await window_('shaft → lobby → door → Events (170→201)', () => scroll(201, 9), 10000);
await window_('Events corridor, standing (room 3)', () => ev(() => window.__acm.jump(window.__acm.roomProgress(3, 0.5))), 5000);
const PRODIGY = 6; // (the Prodigy room's index in the corridor)
await ev((i) => window.__acm.jump(window.__acm.roomProgress(i, 0)), PRODIGY); await sleep(1800);
await window_('Prodigy room visit (scroll through its dwell)', () => ev((i) => window.__acm.scroll(window.__acm.roomProgress(i, 0.97), 6), PRODIGY), 7500);
await window_('Prodigy scrolled back (should be silent)', () => ev((i) => window.__acm.scroll(window.__acm.roomProgress(i, 0.05), 4), PRODIGY), 5000);
await ev(() => window.__acm.jump(window.__acm.segments.portal.start + (window.__acm.segments.portal.end - window.__acm.segments.portal.start) * 0.9)); await sleep(1800);
await window_('portal: enter', () => ev(() => window.__acm.teams.enter()), 4000);
await window_('portal: exit', () => ev(() => window.__acm.teams.exit()), 4000);
await window_('portal: enter, abandoned mid-travel (jump away)', async () => { await ev(() => window.__acm.teams.enter()); await sleep(300); await ev(() => window.__acm.intro.at(20)); }, 3500);
console.log('\n' + (logs.length ? logs.slice(0, 12).join('\n') : 'console: no errors/warnings'));
await b.close();
