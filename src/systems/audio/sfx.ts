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
 *             sheet's combustion, the air of the cloud as the camera moves
 *             through it, the light-well's shaft (air and its resonances),
 *             the room beyond the Events door; the air of an event's room
 *             while the camera is in it, and the hall's between one room and
 *             the next. All are noise, shaped: nothing here is a sustained
 *             tone (no hum, no drone), and none is a bed under the whole
 *             journey — the music is the continuous bed.
 *   cues      short events, played when the film makes them: the canister's
 *             contact, each contact as it turns, its settle; the pressure and
 *             the release; the swell of the words; a sheet's flaps in the air
 *             and its snap as it unfurls; a burning sheet's ignition,
 *             crackles, pops, brittle curling, ash crumbling and last breath;
 *             thunder after lightning (each storm its own distance); the
 *             shaft's entry, its release into the lobby, the threshold into
 *             the Events; the door's mechanism; the Prodigy wall's pieces
 *             moving and locking; the portal's crossing (and the travel's
 *             build to it — portalTravel)
 *
 * It uses the music player's audio context (made in the gesture that
 * enabled sound) and its own bus, so the music's filter never touches it;
 * with sound off, nothing is made at all.
 */
import { music } from './music';

/**
 * A bed, and what was last sent to it: a target is sent again only when it moves (re-sending the same
 * target changes nothing — the approach is memoryless), and a bed that has been asked for silence for
 * a while stops its source (it has long since decayed to nothing) until it is wanted again.
 */
type Layer = {
  gain: GainNode;
  filter: BiquadFilterNode;
  pan?: StereoPannerNode;
  src: AudioBufferSourceNode | null;
  brown: boolean;
  level: number;
  freq: number;
  q: number;
  panTo: number;
  quietSince: number;
};

/** Below this a bed is silent (−100 dB), and after this long silent (s) its source is stopped. */
const SILENT = 1e-5;
const PARK_AFTER = 4;
const NO_OPTS: { freq?: number; pan?: number; q?: number } = Object.freeze({});

let bus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let brownBuf: AudioBuffer | null = null;
const layers = new Map<string, Layer>();
let built: AudioContext | null = null;

function makeNoise(ctx: AudioContext, brown: boolean) {
  // (Six seconds, started at a random point: long enough that a filtered bed's loop isn't heard.)
  const len = ctx.sampleRate * 6;
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
  // (Dev only, for the audio QA: the effects bus, to measure without the music.)
  if (process.env.NODE_ENV !== 'production') (globalThis as unknown as { __sfxBus?: GainNode }).__sfxBus = bus;
  noise(ctx);
  return ctx;
}

/** The two noises, made once per context (a million-odd random samples). */
let noiseFor: AudioContext | null = null;
function noise(ctx: AudioContext) {
  if (noiseFor === ctx) return;
  noiseFor = ctx;
  noiseBuf = makeNoise(ctx, false);
  brownBuf = makeNoise(ctx, true);
}

/** Make the noise as sound is turned on (inside the gesture's hand-off), not on the film's first sounding frame. */
export function prepare() {
  const ctx = music.context;
  if (ctx && music.wantsSound) noise(ctx);
}

/** A looping noise bed through a filter, at zero until the director raises it. */
function bed(ctx: AudioContext, name: string, type: BiquadFilterType, freq: number, q: number, brown = false, panned = false) {
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  let node: AudioNode = filter.connect(gain);
  let pan: StereoPannerNode | undefined;
  if (panned) {
    pan = ctx.createStereoPanner();
    node = node.connect(pan);
  }
  node.connect(bus!);
  const layer: Layer = { gain, filter, pan, src: null, brown, level: 0, freq, q, panTo: 0, quietSince: -1 };
  play(ctx, layer);
  layers.set(name, layer);
  return layer;
}

/** The bed's noise, looping from a random point (as when it was first made). */
function play(ctx: AudioContext, l: Layer) {
  const src = ctx.createBufferSource();
  src.buffer = l.brown ? brownBuf : noiseBuf;
  src.loop = true;
  src.loopStart = Math.random();
  src.connect(l.filter);
  src.start(0, Math.random() * 5);
  l.src = src;
}

