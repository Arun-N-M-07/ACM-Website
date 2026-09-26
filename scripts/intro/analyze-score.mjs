// Analyse the intro's score so the cinematic can be timed to it.
//
//   node scripts/intro/analyze-score.mjs <audio-file> <out-dir> [from-s] [to-s]
//
// Decodes the file with the browser's own decoder (headless Chrome, Web Audio),
// then measures, per short frame: loudness (RMS), energy in three bands (low
// < 200 Hz, mid 200–2000 Hz, high > 2 kHz) and spectral flux (how much new
// sound arrives — attacks, hits, entries). Writes:
//
//   <out>/summary.txt   whole track at 1 s, the chosen window at 0.25 s,
//                       the strongest attacks, a tempo estimate
//   <out>/analysis.json the raw curves (for re-use)
//   <out>/overview.png  loudness / bands / attacks, whole track
//   <out>/window.png    the same, zoomed to the window
//
// Nothing here is shipped; it documents how the intro's timeline was derived.
import puppeteer from 'puppeteer-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const [, , file, out = '/tmp/score', fromArg = '60', toArg = '130'] = process.argv;
if (!file) {
  console.error('usage: node scripts/intro/analyze-score.mjs <audio-file> <out-dir> [from-s] [to-s]');
  process.exit(1);
}
mkdirSync(out, { recursive: true });
const b64 = readFileSync(file).toString('base64');

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
page.on('console', (m) => console.log('[page]', m.text()));

