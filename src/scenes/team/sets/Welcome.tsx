'use client';
/**
 * The welcome, right after the push through the door: the Chairperson notices
 * you, walks over, offers a hand and shakes yours (your own arm appears), then
 * steps aside and gestures into the workspace while the other office bearers
 * turn and wave. All of it is scrubbed by scroll.
 */
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { focusOn, handshake, ramp01, releaseFocus, window01 } from '@/systems/characters/cues';
import { npcAnchors } from '@/systems/characters/registry';
import { smoothstep } from '@/systems/camera/pose';
import { TOUR_STOPS } from '@/systems/camera/tour';
import type { MemberPlacement } from '../teamLayout';
import { cue, releaseCues, useStopClock } from './shared';

const into = new Vector3();

export function WelcomeScene({ members }: { members: MemberPlacement[] }) {
  const clock = useStopClock(0);
  const view = TOUR_STOPS[0].view;
  const next = TOUR_STOPS[1]?.view ?? view;

  useFrame(() => {
    const c = clock.current;
    if (!c.here) {
      releaseCues(members);
      if (handshake.member) {
        handshake.weight = 0;
        handshake.member = '';
      }
      releaseFocus(0);
      return;
    }
    const u = c.meet;
    const [chair, ...others] = members;
    if (!chair) return;

    // The Chairperson walks up to arm's length in front of the visitor…
    const meetPoint = { x: view[0] - 0.05, z: view[2] - 1.5 };
    // …and back to where they were standing.
    const back = { x: chair.x, z: chair.z };
    const approach = smoothstep(0.06, 0.3, u);
    const retreat = smoothstep(0.66, 0.82, u);
    const h = cue(chair.member.id);
    const px = chair.x + (meetPoint.x - chair.x) * approach + (back.x - meetPoint.x) * retreat;
    const pz = chair.z + (meetPoint.z - chair.z) * approach + (back.z - meetPoint.z) * retreat;
    h.pos = { x: px, z: pz };
    h.look = Math.min(1, u * 12);
    h.turn = u > 0.28 && u < 0.84 ? 1 : 0;
    // …offers a hand and shakes.
    h.extend = window01(u, 0.3, 0.64, 0.05);
    h.pump = window01(u, 0.4, 0.6, 0.02);
    // …then gestures into the hall.
    h.point = window01(u, 0.8, 1.01, 0.05);
    into.set(next[0], 1.4, next[2]);
    h.pointAt = into;

    handshake.member = chair.member.id;
    handshake.weight = window01(u, 0.33, 0.64, 0.05);
    handshake.pump = window01(u, 0.4, 0.6, 0.02);

    // The camera glances at the Chairperson as they come over.
    const a = npcAnchors.get(chair.member.id);
    if (a) focusOn(0, a.head, window01(u, 0.08, 0.76, 0.12) * 0.7);

    others.forEach((m, i) => {
      const k = cue(m.member.id);
      k.look = ramp01(u, 0.04 + i * 0.05, 0.12 + i * 0.05);
      k.turn = k.look * 0.6;
      k.wave = window01(u, 0.6 + i * 0.03, 0.74 + i * 0.03, 0.03);
    });
  });

  return null;
}