/** Stop a long-silent bed's source (its filter, gain and pan stay, and remember where they were asked to be). */
function park(l: Layer) {
  if (!l.src) return;
  l.src.stop();
  l.src.disconnect();
  l.src = null;
}

/** Start a parked bed again from silence, its colour and place where they were last asked for. */
function wake(ctx: AudioContext, l: Layer, now: number) {
  l.gain.gain.cancelScheduledValues(now);
  l.gain.gain.setValueAtTime(0, now);
  l.level = 0;
  l.filter.frequency.cancelScheduledValues(now);
  l.filter.frequency.setValueAtTime(l.freq, now);
  l.filter.Q.cancelScheduledValues(now);
  l.filter.Q.setValueAtTime(l.q, now);
  if (l.pan) {
    l.pan.pan.cancelScheduledValues(now);
    l.pan.pan.setValueAtTime(l.panTo, now);
  }
  play(ctx, l);
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
    // The cloud, moving through it: soft pressure low down, and the displaced air higher up — two
    // broad bands, each panned on its own slow course so the space is wide, never a wind.
    case 'cloudLow':
      return bed(ctx, name, 'bandpass', 300, 0.7, true, true);
    case 'cloudHigh':
      return bed(ctx, name, 'bandpass', 1400, 0.6, false, true);
    // The mist the journey ends and begins in: one soft band of air, the same on both sides of the
    // loop's seam (its level is the mist's; nothing else about it changes there).
    case 'mistAir':
      return bed(ctx, name, 'bandpass', 280, 0.7, true);
    // The light-well's shaft: the air rushing in a tube (its brightness is the descent's speed)…
    case 'tunnelAir':
      return bed(ctx, name, 'lowpass', 200, 0.7, true);
    // …and the tube's own resonances, excited by that air (narrow bands of noise — a pipe's voice,
    // not an oscillator's hum), rising as the camera goes down.
    case 'tunnelRes':
      return bed(ctx, name, 'bandpass', 110, 12, false, true);
    case 'tunnelRes2':
      return bed(ctx, name, 'bandpass', 270, 14, false, true);
    // The Events beyond their door: the air of a large room, opening as the door does.
    case 'eventsAir':
      return bed(ctx, name, 'lowpass', 300, 0.6, true);
    // An event's room, from inside it: the air of that room — its colour (band and width) is the room's
    // own acoustic, set by the director; heard from the side its bay is on as the camera comes to it,
    // and from all round inside.
    case 'roomAir':
      return bed(ctx, name, 'bandpass', 520, 0.8, true, true);
    // Between one room and the next, through the hall: its air, moving as the camera does.
    case 'hallAir':
      return bed(ctx, name, 'lowpass', 260, 0.6, true);
    // The loop's mosaic (experience/mosaic): the world coming apart into tiles and points of light —
    // a fine, airy shimmer that brightens as they scatter and wanders across the space…
    case 'mosaicShimmer':
      return bed(ctx, name, 'bandpass', 2800, 7, false, true);
    // …and, under it, a faint narrow tone that steps from pitch to pitch as the tiles go, like data
    // resolving (noise through a very narrow band: a voice, not an oscillator).
    case 'mosaicTone':
      return bed(ctx, name, 'bandpass', 660, 26, false, true);
    default:
      return null;
  }
}

