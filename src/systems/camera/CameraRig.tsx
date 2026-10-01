'use client';
/**
 * The camera system. One component owns the camera for the whole journey —
 * the opening cinematic, the scroll journey to the Teams world, and the travel
 * through the portal between.
 *
 * Every frame:
 *   1. damp raw scroll progress → progress.value, publish to overlays
 *   2. derive segment / chapter / the event visited → store (on change); hand the
 *      progress to the opening (src/intro: its beat is progress, rescaled);
 *      run the Teams controller (portal hold, walls, hover)
 *   3. evaluate the shot: within the opening, its camera at that beat; after
 *      it, the scroll-driven cinematic (with the portal hold's pull and dolly
 *      layered on); or — travelling or inside — the Teams shot
 *   4. layer hand-held drift, apply
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { PerspectiveCamera } from 'three';
import { CAMERA_RESPONSE } from '@/config/camera';
import { chapterForSegment, INTRO_PROGRESS_END, segmentAt } from '@/config/timeline';
import { INTRO_MAX_BEATS_PER_SECOND, INTRO_SPAN } from '@/intro/timeline';
import { evaluateIntroShot } from '@/intro/camera';
import { syncIntro } from '@/intro/controller';
import { introFrame } from '@/intro/state';
import { experience } from '@/store/experience';
import { world } from '@/scenes/shared/blend';
import { progress } from '@/systems/scroll/progress';
import { applyPortalHold } from '@/teams/camera';
import { evaluateTeamsShot, teamsCameraActive, updateTeams } from '@/teams/controller';
import { teamsFrame } from '@/teams/state';
import { stepEventsTrack, updateEvents } from '@/scenes/events/controller';
import { eventsFrame } from '@/scenes/events/state';
import { fx } from './effects';
import { copyPose, emptyPose } from './pose';
import { cinematic, evaluateCinematic, nearestStop } from './shots';

/** The opening's fastest follow rate, in progress units per second. */
const INTRO_MAX_RATE = (INTRO_MAX_BEATS_PER_SECOND / INTRO_SPAN) * INTRO_PROGRESS_END;

