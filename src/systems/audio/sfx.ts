/**
 * The film's sound effects — synthesised, not recorded: every sound here is
 * made from noise and a few oscillators in the Web Audio graph, so there are
 * no files to fetch and nothing to license.
 *
 * Two kinds of sound:
 *
 *   layers    continuous beds whose level (and colour) the sound director
 *             sets every frame from where the film is: the canister's roll,
 *             the gas, the wind on the rise, the muffled cloud, the shaft's
 *             resonance, the Events heard through the door
 *   cues      short events, played once when the film crosses their beat
 *             going forward: a settle, the pressure, the release, the swell
 *             of the words, paper fibres, ash, thunder, the door's mechanism
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
    // A heavy cylinder on damp asphalt: low, grainy, its turn heard in the grain.
    case 'roll':
      return bed(ctx, name, 'bandpass', 260, 1.4, true, true);
    // Gas escaping and moving: a high hiss.
    case 'hiss':
      return bed(ctx, name, 'highpass', 3200, 0.7, false, true);
    // Air pushed about: a low breath.
    case 'air':
      return bed(ctx, name, 'lowpass', 420, 0.6, true);
    // Wind on the rise, and in the cloud (its colour set by the director).
    case 'wind':
      return bed(ctx, name, 'bandpass', 700, 0.5, false);
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
  if (opts.freq !== undefined) l.filter.frequency.setTargetAtTime(opts.freq, now, 0.15);
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
  filter.frequency.setValueAtTime(o.f0, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + o.attack + o.hold + o.release);
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

export type Cue = 'settle' | 'pressure' | 'release' | 'words' | 'paper' | 'ash' | 'thunder' | 'doorWake' | 'doorPressure' | 'doorRetract' | 'doorHome';

/** Play a cue once (the director decides when). */
export function cue(name: Cue, opts: { pan?: number; level?: number } = {}) {
  const ctx = ensure();
  if (!ctx) return;
  // (For the QA harness: what played, and when.)
  const dbg = (globalThis as unknown as { __sfxLog?: string[] }).__sfxLog;
  if (dbg && dbg.length < 200) dbg.push(`${name}@${ctx.currentTime.toFixed(2)}`);
  const L = opts.level ?? 1;
  switch (name) {
    case 'settle':
      // The canister rocks to rest: two small knocks of metal on stone.
      noiseBurst(ctx, { type: 'bandpass', f0: 1900, f1: 1400, q: 6, attack: 0.004, hold: 0.01, release: 0.12, level: 0.1 * L, pan: opts.pan });
      noiseBurst(ctx, { type: 'bandpass', f0: 1700, f1: 1300, q: 6, attack: 0.004, hold: 0.008, release: 0.1, level: 0.05 * L, pan: opts.pan, delay: 0.21 });
      break;
    case 'pressure':
      // Something building inside it: a thin hiss rising, and a faint creak of metal.
      noiseBurst(ctx, { type: 'highpass', f0: 1400, f1: 5200, q: 1, attack: 1.4, hold: 0.2, release: 0.25, level: 0.07 * L, pan: opts.pan });
      tone(ctx, { f0: 130, f1: 190, type: 'triangle', attack: 0.9, hold: 0.3, release: 0.4, level: 0.02 * L });
      break;
    case 'release':
      // Not an explosion: a sealed atmosphere let go — a sharp pressurised rush, the air pushed
      // aside (a soft, deep push, no bang), and the long hiss of the gas going out.
      noiseBurst(ctx, { type: 'bandpass', f0: 5200, f1: 900, q: 0.7, attack: 0.012, hold: 0.25, release: 2.6, level: 0.45 * L, pan: opts.pan });
      noiseBurst(ctx, { type: 'lowpass', f0: 520, f1: 90, q: 0.5, attack: 0.05, hold: 0.3, release: 2.2, level: 0.5 * L, brown: true });
      tone(ctx, { f0: 58, f1: 34, attack: 0.04, hold: 0.15, release: 1.4, level: 0.16 * L });
      break;
    case 'words':
      // The air, for a moment, legible: a low swell and a faint harmonic shimmer — no chime.
      tone(ctx, { f0: 73.4, attack: 2.4, hold: 2.6, release: 3.5, level: 0.07 * L });
      tone(ctx, { f0: 110, attack: 2.8, hold: 2.2, release: 3.5, level: 0.045 * L });
      tone(ctx, { f0: 164.8, type: 'triangle', attack: 3.2, hold: 1.8, release: 3.2, level: 0.018 * L });
      noiseBurst(ctx, { type: 'bandpass', f0: 1800, f1: 2600, q: 3, attack: 2.2, hold: 1.8, release: 2.6, level: 0.02 * L });
      break;
    case 'paper':
      // Fibres finding each other: a dry, soft granular rustle.
      for (let i = 0; i < 9; i++)
        noiseBurst(ctx, { type: 'bandpass', f0: 3000 + Math.random() * 2500, f1: 2400, q: 2.5, attack: 0.01, hold: 0.02, release: 0.08 + Math.random() * 0.1, level: (0.012 + Math.random() * 0.02) * L, delay: i * 0.13 + Math.random() * 0.08, pan: (Math.random() - 0.5) * 0.5 });
      break;
    case 'ash':
      // Paper becoming dust: tiny crackles, and a breath of air.
      for (let i = 0; i < 12; i++)
        noiseBurst(ctx, { type: 'highpass', f0: 3500, f1: 4200, q: 0.8, attack: 0.002, hold: 0.004, release: 0.03 + Math.random() * 0.04, level: (0.01 + Math.random() * 0.03) * L, delay: Math.random() * 1.8, pan: (Math.random() - 0.5) * 0.6 });
      noiseBurst(ctx, { type: 'lowpass', f0: 700, f1: 300, q: 0.5, attack: 0.6, hold: 0.4, release: 1.4, level: 0.03 * L });
      break;
    case 'thunder':
      // Far away: after the flash, the rumble arrives late and low, and rolls on.
      noiseBurst(ctx, { type: 'lowpass', f0: 220, f1: 60, q: 0.7, attack: 0.5, hold: 0.8, release: 4.5, level: 0.28 * L, brown: true, delay: 1.1 });
      noiseBurst(ctx, { type: 'lowpass', f0: 140, f1: 45, q: 0.6, attack: 0.9, hold: 0.5, release: 3.5, level: 0.18 * L, brown: true, delay: 2.2 });
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
