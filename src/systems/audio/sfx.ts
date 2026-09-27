/**
 * The film's sound effects — synthesised, not recorded: every sound here is
 * made from noise and a few oscillators in the Web Audio graph, so there are
 * no files to fetch and nothing to license.
 *
 * Two kinds of sound:
 *
 *   layers    continuous beds whose level (and colour) the sound director
 *             sets every frame from where the film is: the canister's
 *             friction, the gas, the air past a sheet in flight, a burning
 *             sheet's combustion, the shaft's resonance, the Events heard
 *             through the door (no wind: the flight is carried by the music)
 *   cues      short events, played when the film makes them: the canister's
 *             contact, each contact as it turns, its settle; the pressure and
 *             the release; the swell of the words; a sheet's flaps in the air
 *             and its snap as it unfurls; a burning sheet's ignition,
 *             crackles, pops, brittle curling, ash crumbling and last breath;
 *             thunder; the door's mechanism
 *
 * It uses the music player's audio context (made in the gesture that
 * enabled sound) and its own bus, so the music's filter never touches it;
 * with sound off, nothing is made at all.
 */
import { music } from './music';

type Layer = { gain: GainNode; filter: BiquadFilterNode; pan?: StereoPannerNode; osc?: OscillatorNode[] };

let bus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let brownBuf: AudioBuffer | null = null;
const layers = new Map<string, Layer>();
let built: AudioContext | null = null;

function makeNoise(ctx: AudioContext, brown: boolean) {
  const len = ctx.sampleRate * 3;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
  }
  return buf;
}

function ensure(): AudioContext | null {
  const ctx = music.context;
  if (!ctx || ctx.state !== 'running' || !music.wantsSound) return null;
  if (built === ctx) return ctx;
  // (Re)build the graph on this context.
  built = ctx;
  layers.clear();
  bus = ctx.createGain();
  bus.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  bus.connect(comp).connect(ctx.destination);
  noiseBuf = makeNoise(ctx, false);
  brownBuf = makeNoise(ctx, true);
  return ctx;
}

/** A looping noise bed through a filter, at zero until the director raises it. */
function bed(ctx: AudioContext, name: string, type: BiquadFilterType, freq: number, q: number, brown = false, panned = false) {
  const src = ctx.createBufferSource();
  src.buffer = brown ? brownBuf : noiseBuf;
  src.loop = true;
  src.loopStart = Math.random();
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  let node: AudioNode = src.connect(filter).connect(gain);
  let pan: StereoPannerNode | undefined;
  if (panned) {
    pan = ctx.createStereoPanner();
    node = node.connect(pan);
  }
  node.connect(bus!);
  src.start(0, Math.random() * 2);
  const layer: Layer = { gain, filter, pan };
  layers.set(name, layer);
  return layer;
}

/** A low tonal bed (a few soft sines) through a filter. */
function drone(ctx: AudioContext, name: string, freqs: number[], cutoff: number) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  filter.connect(gain).connect(bus!);
  const osc = freqs.map((f, i) => {
    const o = ctx.createOscillator();
    o.type = i === 0 ? 'sine' : 'triangle';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 1 / freqs.length / (i + 1);
    o.connect(g).connect(filter);
    o.start();
    return o;
  });
  const layer: Layer = { gain, filter, osc };
  layers.set(name, layer);
  return layer;
}

function layer(name: string): Layer | null {
  const ctx = ensure();
  if (!ctx) return null;
  const got = layers.get(name);
  if (got) return got;
  switch (name) {
    // Friction under the rolling canister: a low grainy rub on damp asphalt (its level is its speed).
    case 'roll':
      return bed(ctx, name, 'bandpass', 320, 1.1, true, true);
    // Gas escaping and moving: a high hiss.
    case 'hiss':
      return bed(ctx, name, 'highpass', 3200, 0.7, false, true);
    // Air pushed about: a low breath.
    case 'air':
      return bed(ctx, name, 'lowpass', 420, 0.6, true);
    // A sheet in flight: the air past it (level and brightness follow its speed, pan where it is).
    case 'flight':
      return bed(ctx, name, 'bandpass', 900, 0.8, false, true);
    // A sheet of paper being consumed: the thin breath of its combustion (level follows the fire's front).
    case 'burn':
      return bed(ctx, name, 'bandpass', 2400, 0.9, false, true);
    // The shaft and the lobby: an enclosed resonance.
    case 'shaft':
      return drone(ctx, name, [55, 82.4, 110.6], 380);
    // The Events, heard through the door: a room's hum and air.
    case 'events':
      return drone(ctx, name, [98, 147, 196.3], 900);
    default:
      return null;
  }
}

