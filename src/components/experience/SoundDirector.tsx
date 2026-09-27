'use client';
/**
 * Runs the film's sound effects (systems/audio/sfx.ts) from where the film
 * is — every frame, from the beat, the scroll's speed and the camera.
 *
 *   layers   set continuously: the roll (with the canister's speed, distance
 *            and side), the gas (while there is gas), the wind (with the
 *            camera's own speed through the air; muffled in the cloud), the
 *            shaft's resonance, the Events heard through the door — rising
 *            and opening as it opens, before you see in
 *   cues     played once, when the film crosses their beat going forward
 *            (never when it is scrubbed back, never on a jump); each re-arms
 *            once the film is back before it
 *
 * Silence is the default: nothing plays unless something in the world makes
 * it. With sound off, nothing is made.
 */
import { useEffect, useRef } from 'react';
import { introCameraAt } from '@/intro/camera';
import { look } from '@/intro/look';
import { CAN, GROUND_Y, gasAmount, rollAt, type RollState } from '@/intro/prologue/layout';
import { introFrame } from '@/intro/state';
import { FRAGMENTS } from '@/intro/story/fragments';
import { T } from '@/intro/timeline';
import { LIGHTNING } from '@/intro/world/lightning';
import { world } from '@/scenes/shared/blend';
import { useExperience } from '@/store/experience';
import { cue, type Cue, quietAll, setLayer } from '@/systems/audio/sfx';
import { useProgressFrame } from './useProgressFrame';

const DOOR_BEATS = 6.5;
const CUES: { at: number; name: Cue; level?: number }[] = [
  { at: T.rest - 0.25, name: 'settle' },
  { at: T.pressure, name: 'pressure' },
  { at: T.release, name: 'release' },
  { at: T.form, name: 'words' },
  ...FRAGMENTS.map((f) => ({ at: f.arrive[0] + 0.3, name: 'paper' as Cue })),
  ...FRAGMENTS.map((f) => ({ at: f.burn[0] + 0.6, name: 'ash' as Cue })),
  ...LIGHTNING.map((l) => ({ at: l.at, name: 'thunder' as Cue, level: l.strength })),
  { at: T.door + DOOR_BEATS * 0.02, name: 'doorWake' },
  { at: T.door + DOOR_BEATS * 0.1, name: 'doorPressure' },
  { at: T.door + DOOR_BEATS * 0.3, name: 'doorRetract' },
  { at: T.door + DOOR_BEATS * 0.9, name: 'doorHome' },
];

const roll: RollState = { s: 0, v: 0, angle: 0, x: 0, z: 0, lift: 0, tilt: 0, yaw: 0, seen: 0 };
const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

export function SoundDirector() {
  const musicOn = useExperience((s) => s.musicOn);
  const last = useRef<number | null>(null);
  const armed = useRef(CUES.map(() => true));
  const bps = useRef(0);

  useEffect(() => {
    if (!musicOn) quietAll();
  }, [musicOn]);

  useProgressFrame((_, dt) => {
    if (!musicOn) return;
    const st = useExperience.getState();
    const t = introFrame.t;
    const inFilm = introFrame.active && st.phase === 'cinematic';
    const prev = last.current;
    last.current = inFilm ? t : null;
    if (!inFilm) {
      // After the film: only the Events' own air, faintly, underground.
      setLayer('roll', 0);
      setLayer('hiss', 0);
      setLayer('air', 0);
      setLayer('wind', 0);
      setLayer('shaft', 0);
      setLayer('events', 0.035 * world.underground * (1 - world.teams), { freq: 1200 });
      return;
    }
    // How fast the film is moving (beats per second), smoothed.
    const step = prev === null ? 0 : t - prev;
    const jump = Math.abs(step) > 4;
    bps.current += ((jump || dt <= 0 ? 0 : step / dt) - bps.current) * Math.min(1, dt * 8);

    // ── cues: forward crossings only, never on a jump
    CUES.forEach((c, i) => {
      if (t < c.at - 0.5) armed.current[i] = true;
      if (prev !== null && !jump && armed.current[i] && prev < c.at && t >= c.at) {
        armed.current[i] = false;
        const cam = introCameraAt(t).pos;
        const pan = c.name === 'settle' || c.name === 'pressure' || c.name === 'release' ? Math.max(-1, Math.min(1, (roll.x - cam.x) / 2)) : 0;
        // Lighting's thunder only if the film is moving on through the cloud, not crawling back and forth.
        cue(c.name, { pan, level: c.level });
      }
    });

    const cam = introCameraAt(t).pos;
    // ── the roll: heard as it comes, by its speed in the world (scroll speed × its travel per beat)
    rollAt(t, roll);
    const dist = Math.hypot(roll.x - cam.x, GROUND_Y + CAN.r - cam.y, roll.z - cam.z);
    const speed = Math.abs(roll.v * bps.current); // m/s
    const rolling = t > T.roll && t < T.rest + 0.5 ? Math.min(1, speed / 1.6) : 0;
    setLayer('roll', rolling * 0.55 * roll.seen / (1 + 0.08 * dist * dist), { freq: 170 + 230 * Math.min(1, speed / 2), pan: (roll.x - cam.x) / Math.max(1, dist) });

    // ── the gas: its long hiss, and the air it moves
    const since = t - T.release;
    const gas = gasAmount(t);
    setLayer('hiss', since > 0 ? (0.05 + 0.2 * Math.exp(-since / 2.5)) * gas : 0, { freq: 2600 + 1800 * Math.exp(-since / 3) });
    setLayer('air', since > 0 ? 0.22 * Math.exp(-since / 4) * gas + 0.05 * gas : 0);

    // ── the wind: the camera's own speed through the air, muffled in the cloud
    const a = introCameraAt(t - 0.1).pos.clone();
    const b = introCameraAt(t + 0.1).pos;
    const camSpeed = (a.distanceTo(b) / 0.2) * Math.abs(bps.current); // m/s
    const aloft = smooth(T.approach, T.rise, t) * (1 - smooth(T.plaza - 1, T.plaza + 1, t));
    const windLevel = aloft * (0.04 + 0.3 * Math.min(1, camSpeed / 45)) * (1 + 0.6 * look.cloud);
    setLayer('wind', windLevel, { freq: 520 + 900 * (1 - look.cloud) * Math.min(1, camSpeed / 45), q: 0.5 + 0.6 * look.cloud });

    // ── below: the shaft's resonance, then the Events through the door
    const below = smooth(T.shaft - 1, T.shaft + 1, t);
    setLayer('shaft', below * (0.14 - 0.06 * smooth(T.lobby, T.door, t)) * (1 - smooth(T.doorway, T.end, t)));
    const open = smooth(T.door + DOOR_BEATS * 0.25, T.doorway, t);
    setLayer('events', smooth(T.lobby - 2, T.lobby, t) * (0.04 + 0.1 * open), { freq: 260 + 1100 * open });
  });

  return null;
}