/** Set a layer's level (and, optionally, its filter and pan) — smoothed; cheap to call every frame. */
export function setLayer(name: string, level: number, opts: { freq?: number; pan?: number; q?: number } = NO_OPTS) {
  const ctx = music.context;
  // (For the QA harness: each layer's level as the director last set it.)
  const dbg = (globalThis as unknown as { __sfxLayers?: Record<string, number> }).__sfxLayers;
  if (dbg && ctx && music.wantsSound) dbg[name] = level;
  if (level < 0.0005 && !layers.has(name)) return;
  const l = layer(name);
  if (!l || !ctx) return;
  const now = ctx.currentTime;
  const v = Math.max(0, level);
  const freq = opts.freq === undefined ? l.freq : Math.min(ctx.sampleRate * 0.45, opts.freq);
  const q = opts.q === undefined ? l.q : opts.q;
  const pan = opts.pan === undefined || !l.pan ? l.panTo : Math.max(-1, Math.min(1, opts.pan));
  if (!l.src) {
    // Parked: asked for silence, it only remembers where it should be; asked for sound, it wakes.
    if (v < SILENT) {
      l.freq = freq;
      l.q = q;
      l.panTo = pan;
      return;
    }
    wake(ctx, l, now);
  }
  if (Math.abs(v - l.level) >= SILENT) {
    l.gain.gain.setTargetAtTime(v, now, 0.12);
    l.level = v;
  }
  if (Math.abs(freq - l.freq) >= 0.1) {
    l.filter.frequency.setTargetAtTime(freq, now, 0.15);
    l.freq = freq;
  }
  if (Math.abs(q - l.q) >= 1e-3) {
    l.filter.Q.setTargetAtTime(q, now, 0.2);
    l.q = q;
  }
  if (l.pan && Math.abs(pan - l.panTo) >= 1e-3) {
    l.pan.pan.setTargetAtTime(pan, now, 0.1);
    l.panTo = pan;
  }
  if (v >= SILENT) l.quietSince = -1;
  else if (l.quietSince < 0) l.quietSince = now;
  else if (now - l.quietSince > PARK_AFTER) park(l);
}