/** Set a layer's level (and, optionally, its filter and pan) — smoothed; cheap to call every frame. */
export function setLayer(name: string, level: number, opts: { freq?: number; pan?: number; q?: number } = {}) {
  const ctx = music.context;
  if (level < 0.0005 && !layers.has(name)) return;
  const l = layer(name);
  if (!l || !ctx) return;
  const now = ctx.currentTime;
  l.gain.gain.setTargetAtTime(Math.max(0, level), now, 0.12);
  if (opts.freq !== undefined) l.filter.frequency.setTargetAtTime(Math.min(ctx.sampleRate * 0.45, opts.freq), now, 0.15);
  if (opts.q !== undefined) l.filter.Q.setTargetAtTime(opts.q, now, 0.2);
  if (opts.pan !== undefined && l.pan) l.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, opts.pan)), now, 0.1);
}

/** Silence every layer (sound switched off, or the film left behind). */
export function quietAll() {
  const ctx = music.context;
  if (!ctx) return;
  for (const l of layers.values()) l.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
}

// ─── cues ──────────────────────────────────────────────────────────────────

function noiseBurst(ctx: AudioContext, o: { type: BiquadFilterType; f0: number; f1: number; q: number; attack: number; hold: number; release: number; level: number; brown?: boolean; pan?: number; delay?: number }) {
  const t0 = ctx.currentTime + (o.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = o.brown ? brownBuf : noiseBuf;
  const filter = ctx.createBiquadFilter();
  filter.type = o.type;
  filter.Q.value = o.q;
  // (Within what this context can play: some outputs run at 16 kHz.)
  const top = ctx.sampleRate * 0.45;
  filter.frequency.setValueAtTime(Math.min(top, o.f0), t0);
  filter.frequency.exponentialRampToValueAtTime(Math.min(top, Math.max(20, o.f1)), t0 + o.attack + o.hold + o.release);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.level, t0 + o.attack);
  g.gain.setValueAtTime(o.level, t0 + o.attack + o.hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.attack + o.hold + o.release);
  let node: AudioNode = src.connect(filter).connect(g);
  if (o.pan !== undefined) {
    const p = ctx.createStereoPanner();
    p.pan.value = o.pan;
    node = node.connect(p);
  }
  node.connect(bus!);
  src.start(t0, Math.random() * 2);
  src.stop(t0 + o.attack + o.hold + o.release + 0.05);
}

function tone(ctx: AudioContext, o: { f0: number; f1?: number; type?: OscillatorType; attack: number; hold: number; release: number; level: number; delay?: number }) {
  const t0 = ctx.currentTime + (o.delay ?? 0);
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f0, t0);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t0 + o.attack + o.hold + o.release);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.level, t0 + o.attack);
  g.gain.setValueAtTime(o.level, t0 + o.attack + o.hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.attack + o.hold + o.release);
  osc.connect(g).connect(bus!);
  osc.start(t0);
  osc.stop(t0 + o.attack + o.hold + o.release + 0.05);
}

export type Cue =
  | 'contact'
  | 'rollTick'
  | 'settle'
  | 'pressure'
  | 'release'
  | 'words'
  | 'flap'
  | 'unfurl'
  | 'ignite'
  | 'crackle'
  | 'pop'
  | 'brittle'
  | 'crumble'
  | 'ashRelease'
  | 'thunder'
  | 'doorWake'
  | 'doorPressure'
  | 'doorRetract'
  | 'doorHome';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Play a cue once (the director decides when). */