const result = await page.evaluate(
  async (b64, from, to) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ctx = new OfflineAudioContext(2, 44100, 44100);
    const buf = await ctx.decodeAudioData(bytes.buffer);
    const sr = buf.sampleRate;
    const n = buf.length;
    const mono = new Float32Array(n);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) mono[i] += d[i] / buf.numberOfChannels;
    }

    // ── FFT frames ──
    const N = 2048;
    const HOP = 512;
    const frames = Math.floor((n - N) / HOP);
    const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
    const re = new Float32Array(N);
    const im = new Float32Array(N);
    const rev = new Uint32Array(N);
    const bits = Math.log2(N);
    for (let i = 0; i < N; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      rev[i] = r;
    }
    const fft = () => {
      for (let i = 0; i < N; i++) {
        const j = rev[i];
        if (j > i) {
          const tr = re[i];
          re[i] = re[j];
          re[j] = tr;
          const ti = im[i];
          im[i] = im[j];
          im[j] = ti;
        }
      }
      for (let size = 2; size <= N; size *= 2) {
        const half = size / 2;
        const step = (-2 * Math.PI) / size;
        for (let i = 0; i < N; i += size) {
          for (let k = 0; k < half; k++) {
            const wr = Math.cos(step * k);
            const wi = Math.sin(step * k);
            const a = i + k;
            const b = a + half;
            const xr = re[b] * wr - im[b] * wi;
            const xi = re[b] * wi + im[b] * wr;
            re[b] = re[a] - xr;
            im[b] = im[a] - xi;
            re[a] += xr;
            im[a] += xi;
          }
        }
      }
    };
    const binHz = sr / N;
    const lowTop = Math.round(200 / binHz);
    const midTop = Math.round(2000 / binHz);
    const rms = new Float32Array(frames);
    const low = new Float32Array(frames);
    const mid = new Float32Array(frames);
    const high = new Float32Array(frames);
    const flux = new Float32Array(frames);
    const centroid = new Float32Array(frames);
    let prev = new Float32Array(N / 2);
    let cur = new Float32Array(N / 2);
    for (let f = 0; f < frames; f++) {
      const o = f * HOP;
      let s2 = 0;
      for (let i = 0; i < N; i++) {
        const v = mono[o + i];
        s2 += v * v;
        re[i] = v * win[i];
        im[i] = 0;
      }
      rms[f] = Math.sqrt(s2 / N);
      fft();
      let l = 0;
      let m = 0;
      let h = 0;
      let fl = 0;
      let cw = 0;
      let cs = 0;
      for (let k = 1; k < N / 2; k++) {
        const mag = Math.hypot(re[k], im[k]);
        const e = mag * mag;
        if (k < lowTop) l += e;
        else if (k < midTop) m += e;
        else h += e;
        const lm = Math.log1p(mag * 20);
        cur[k] = lm;
        const d = lm - prev[k];
        if (d > 0) fl += d;
        cw += k * binHz * mag;
        cs += mag;
      }
      low[f] = l;
      mid[f] = m;
      high[f] = h;
      flux[f] = fl;
      centroid[f] = cs > 0 ? cw / cs : 0;
      const t = prev;
      prev = cur;
      cur = t;
    }
    const frameT = (f) => (f * HOP + N / 2) / sr;
    const db = (x) => (x > 1e-12 ? 10 * Math.log10(x) : -120);

    // ── bins ──
    const binStats = (t0, t1) => {
      const f0 = Math.max(0, Math.floor((t0 * sr - N / 2) / HOP));
      const f1 = Math.min(frames - 1, Math.floor((t1 * sr - N / 2) / HOP));
      let r = 0;
      let l = 0;
      let m = 0;
      let h = 0;
      let fl = 0;
      let c = 0;
      let peak = 0;
      let cnt = 0;
      for (let f = f0; f <= f1; f++) {
        r += rms[f] * rms[f];
        l += low[f];
        m += mid[f];
        h += high[f];
        fl += flux[f];
        c += centroid[f];
        peak = Math.max(peak, rms[f]);
        cnt++;
      }
      cnt = Math.max(1, cnt);
      return {
        t: t0,
        rmsDb: 20 * Math.log10(Math.sqrt(r / cnt) + 1e-9),
        peakDb: 20 * Math.log10(peak + 1e-9),
        lowDb: db(l / cnt),
        midDb: db(m / cnt),
        highDb: db(h / cnt),
        flux: fl / cnt,
        centroid: c / cnt,
      };
    };
    const duration = n / sr;
    const whole = [];
    for (let t = 0; t < duration; t += 1) whole.push(binStats(t, t + 1));
    const windowBins = [];
    for (let t = from; t < Math.min(to, duration); t += 0.25) windowBins.push(binStats(t, t + 0.25));

    // ── onsets: flux peaks over an adaptive threshold ──
    const smoothFlux = new Float32Array(frames);
    const W = 20;
    for (let f = 0; f < frames; f++) {
      let s = 0;
      let c = 0;
      for (let k = Math.max(0, f - W); k <= Math.min(frames - 1, f + W); k++) {
        s += flux[k];
        c++;
      }
      smoothFlux[f] = s / c;
    }
    const onsets = [];
    for (let f = 2; f < frames - 2; f++) {
      const v = flux[f];
      if (v > flux[f - 1] && v >= flux[f + 1] && v > smoothFlux[f] * 1.45) onsets.push({ t: frameT(f), strength: v / (smoothFlux[f] + 1e-9), flux: v, rmsDb: 20 * Math.log10(rms[f] + 1e-9) });
    }
    // Merge onsets closer than 60 ms (keep the stronger).
    const merged = [];
    for (const o of onsets) {
      const last = merged[merged.length - 1];
      if (last && o.t - last.t < 0.06) {
        if (o.flux > last.flux) merged[merged.length - 1] = o;
      } else merged.push(o);
    }

    // ── tempo in the window: autocorrelation of the onset envelope ──
    const fps = sr / HOP;
    const f0 = Math.floor((from * sr) / HOP);
    const f1 = Math.min(frames, Math.floor((to * sr) / HOP));
    const env = [];
    for (let f = f0; f < f1; f++) env.push(Math.max(0, flux[f] - smoothFlux[f]));
    const mean = env.reduce((a, b) => a + b, 0) / Math.max(1, env.length);
    const e2 = env.map((v) => v - mean);
    const tempi = [];
    for (let bpm = 50; bpm <= 180; bpm += 0.5) {
      const lag = (60 / bpm) * fps;
      const L = Math.round(lag);
      let s = 0;
      for (let i = 0; i + L < e2.length; i++) s += e2[i] * e2[i + L];
      tempi.push({ bpm, score: s / Math.max(1, e2.length - L) });
    }
    tempi.sort((a, b) => b.score - a.score);

    // ── plots ──
    const draw = (t0, t1, w, h, marks) => {
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const c = cv.getContext('2d');
      c.fillStyle = '#0d0f12';
      c.fillRect(0, 0, w, h);
      const X = (t) => ((t - t0) / (t1 - t0)) * w;
      const lanes = [
        { name: 'loudness dB (RMS)', get: (f) => 20 * Math.log10(rms[f] + 1e-9), lo: -50, hi: 0, color: '#f0e6d2' },
        { name: 'low <200Hz dB', get: (f) => db(low[f]), lo: -20, hi: 50, color: '#e0784a' },
        { name: 'mid 200-2k dB', get: (f) => db(mid[f]), lo: -20, hi: 50, color: '#7fc4a4' },
        { name: 'high >2k dB', get: (f) => db(high[f]), lo: -30, hi: 40, color: '#8aa8ff' },
        { name: 'spectral flux (attacks)', get: (f) => flux[f], lo: 0, hi: null, color: '#ffd166' },
      ];
      const lh = h / lanes.length;
      const fA = Math.max(0, Math.floor((t0 * sr) / HOP));
      const fB = Math.min(frames - 1, Math.floor((t1 * sr) / HOP));
      lanes.forEach((ln, li) => {
        let hi = ln.hi;
        if (hi === null) {
          hi = 0;
          for (let f = fA; f <= fB; f++) hi = Math.max(hi, ln.get(f));
        }
        const y0 = li * lh;
        c.strokeStyle = 'rgba(255,255,255,0.08)';
        c.beginPath();
        c.moveTo(0, y0 + lh - 0.5);
        c.lineTo(w, y0 + lh - 0.5);
        c.stroke();
        c.strokeStyle = ln.color;
        c.beginPath();
        const step = Math.max(1, Math.floor((fB - fA) / (w * 2)));
        for (let f = fA; f <= fB; f += step) {
          let v = ln.get(f);
          // Max over the step, so peaks survive the decimation.
          for (let k = 1; k < step && f + k <= fB; k++) v = Math.max(v, ln.get(f + k));
          const y = y0 + lh - 4 - ((Math.min(hi, Math.max(ln.lo, v)) - ln.lo) / (hi - ln.lo)) * (lh - 16);
          const x = X(frameT(f));
          if (f === fA) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.6)';
        c.font = '12px monospace';
        c.fillText(ln.name, 6, y0 + 14);
      });
      // Time grid.
      const span = t1 - t0;
      const major = span > 120 ? 10 : span > 40 ? 5 : 1;
      c.font = '11px monospace';
      for (let t = Math.ceil(t0 / major) * major; t <= t1; t += major) {
        const x = X(t);
        c.strokeStyle = t % 60 === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, h);
        c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.7)';
        const mm = Math.floor(t / 60);
        const ss = String(Math.round(t % 60)).padStart(2, '0');
        c.fillText(`${mm}:${ss}`, x + 2, h - 4);
      }
      (marks ?? []).forEach((mk) => {
        const x = X(mk.t);
        c.strokeStyle = mk.color;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, h);
        c.stroke();
        c.lineWidth = 1;
      });
      return cv.toDataURL('image/png');
    };
    const overview = draw(0, duration, 1600, 900, [
      { t: from, color: 'rgba(255,80,80,0.8)' },
      { t: to, color: 'rgba(255,80,80,0.8)' },
    ]);
    const zoom = draw(from, to, 1600, 900, []);

    return {
      sampleRate: sr,
      channels: buf.numberOfChannels,
      duration,
      frames,
      hopSeconds: HOP / sr,
      whole,
      windowBins,
      onsets: merged,
      tempi: tempi.slice(0, 12),
      overview,
      zoom,
    };
  },
  b64,
  Number(fromArg),
  Number(toArg),
);

