'use client';
/**
 * The camera system. One component owns the camera for the whole journey —
 * arrival to the core — and the timed push through the door between.
 *
 * Every frame:
 *   1. damp raw scroll progress → progress.value, publish to overlays
 *   2. derive segment / chapter / active room / tour stop → store (on change)
 *   3. evaluate the shot for progress.value (or the impact timeline), then let
 *      the current meeting steer it (look at a laptop, take a seat…)
 *   4. layer hand-held drift, apply
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { type PerspectiveCamera, Vector3 } from 'three';
import { CAMERA_RESPONSE, IMPACT } from '@/config/camera';
import { chapterForSegment, IMPACT_TRIGGER, SEGMENTS, segmentAt } from '@/config/timeline';
import { experience } from '@/store/experience';
import { cameraFocus, tour } from '@/systems/characters/cues';
import { world } from '@/scenes/shared/blend';
import { progress } from '@/systems/scroll/progress';
import { placeScroll } from '@/systems/scroll/ScrollTimeline';
import { fx } from './effects';
import { evaluateImpact } from './impact';
import { aim, copyPose, emptyPose, lerp, lerpAngle } from './pose';
import { eventStationAt, evaluateCinematic, nearestStop } from './shots';
import { TOUR_STOPS, tourAt } from './tour';

export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const pose = useRef(emptyPose());
  const shot = useRef(emptyPose());
  const impactT = useRef(-1);
  const impactFrom = useRef(emptyPose());
  const lastStop = useRef(-1);
  const fadingOut = useRef(false);
  const lastTarget = useRef(progress.target);
  const lastPos = useRef({ x: 0, y: 0, z: 0 });
  // Smoothed look-at target for meetings: a person's head bobs and breathes;
  // the camera should follow their position, not every jiggle.
  const focusAt = useRef(new Vector3());
  const focusLive = useRef(false);

  useEffect(() => {
    camera.rotation.order = 'YXZ';
    camera.near = CAMERA_RESPONSE.near;
    camera.far = CAMERA_RESPONSE.far;
    camera.updateProjectionMatrix();
  }, [camera]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const st = experience();

    // 1 ─ progress
    const jumped = progress.snap;
    if (st.reducedMotion) {
      // Cut between framed stills behind a short fade instead of flying.
      progress.snap = false;
      const want = nearestStop(progress.target);
      if (lastStop.current < 0) {
        lastStop.current = want;
        progress.value = want;
      }
      if (want !== lastStop.current) fadingOut.current = true;
      if (fadingOut.current) {
        fx.fade = Math.min(1, fx.fade + dt * 5);
        if (fx.fade >= 1) {
          lastStop.current = want;
          progress.value = want;
          fadingOut.current = false;
        }
      } else fx.fade = Math.max(0, fx.fade - dt * 4);
    } else {
      lastStop.current = -1;
      if (progress.snap) {
        progress.snap = false;
        progress.value = progress.target;
        fx.fade = 1;
      }
      const k = 1 - Math.exp(-dt * CAMERA_RESPONSE.progressDamping);
      progress.value += (progress.target - progress.value) * k;
      if (Math.abs(progress.target - progress.value) < 1e-6) progress.value = progress.target;
      fx.fade = Math.max(0, fx.fade - dt * 2.5);
    }
    progress.publish(dt);

    // 2 ─ discrete state
    const seg = segmentAt(progress.value);
    if (seg !== st.segment) st.set({ segment: seg, chapter: chapterForSegment(seg) });
    const station = eventStationAt(progress.value);
    const active = seg === 'events' && station.index >= 0 && (station.dwell > 0 || station.travel > 0.8) ? station.index : -1;
    if (active !== st.activeRoom) st.set({ activeRoom: active });

    // The tour: which stop, how far walked in, how far through the meeting.
    const inTeam = st.phase === 'cinematic' && progress.value >= SEGMENTS.team.start;
    if (inTeam) {
      const t = tourAt(progress.value);
      tour.index = t.index;
      tour.walk = t.walk;
      tour.meet = t.meet;
    } else {
      tour.index = -1;
      tour.walk = 0;
      tour.meet = 0;
      cameraFocus.weight = 0;
    }
    tour.inTeam = inTeam;
    if (tour.index !== st.tourStop) st.set({ tourStop: tour.index, tourDomain: tour.index >= 0 ? TOUR_STOPS[tour.index].id : null });

    // Scrolling forward across the threshold pushes the visitor through the door.
    const target = progress.target;
    if (st.phase === 'cinematic' && !jumped && lastTarget.current < IMPACT_TRIGGER && target >= IMPACT_TRIGGER && target < SEGMENTS.team.start) {
      evaluateCinematic(Math.max(progress.value, IMPACT_TRIGGER - 0.01), impactFrom.current);
      impactT.current = 0;
      st.set({ phase: 'impact', menuOpen: false, dossier: null });
    }
    lastTarget.current = target;

    // 3 ─ shot
    if (st.phase === 'impact' && impactT.current >= 0) {
      impactT.current += dt / (st.reducedMotion ? 0.8 : IMPACT.duration);
      const t = Math.min(1, impactT.current);
const e = evaluateImpact(t, impactFrom.current, shot.current, st.reducedMotion);
      fx.blur = st.reducedMotion ? 0 : e.blur;
      fx.vignette = e.vignette;
      if (t >= 1) {
        // Hand over to the tour, right where the push lands: the welcome.
        fx.blur = 0;
        fx.vignette = 0;
        impactT.current = -1;
        st.set({ phase: 'cinematic' });
        // A hair past the boundary, so pixel rounding can't leave you in the doorway.
        const start = SEGMENTS.team.start + 0.0004;
        if (progress.target < start) placeScroll(start);
        lastTarget.current = Math.max(progress.target, start);
      }
    } else {
      if (st.phase === 'impact') st.set({ phase: 'cinematic' });
      evaluateCinematic(progress.value, shot.current);
      fx.blur = 0;
      fx.vignette = world.underground > 0.02 && world.underground < 0.98 ? 0.25 : 0;

      // A meeting can steer the camera: glance at someone, lean over a shoulder, take a seat.
      const f = cameraFocus;
      if (inTeam && f.weight > 0.0005) {
        if (!focusLive.current) focusAt.current.copy(f.target);
        else focusAt.current.lerp(f.target, 1 - Math.exp(-dt * 4));
        focusLive.current = true;
        const ft = focusAt.current;
        const s = shot.current;
        const w = f.weight;
        if (f.hasEye) {
          s.x = lerp(s.x, f.eye.x, w);
          s.y = lerp(s.y, f.eye.y, w);
          s.z = lerp(s.z, f.eye.z, w);
        }
        const a = aim([s.x, s.y, s.z], [ft.x, ft.y, ft.z]);
        s.yaw = lerpAngle(s.yaw, a.yaw, w);
        s.pitch = lerp(s.pitch, a.pitch, w);
        s.roll *= 1 - w;
        s.fov -= f.zoom * w;
      } else focusLive.current = false;
    }

    // 4 ─ drift, apply
    const p = pose.current;
    copyPose(shot.current, p);
    if (!st.reducedMotion && st.phase !== 'impact') {
      const t = clock.elapsedTime;
      const d = inTeam ? 0.5 : 1;
      p.yaw += Math.sin(t * 0.31) * CAMERA_RESPONSE.driftAngle * d;
      p.pitch += Math.sin(t * 0.23 + 1.3) * CAMERA_RESPONSE.driftAngle * 0.7 * d;
      p.y += Math.sin(t * 0.41 + 0.4) * CAMERA_RESPONSE.driftPosition * d;
    }

    // Portrait phones: interiors are staged wide (the departures board, room
    // walls, the team's sets), so below ground the lens opens to keep roughly
    // the horizontal coverage a landscape screen would have.
    let fov = p.fov;
    if (camera.aspect < 1 && world.underground > 0.5 && st.phase !== 'impact') {
      const widen = Math.min(2.1, 1 + (1 / camera.aspect - 1) * 0.9);
      fov = Math.min(95, (2 * Math.atan(Math.tan((p.fov * Math.PI) / 360) * widen) * 180) / Math.PI);
      // …and steps back a little (every interior shot has room behind it).
      const back = Math.min(2, (1 / camera.aspect - 1) * 1.6);
      p.x += Math.sin(p.yaw) * back;
      p.z += Math.cos(p.yaw) * back;
    }
    // Depth precision: the near plane scales with altitude above ground so the
    // campus's flat layers (lawns, paving, roads) never z-fight from the drone,
    // and stays close for the interiors.
    const near = world.underground < 0.5 && p.y > 0.4 ? Math.min(3, Math.max(0.25, p.y * 0.12)) : CAMERA_RESPONSE.near;
    camera.position.set(p.x, p.y, p.z);
    camera.rotation.set(p.pitch, p.yaw, p.roll, 'YXZ');
    if (Math.abs(camera.fov - fov) > 0.001 || Math.abs(camera.near - near) > near * 0.02) {
      camera.fov = fov;
      camera.near = near;
      camera.updateProjectionMatrix();
    }

    // Camera speed for audio / effects.
    const lp = lastPos.current;
    const v = Math.hypot(p.x - lp.x, p.y - lp.y, p.z - lp.z) / Math.max(dt, 1e-3);
    world.cameraSpeed += (Math.min(v, 120) - world.cameraSpeed) * (1 - Math.exp(-dt * 4));
    lp.x = p.x;
    lp.y = p.y;
    lp.z = p.z;
  });

  return null;
}