export function cue(name: Cue, opts: { pan?: number; level?: number } = {}) {
  const ctx = ensure();
  if (!ctx) return;
  // (For the QA harness: what played, and when.)
  const dbg = (globalThis as unknown as { __sfxLog?: string[] }).__sfxLog;
  if (dbg && dbg.length < 400) dbg.push(`${name}@${ctx.currentTime.toFixed(2)}`);
  const L = opts.level ?? 1;
  const pan = opts.pan;
  switch (name) {
    // ── the canister: a physical object on a hard, damp surface ──────────────
    case 'contact':
      // Touching down: a muted knock of metal on asphalt — weight, not an impact.
      noiseBurst(ctx, { type: 'bandpass', f0: 900, f1: 600, q: 3.5, attack: 0.003, hold: 0.012, release: 0.09, level: 0.07 * L, pan });
      noiseBurst(ctx, { type: 'lowpass', f0: 380, f1: 160, q: 0.9, attack: 0.004, hold: 0.01, release: 0.12, level: 0.06 * L, brown: true, pan });
      break;
    case 'rollTick':
      // One contact as it turns — a band or a seam meeting the ground; never twice the same.
      noiseBurst(ctx, { type: 'bandpass', f0: rnd(1500, 2600), f1: rnd(1100, 1500), q: rnd(4, 7), attack: 0.002, hold: 0.004, release: rnd(0.025, 0.05), level: 0.03 * L, pan });
      if (Math.random() < 0.35) noiseBurst(ctx, { type: 'lowpass', f0: 420, f1: 220, q: 0.8, attack: 0.003, hold: 0.006, release: 0.05, level: 0.02 * L, brown: true, pan });
      break;
    case 'settle':
      // Coming to rest: a short scrape as it slows, the rock back, and a last small tick. Then nothing.
      noiseBurst(ctx, { type: 'bandpass', f0: 2600, f1: 1300, q: 1.6, attack: 0.03, hold: 0.08, release: 0.22, level: 0.035 * L, pan });
      noiseBurst(ctx, { type: 'bandpass', f0: 1700, f1: 1300, q: 6, attack: 0.003, hold: 0.008, release: 0.08, level: 0.04 * L, pan, delay: 0.34 });
      noiseBurst(ctx, { type: 'bandpass', f0: 2100, f1: 1700, q: 7, attack: 0.002, hold: 0.004, release: 0.05, level: 0.018 * L, pan, delay: 0.62 });
      break;
    case 'pressure':
      // Something building inside it: a thin hiss rising at the seam, and a faint strain of metal.
      noiseBurst(ctx, { type: 'highpass', f0: 1400, f1: 5200, q: 1, attack: 1.4, hold: 0.2, release: 0.25, level: 0.045 * L, pan });
      tone(ctx, { f0: 130, f1: 190, type: 'triangle', attack: 0.9, hold: 0.3, release: 0.4, level: 0.012 * L });
      break;
    case 'release':
      // Not an explosion: a sealed atmosphere let go — a pressurised rush out of the vents, the air
      // pushed aside (soft, no bang), and the gas going out.
      noiseBurst(ctx, { type: 'bandpass', f0: 5200, f1: 900, q: 0.7, attack: 0.02, hold: 0.25, release: 2.4, level: 0.2 * L, pan });
      noiseBurst(ctx, { type: 'lowpass', f0: 460, f1: 110, q: 0.5, attack: 0.08, hold: 0.3, release: 2, level: 0.14 * L, brown: true });
      break;
    case 'words':
      // The air, for a moment, legible: a low swell and a faint harmonic shimmer — no chime.
      tone(ctx, { f0: 73.4, attack: 2.4, hold: 2.6, release: 3.5, level: 0.05 * L });
      tone(ctx, { f0: 110, attack: 2.8, hold: 2.2, release: 3.5, level: 0.032 * L });
      tone(ctx, { f0: 164.8, type: 'triangle', attack: 3.2, hold: 1.8, release: 3.2, level: 0.012 * L });
      noiseBurst(ctx, { type: 'bandpass', f0: 1800, f1: 2600, q: 3, attack: 2.2, hold: 1.8, release: 2.6, level: 0.014 * L });
      break;
    // ── a sheet arriving: flaps in the air, then the snap as it unfurls ──────
    case 'flap':
      // One flap of a sheet in the air: a soft, papery push of air — and the paper's own dry edge.
      noiseBurst(ctx, { type: 'bandpass', f0: rnd(1100, 1500), f1: rnd(600, 800), q: 1.4, attack: 0.012, hold: 0.02, release: rnd(0.07, 0.11), level: 0.03 * L, pan });
      noiseBurst(ctx, { type: 'highpass', f0: rnd(3800, 5200), f1: 3000, q: 0.9, attack: 0.004, hold: 0.008, release: rnd(0.03, 0.05), level: 0.009 * L, pan, delay: rnd(0, 0.015) });
      break;
    case 'unfurl':
      // Pulled flat: a crisp snap of paper going taut, the air it pushes, and a short rustle settling.
      noiseBurst(ctx, { type: 'bandpass', f0: 2600, f1: 1200, q: 1.2, attack: 0.002, hold: 0.01, release: 0.13, level: 0.05 * L, pan });
      noiseBurst(ctx, { type: 'lowpass', f0: 520, f1: 180, q: 0.7, attack: 0.005, hold: 0.02, release: 0.16, level: 0.03 * L, brown: true, pan });
      for (let i = 0; i < 4; i++)
        noiseBurst(ctx, { type: 'bandpass', f0: rnd(3000, 5500), f1: 2400, q: 2.5, attack: 0.008, hold: 0.012, release: rnd(0.05, 0.1), level: rnd(0.005, 0.01) * L, delay: 0.1 + i * rnd(0.05, 0.09), pan: (pan ?? 0) + rnd(-0.15, 0.15) });
      break;
    // ── paper → fire → ash: grains the director schedules from the burn's own state ─
    case 'ignite':
      // The first edge catching: a tiny dry catch of flame, and a crackle or two.
      noiseBurst(ctx, { type: 'bandpass', f0: 1600, f1: 3200, q: 0.9, attack: 0.04, hold: 0.05, release: 0.35, level: 0.018 * L, pan });
      noiseBurst(ctx, { type: 'highpass', f0: 4200, f1: 5200, q: 0.8, attack: 0.002, hold: 0.003, release: 0.02, level: 0.03 * L, pan, delay: 0.12 });
      noiseBurst(ctx, { type: 'highpass', f0: 3800, f1: 4600, q: 0.8, attack: 0.002, hold: 0.003, release: 0.025, level: 0.022 * L, pan, delay: 0.27 });
      break;
    case 'crackle':
      // Thin material crackling: a dry click.
      noiseBurst(ctx, { type: 'highpass', f0: rnd(3000, 6000), f1: rnd(4000, 7000), q: 0.8, attack: 0.001, hold: 0.002, release: rnd(0.012, 0.035), level: rnd(0.012, 0.03) * L, pan });
      break;
    case 'pop':
      // A tiny pop — a fibre bursting.
      noiseBurst(ctx, { type: 'bandpass', f0: rnd(900, 1700), f1: rnd(700, 1100), q: rnd(3, 6), attack: 0.002, hold: 0.004, release: rnd(0.03, 0.06), level: rnd(0.012, 0.022) * L, pan });
      break;
    case 'brittle':
      // The sheet curling and shrinking: a quick cluster of very fine brittle ticks.
      for (let i = 0; i < 4; i++)
        noiseBurst(ctx, { type: 'highpass', f0: rnd(6500, 9500), f1: rnd(7000, 10000), q: 0.8, attack: 0.001, hold: 0.001, release: rnd(0.006, 0.014), level: rnd(0.006, 0.013) * L, pan, delay: i * rnd(0.018, 0.04) });
      break;
    case 'crumble':
      // Ash: very fine dry grains separating — lighter, drier, quieter.
      noiseBurst(ctx, { type: 'bandpass', f0: rnd(2500, 4500), f1: rnd(1800, 3000), q: rnd(1.5, 3), attack: 0.002, hold: 0.003, release: rnd(0.01, 0.025), level: rnd(0.004, 0.009) * L, pan });
      break;
    case 'ashRelease':
      // The last of it letting go: an almost silent breath of air.
      noiseBurst(ctx, { type: 'lowpass', f0: 900, f1: 400, q: 0.5, attack: 0.5, hold: 0.3, release: 1.2, level: 0.012 * L, pan });
      break;
    // ── the world ────────────────────────────────────────────────────────────
    case 'thunder':
      // Far away: after the flash, the rumble arrives late and low, and rolls on.
      noiseBurst(ctx, { type: 'lowpass', f0: 220, f1: 60, q: 0.7, attack: 0.5, hold: 0.8, release: 4.5, level: 0.22 * L, brown: true, delay: 1.1 });
      noiseBurst(ctx, { type: 'lowpass', f0: 140, f1: 45, q: 0.6, attack: 0.9, hold: 0.5, release: 3.5, level: 0.14 * L, brown: true, delay: 2.2 });
      break;
    case 'doorWake':
      // The seams light: a low electrical wake, and a click.
      tone(ctx, { f0: 60, attack: 0.3, hold: 0.6, release: 1.2, level: 0.05 * L });
      noiseBurst(ctx, { type: 'bandpass', f0: 2400, f1: 2000, q: 8, attack: 0.003, hold: 0.01, release: 0.06, level: 0.05 * L });
      break;
    case 'doorPressure':
      // The seal lets go: a heavy unlock, then a pressure release at the seams.
      noiseBurst(ctx, { type: 'lowpass', f0: 260, f1: 120, q: 1.2, attack: 0.01, hold: 0.06, release: 0.5, level: 0.3 * L, brown: true });
      noiseBurst(ctx, { type: 'bandpass', f0: 4200, f1: 1600, q: 0.8, attack: 0.03, hold: 0.4, release: 1.6, level: 0.18 * L, delay: 0.12 });
      break;
    case 'doorRetract':
      // The panels running into the architecture: a deep mechanical travel.
      noiseBurst(ctx, { type: 'bandpass', f0: 140, f1: 90, q: 1.5, attack: 0.5, hold: 2.2, release: 1.2, level: 0.26 * L, brown: true });
      tone(ctx, { f0: 46, f1: 41, type: 'triangle', attack: 0.6, hold: 2.0, release: 1.2, level: 0.05 * L });
      break;
    case 'doorHome':
      // …and home, into their channels.
      noiseBurst(ctx, { type: 'lowpass', f0: 300, f1: 90, q: 1, attack: 0.008, hold: 0.05, release: 0.7, level: 0.24 * L, brown: true });
      break;
  }
}