/** Silence every layer (sound switched off, or the film left behind). */
export function quietAll() {
  const ctx = music.context;
  if (!ctx) return;
  for (const l of layers.values()) {
    l.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    // (So the next level asked for is sent, whatever it is.)
    l.level = -1;
  }
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
  | 'doorHome'
  | 'tunnelEnter'
  | 'tunnelRelease'
  | 'threshold'
  | 'tileMove'
  | 'tileLock'
  | 'portalCross'
  | 'portalExitCross';

/** A fixed pseudo-random 0..1 for (variant, k): variation that is the same every time. */
const vary = (variant: number, k: number) => {
  const x = Math.sin((variant + 1) * (12.9898 + k * 7.133)) * 43758.5453;
  return x - Math.floor(x);
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Play a cue once (the director decides when). */
export function cue(name: Cue, opts: { pan?: number; level?: number; variant?: number; distance?: number } = {}) {
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
    case 'thunder': {
      // After the flash, the sound of it — late, and the later the farther: each storm its own
      // distance (0 overhead … 1 far off) and its own roll, the same every time. Nearer, the first
      // tearing edge (low, not a crack); then the rumble rolling in two or three swells, darker
      // and slower the farther it has come through the air; then the air itself, very low, a
      // long while.
      const d = Math.min(1, Math.max(0, opts.distance ?? 0.5));
      const v = opts.variant ?? 0;
      const delay = 0.7 + d * 2.3 + vary(v, 1) * 0.5;
      const cut = 280 - 160 * d;
      if (d < 0.45) noiseBurst(ctx, { type: 'lowpass', f0: 900, f1: 170, q: 0.6, attack: 0.02, hold: 0.06, release: 0.5, level: 0.05 * (1 - d) * L, brown: true, delay });
      const rolls = 2 + Math.round(vary(v, 2) * 1.4);
      for (let i = 0; i < rolls; i++)
        noiseBurst(ctx, {
          type: 'lowpass',
          f0: cut * (1 - 0.16 * i),
          f1: 42,
          q: 0.7,
          attack: 0.3 + 0.4 * d + 0.25 * vary(v, 3 + i),
          hold: 0.35 + 0.5 * vary(v, 6 + i),
          release: 2.6 + 2.2 * d + vary(v, 9 + i),
          level: (0.2 - 0.045 * i) * (0.8 + 0.2 * (1 - d)) * L,
          brown: true,
          delay: delay + i * (0.5 + 0.7 * vary(v, 12 + i)),
        });
      noiseBurst(ctx, { type: 'lowpass', f0: 90, f1: 36, q: 0.9, attack: 1.1, hold: 0.9, release: 5 + 2.5 * d, level: 0.075 * L, brown: true, delay: delay + 0.8 });
      break;
    }
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
    // ── the tunnel: into the light-well's shaft, out into the lobby, through into the Events ──
    case 'tunnelEnter':
      // Into the tube: the pressure of a closed space closing round you — a low push, and the air.
      noiseBurst(ctx, { type: 'lowpass', f0: 150, f1: 60, q: 0.9, attack: 0.12, hold: 0.2, release: 1.5, level: 0.1 * L, brown: true });
      noiseBurst(ctx, { type: 'bandpass', f0: 900, f1: 380, q: 0.8, attack: 0.3, hold: 0.1, release: 1.2, level: 0.028 * L });
      break;
    case 'tunnelRelease':
      // The shaft opens into the lobby: pressure let go — the air widening, a low bloom.
      noiseBurst(ctx, { type: 'bandpass', f0: 500, f1: 1900, q: 0.7, attack: 0.25, hold: 0.1, release: 1.1, level: 0.03 * L });
      noiseBurst(ctx, { type: 'lowpass', f0: 120, f1: 55, q: 0.8, attack: 0.2, hold: 0.3, release: 2, level: 0.07 * L, brown: true });
      break;
    case 'threshold':
      // Through into the Events: one soft transient — a low thump of the room's air, a bright
      // breath, and a small tone that settles a step down.
      noiseBurst(ctx, { type: 'lowpass', f0: 190, f1: 70, q: 1, attack: 0.01, hold: 0.04, release: 0.9, level: 0.09 * L, brown: true });
      noiseBurst(ctx, { type: 'highpass', f0: 5000, f1: 7000, q: 0.7, attack: 0.05, hold: 0.05, release: 0.7, level: 0.012 * L });
      tone(ctx, { f0: 220, f1: 196, attack: 0.02, hold: 0.1, release: 1.3, level: 0.018 * L });
      break;
    // ── the Prodigy wall: each piece moving into its place, and locking there ────────────────
    case 'tileMove': {
      // The piece's travel: a soft push of air.
      const v = opts.variant ?? 0;
      noiseBurst(ctx, { type: 'bandpass', f0: 700 + 300 * vary(v, 1), f1: 2100, q: 0.9, attack: 0.3, hold: 0.05, release: 0.14, level: 0.011 * L, pan });
      break;
    }
    case 'tileLock': {
      // Contact → lock → resonance. A crisp tick as the edge meets its seat; a hair later the
      // piece's weight going home (a short, deep, damped thunk); a brief struck-plate ring — a
      // fundamental and one inharmonic partial — and a tiny buzz of material. Each piece its own
      // pitch and weight (the same every time); the last, the centre, a fuller, lower lock.
      const v = opts.variant ?? 0;
      const last = v >= 8;
      const pitch = (1 + (vary(v, 1) - 0.5) * 0.08) * (last ? 0.75 : 1);
      const vel = (0.85 + 0.15 * vary(v, 2)) * L;
      const dt = vary(v, 3) * 0.012;
      noiseBurst(ctx, { type: 'bandpass', f0: 3400 * pitch, f1: 2600 * pitch, q: 6, attack: 0.001, hold: 0.002, release: 0.03, level: 0.03 * vel, pan, delay: dt });
      noiseBurst(ctx, { type: 'lowpass', f0: 230 * pitch, f1: 85, q: 1.1, attack: 0.004, hold: 0.018, release: last ? 0.32 : 0.16, level: (last ? 0.11 : 0.07) * vel, brown: true, pan, delay: dt + 0.008 });
      tone(ctx, { f0: 392 * pitch, attack: 0.003, hold: 0.01, release: last ? 0.9 : 0.28, level: 0.017 * vel, delay: dt + 0.01 });
      tone(ctx, { f0: 392 * 2.76 * pitch, attack: 0.002, hold: 0.005, release: last ? 0.5 : 0.14, level: 0.006 * vel, delay: dt + 0.01 });
      noiseBurst(ctx, { type: 'bandpass', f0: 1150 * pitch, f1: 1000 * pitch, q: 14, attack: 0.002, hold: 0.02, release: 0.12, level: 0.011 * vel, pan, delay: dt + 0.012 });
      break;
    }
    // ── the portal: the instant of crossing (the build to it is portalTravel) ────────────────
    case 'portalCross':
      // Through: a low displacement, a bright tear of air, and a tone that blooms and hangs.
      noiseBurst(ctx, { type: 'lowpass', f0: 170, f1: 55, q: 1, attack: 0.006, hold: 0.05, release: 1, level: 0.15 * L, brown: true });
      noiseBurst(ctx, { type: 'bandpass', f0: 5200, f1: 1100, q: 0.8, attack: 0.01, hold: 0.04, release: 1, level: 0.06 * L });
      tone(ctx, { f0: 164.8, attack: 0.03, hold: 0.2, release: 1.8, level: 0.03 * L });
      tone(ctx, { f0: 247.2, attack: 0.05, hold: 0.15, release: 1.5, level: 0.016 * L });
      break;
    case 'portalExitCross':
      // Back through, the other way: the tone falls away beneath you.
      noiseBurst(ctx, { type: 'lowpass', f0: 150, f1: 50, q: 1, attack: 0.01, hold: 0.05, release: 0.9, level: 0.12 * L, brown: true });
      noiseBurst(ctx, { type: 'bandpass', f0: 1400, f1: 4400, q: 0.8, attack: 0.02, hold: 0.05, release: 0.8, level: 0.05 * L });
      tone(ctx, { f0: 247.2, f1: 123.6, attack: 0.02, hold: 0.1, release: 1.4, level: 0.024 * L });
      break;
  }
}

/**
 * The travel through the portal (teams/travel.ts), as sound: a build that starts with the travel
 * and peaks exactly at its crossing (`toCross` seconds on) — low movement gathering, air rising
 * (falling, going back out), two close tones whose beating quickens — then falls away inside the
 * tunnel. The crossing's own transient is a cue (portalCross / portalExitCross), fired by the
 * travel at the instant it crosses. Returns a handle: a travel that is abandoned (a jump, the
 * reduced path) stops its sound, so nothing is left playing.
 */
export function portalTravel(dir: 1 | -1, toCross: number, total: number): { stop: () => void } {
  const ctx = ensure();
  if (!ctx || !bus) return { stop: () => undefined };
  const t0 = ctx.currentTime;
  const tc = t0 + Math.max(0.1, toCross);
  const end = t0 + total + 1.2;
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(bus);
  const sources: AudioScheduledSourceNode[] = [];
  const env = (g: GainNode, peak: number, after: number) => {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, tc);
    g.gain.exponentialRampToValueAtTime(peak * after, tc + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
  };
  const noise = (brown: boolean, type: BiquadFilterType, f0: number, fc: number, q: number, peak: number, after: number) => {
    const src = ctx.createBufferSource();
    src.buffer = brown ? brownBuf : noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(fc, tc);
    const g = ctx.createGain();
    env(g, peak, after);
    src.connect(f).connect(g).connect(out);
    src.start(t0, Math.random() * 5);
    src.stop(end + 0.1);
    sources.push(src);
  };
  const tone2 = (f0: number, fc: number, peak: number) => {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(fc, tc);
    const g = ctx.createGain();
    env(g, peak, 0.3);
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(end + 0.1);
    sources.push(o);
  };
  const up = dir === 1;
  noise(true, 'lowpass', 70, up ? 230 : 150, 0.9, 0.09, 0.45);
  noise(false, 'bandpass', up ? 700 : 3600, up ? 3800 : 800, 1.1, 0.03, 0.3);
  tone2(up ? 110 : 165, up ? 164.8 : 110, 0.014);
  tone2(up ? 111.3 : 167.2, up ? 167.6 : 111.5, 0.01);
  return {
    stop: () => {
      const now = ctx.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + 0.2);
      for (const n of sources) {
        try {
          n.stop(now + 0.25);
        } catch {
          // (already stopped)
        }
      }
    },
  };
}