const png = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');
writeFileSync(`${out}/overview.png`, png(result.overview));
writeFileSync(`${out}/window.png`, png(result.zoom));
delete result.overview;
delete result.zoom;
writeFileSync(`${out}/analysis.json`, JSON.stringify(result));

const mmss = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
const lines = [];
lines.push(`file: ${file}`);
lines.push(`duration ${result.duration.toFixed(3)} s (${mmss(result.duration)}), ${result.sampleRate} Hz, ${result.channels} ch`);
lines.push('');
lines.push('Whole track, 1 s bins: time  rms  peak | low mid high (dB) | flux  centroid');
for (const b of result.whole) lines.push(`${mmss(b.t)}  ${b.rmsDb.toFixed(1).padStart(6)} ${b.peakDb.toFixed(1).padStart(6)} | ${b.lowDb.toFixed(1).padStart(6)} ${b.midDb.toFixed(1).padStart(6)} ${b.highDb.toFixed(1).padStart(6)} | ${b.flux.toFixed(0).padStart(5)} ${b.centroid.toFixed(0).padStart(6)}`);
lines.push('');
lines.push(`Window ${fromArg}–${toArg} s, 0.25 s bins`);
for (const b of result.windowBins) lines.push(`${mmss(b.t)}  ${b.rmsDb.toFixed(1).padStart(6)} ${b.peakDb.toFixed(1).padStart(6)} | ${b.lowDb.toFixed(1).padStart(6)} ${b.midDb.toFixed(1).padStart(6)} ${b.highDb.toFixed(1).padStart(6)} | ${b.flux.toFixed(0).padStart(5)} ${b.centroid.toFixed(0).padStart(6)}`);
lines.push('');
const inWin = result.onsets.filter((o) => o.t >= Number(fromArg) && o.t <= Number(toArg));
const strongest = [...inWin].sort((a, b) => b.flux - a.flux).slice(0, 40).sort((a, b) => a.t - b.t);
lines.push('Strongest attacks in the window (time, flux, strength over local mean, loudness dB):');
for (const o of strongest) lines.push(`${mmss(o.t)}  flux ${o.flux.toFixed(0).padStart(5)}  x${o.strength.toFixed(2)}  ${o.rmsDb.toFixed(1)} dB`);
lines.push('');
lines.push('Tempo candidates (window): ' + result.tempi.map((t) => `${t.bpm} (${t.score.toFixed(3)})`).join(', '));
writeFileSync(`${out}/summary.txt`, lines.join('\n'));
console.log(lines.slice(0, 2).join('\n'));
await browser.close();