export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const pose = useRef(emptyPose());
  const shot = useRef(emptyPose());
  const lastStop = useRef(-1);
  const fadingOut = useRef(false);
  const lastPos = useRef({ x: 0, y: 0, z: 0 });
  /** The hand-held drift fades in after the intro hands over (no snap at the handoff). */
  const driftIn = useRef(1);

  useEffect(() => {
    camera.rotation.order = 'YXZ';
    camera.near = CAMERA_RESPONSE.near;
    camera.far = CAMERA_RESPONSE.far;
    camera.updateProjectionMatrix();
  }, [camera]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const st = experience();
    const time = clock.elapsedTime;
    // (The Events' walls, and their join at the matrix — before the scroll is followed: controller.ts.)
    stepEventsTrack(dt);

    // 1 ─ progress
    progress.cut = false;
    if (st.reducedMotion) {
      progress.snap = false;
      progress.snapLead = 0;
      if (progress.pending) {
        // A change of place asked for — the loop (JourneyLoop, navigation.stepStop), or a chapter asked
        // for just before reduced motion came on — is made in the dark: the picture goes down, the
        // world is exchanged, and the still it lands on comes up.
        fx.fade = Math.min(1, fx.fade + dt * 5);
        if (fx.fade >= 1) {
          const run = progress.pending;
          progress.pending = null;
          run();
          lastStop.current = nearestStop(progress.target);
          progress.value = lastStop.current;
          fadingOut.current = false;
        }
      } else {
        // Cut between framed stills behind a short fade instead of flying.
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
        } else if (st.phase !== 'travel') fx.fade = Math.max(0, fx.fade - dt * 4);
      }
    } else {
      lastStop.current = -1;
      // A chapter change: the picture dims first (the camera where it is), and only at black does
      // the journey move — then it comes up on the new place.
      if (progress.pending) {
        fx.fade = Math.min(1, fx.fade + dt / 0.38);
        if (fx.fade >= 1) {
          const run = progress.pending;
          progress.pending = null;
          run();
        }
      }
      if (progress.snap) {
        progress.snap = false;
        progress.cut = true;
        progress.value = progress.target - progress.snapLead;
        progress.snapLead = 0;
        if (progress.snapFade) fx.fade = 1;
        progress.snapFade = true;
      }
      const k = 1 - Math.exp(-dt * CAMERA_RESPONSE.progressDamping);
      let step = (progress.target - progress.value) * k;
      // Within the opening the camera follows the scroll no faster than a
      // cinematic maximum, so even a hard fling reads as a move.
      if (progress.value < INTRO_PROGRESS_END && progress.target < INTRO_PROGRESS_END + 0.02) {
        const cap = INTRO_MAX_RATE * dt;
        step = Math.max(-cap, Math.min(cap, step));
      }
      progress.value += step;
      if (Math.abs(progress.target - progress.value) < 1e-6) progress.value = progress.target;
      if (st.phase !== 'travel' && !progress.pending) {
        fx.fade = Math.max(0, fx.fade - dt * progress.fadeInRate);
        if (fx.fade === 0) progress.fadeInRate = 2.5;
      }
    }
    progress.publish(dt);

    // 2 ─ discrete state
    syncIntro(progress.value);
    const inIntro = introFrame.active;
    const seg = segmentAt(progress.value);
    if (seg !== st.segment) st.set({ segment: seg, chapter: chapterForSegment(seg) });
    const shown = eventsFrame.view;
    const active = seg === 'events' && shown.index >= 0 && shown.enter > 0.5 ? shown.index : -1;
    if (active !== st.activeRoom) st.set({ activeRoom: active });
    updateTeams(dt, camera);

    // 3 ─ shot
    const inTeams = teamsCameraActive();
    const cinematicShot = !inIntro && !inTeams;
    if (inIntro) evaluateIntroShot(time, camera.aspect, shot.current, st.reducedMotion);
    else if (inTeams) evaluateTeamsShot(dt, time, camera.aspect, shot.current, shot.current, st.reducedMotion);
    else evaluateCinematic(progress.value, shot.current, camera.aspect);
    // (The Events: what the hall and its interface show, and the matrix's lean with the pointer.)
    updateEvents(dt, shot.current, cinematicShot, st.reducedMotion);
    if (cinematicShot) applyPortalHold(shot.current, teamsFrame.hold, time, st.reducedMotion);
    // The space the camera is in: inside an event's room, the room's own scale (its small motions with it).
    const space = cinematicShot ? cinematic.scale : 1;
    const composed = cinematicShot ? cinematic.composed : 0;
    fx.blur = 0;
    fx.vignette = !inTeams && world.underground > 0.02 && world.underground < 0.98 ? 0.25 : 0;

    // 4 ─ drift, apply
    const p = pose.current;
    copyPose(shot.current, p);
    // (The intro camera carries its own breath.)
    driftIn.current = inIntro ? 0 : Math.min(1, driftIn.current + dt / 1.5);
    if (!st.reducedMotion && st.phase !== 'travel' && !inIntro) {
      const d = (teamsFrame.inside ? 0.35 : 1) * driftIn.current * driftIn.current;
      p.yaw += Math.sin(time * 0.31) * CAMERA_RESPONSE.driftAngle * d;
      p.pitch += Math.sin(time * 0.23 + 1.3) * CAMERA_RESPONSE.driftAngle * 0.7 * d;
      p.y += Math.sin(time * 0.41 + 0.4) * CAMERA_RESPONSE.driftPosition * d * space;
    }

    // Portrait phones: interiors are staged wide (the departures board, room
    // walls, the portal), so below ground the lens opens to keep roughly the
    // horizontal coverage a landscape screen would have. The Teams world is
    // composed for portrait itself (teams/layout), and so are the Events'
    // matrix and bays (scenes/events/track: `composed`), so they are left alone.
    let fov = p.fov;
    if (camera.aspect < 1 && world.underground > 0.5 && !teamsFrame.inside && !inIntro && composed < 1) {
      const widen = 1 + (Math.min(2.1, 1 + (1 / camera.aspect - 1) * 0.9) - 1) * (1 - composed);
      fov = Math.min(110, (2 * Math.atan(Math.tan((p.fov * Math.PI) / 360) * widen) * 180) / Math.PI);
      // …and steps back a little (every interior shot has room behind it — at its own scale).
      const back = Math.min(2, (1 / camera.aspect - 1) * 1.6) * (1 - teamsFrame.hold) * (1 - composed) * space;
      p.x += Math.sin(p.yaw) * back;
      p.z += Math.cos(p.yaw) * back;
    }
    // Depth precision: the near plane scales with altitude above ground so the
    // campus's flat layers (lawns, paving, roads) never z-fight from the drone,
    // and stays close for the interiors.
    const near = world.underground < 0.5 && p.y > 0.4 ? Math.min(3, Math.max(0.25, p.y * 0.12)) : CAMERA_RESPONSE.near * space;
    camera.position.set(p.x, p.y, p.z);
    camera.rotation.set(p.pitch, p.yaw, p.roll, 'YXZ');
    if (Math.abs(camera.fov - fov) > 0.001 || Math.abs(camera.near - near) > near * 0.02) {
      camera.fov = fov;
      camera.near = near;
      camera.updateProjectionMatrix();
    }
    // An event's record: the room's picture goes up the screen with the page as the record's black
    // canvas comes up under it — the same lens, the same room, scrolled (its foot is the canvas's
    // top edge: scenes/events/controller, view.unfold — how much of the screen the canvas has).
    const lift = st.phase === 'cinematic' && !st.reducedMotion && !inTeams && !inIntro ? eventsFrame.view.unfold : 0;
    const vo = camera.view;
    if (lift > 0) {
      const y = lift * size.height;
      if (!vo || !vo.enabled || vo.fullWidth !== size.width || vo.fullHeight !== size.height || Math.abs(vo.offsetY - y) > 0.05) camera.setViewOffset(size.width, size.height, 0, y, size.width, size.height);
    } else if (vo && vo.enabled) camera.clearViewOffset();
    camera.updateMatrixWorld();

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
