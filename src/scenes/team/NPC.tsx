'use client';
/**
 * A team member: body (procedural rig or GLB) + name tag, driven by the
 * choreography cue their domain's set writes each frame. Without a cue they
 * keep working and glance up when the visitor walks past.
 */
import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { type Group, type Material, type Object3D, Vector3 } from 'three';
import { avatarModelPath } from '@/config/assets';
import { FLOOR_Y } from '@/config/world';
import { domainById } from '@/content/domains';
import { isAvailable } from '@/content/media';
import type { TeamMember } from '@/content/team';
import { hashString } from '@/lib/random';
import { experience } from '@/store/experience';
import { angleDelta, lerpAngle } from '@/systems/camera/pose';
import { resolveAppearance } from '@/systems/characters/appearance';
import { blankCue, cues } from '@/systems/characters/cues';
import { applyPose, basePose, createPose, overlayHandshake, overlayLook, overlayPoint, overlayWalk, overlayWave } from '@/systems/characters/poses';
import { npcAnchors } from '@/systems/characters/registry';
import { trackAnchor } from '@/systems/anchors/anchors';
import { buildAvatar } from '@/systems/characters/rig';
import { text } from '@/systems/textures/typeset';
import { CanvasPanel } from '../shared/CanvasPanel';
import { SafeBoundary } from '../shared/SafeBoundary';
import type { MemberPlacement } from './teamLayout';

interface Props {
  placement: MemberPlacement;
  material: Material;
}

const EMPTY = blankCue();

function NameTag({ member, weight }: { member: TeamMember; weight: { current: number } }) {
  const g = useRef<Group>(null);
  useFrame(({ camera }) => {
    const el = g.current;
    if (!el) return;
    el.scale.setScalar(Math.max(0.0001, weight.current));
    el.visible = weight.current > 0.02;
    el.quaternion.copy(camera.quaternion);
  });
  return (
    <group ref={g}>
      <CanvasPanel
        width={1.15}
        height={0.27}
        pxPerMeter={420}
        shading="glow"
        glowStrength={0.95}
        transparent
        drawKey={`tag-${member.id}`}
        draw={(ctx, w, h) => {
          ctx.fillStyle = 'rgba(11,11,12,0.74)';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = domainById(member.domain).accent;
          ctx.fillRect(0, 0, h * 0.06, h);
          text(ctx, member.name, h * 0.22, h * 0.48, { family: 'sans', weight: 600, size: h * 0.3, color: '#efe9df' });
          text(ctx, member.role.toUpperCase(), h * 0.22, h * 0.8, { family: 'mono', size: h * 0.16, color: 'rgba(239,233,223,0.62)', tracking: 0.14 });
        }}
      />
    </group>
  );
}

/** Shared per-NPC motion state: position/facing follow the cue, walking derives from movement. */
function useMotion(p: MemberPlacement) {
  return useMemo(
    () => ({
      x: p.x,
      z: p.z,
      yaw: p.yaw,
      walk: 0,
      walkPhase: 0,
      look: 0,
      tag: 0,
    }),
    [p],
  );
}

function ProceduralNPC({ placement, material }: Props) {
  const { member } = placement;
  const appearance = useMemo(() => resolveAppearance(member), [member]);
  const rig = useMemo(() => buildAvatar(appearance, material), [appearance, material]);
  useEffect(() => () => rig.geometries.forEach((g) => g.dispose()), [rig]);
  const pose = useMemo(createPose, []);
  const phase = useMemo(() => (hashString(member.id) % 1000) / 37, [member.id]);
  const m = useMotion(placement);
  const tag = useRef<Group>(null);
  const tagWeight = useRef(0);
  const blink = useRef({ next: 2 + (phase % 3), until: 0 });
  const anchors = useMemo(() => ({ head: new Vector3(), hand: new Vector3(), position: new Vector3() }), []);
  const cam = useMemo(() => new Vector3(), []);

  useEffect(() => {
    npcAnchors.set(member.id, anchors);
    const untrack = trackAnchor(`npc:${member.id}`, () => anchors.head);
    return () => {
      npcAnchors.delete(member.id);
      untrack();
    };
  }, [member.id, anchors]);

  useFrame(({ clock, camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime + phase;
    const cue = cues.get(member.id) ?? EMPTY;
    camera.getWorldPosition(cam);

    // Position: follow the cue exactly (scrubbable); walking is inferred from movement.
    const tx = cue.pos ? cue.pos.x : placement.x;
    const tz = cue.pos ? cue.pos.z : placement.z;
    const dx = tx - m.x;
    const dz = tz - m.z;
    const moved = Math.hypot(dx, dz);
    m.x = tx;
    m.z = tz;
    const speed = moved / Math.max(dt, 1e-3);
    m.walk += (Math.min(1, speed / 0.9) - m.walk) * (1 - Math.exp(-dt * 10));
    m.walkPhase += moved * 5.4;

    // Facing: station → walking direction → toward the visitor.
    const toCam = Math.atan2(cam.x - m.x, cam.z - m.z);
    let yaw = cue.yaw ?? placement.yaw;
    if (moved > 0.004) yaw = Math.atan2(dx, dz);
    yaw = lerpAngle(yaw, toCam, cue.turn);
    m.yaw += angleDelta(m.yaw, yaw) * (1 - Math.exp(-dt * (moved > 0.004 ? 10 : 6)));

    // Glance up when the visitor passes close, even without a cue.
    const dist = Math.hypot(cam.x - m.x, cam.z - m.z);
    const passing = dist < 5.5 ? 1 - dist / 5.5 : 0;
    const lookTo = Math.max(cue.look, cues.has(member.id) ? 0 : passing * 0.8);
    m.look += (lookTo - m.look) * (1 - Math.exp(-dt * 5));

    const standing = !placement.seated || cue.stand > 0.5;
    const activity = cue.activity ?? placement.activity;
    basePose(pose, activity, t, placement.seated && !standing ? true : false, rig, m.walk > 0.1 || cue.extend > 0.05 || (placement.seated && standing));
    rig.root.position.set(m.x, FLOOR_Y + placement.y, m.z);
    rig.root.rotation.y = m.yaw + pose.bodyYaw * (1 - m.look);
    const rel = angleDelta(m.yaw, toCam);
    const pitch = Math.atan2(cam.y - (FLOOR_Y + placement.y + (standing ? 1.58 : 1.18)), Math.max(0.6, dist));
    overlayLook(pose, rel, pitch * 0.8, m.look);
    if (cue.point > 0 && cue.pointAt) {
      const pr = angleDelta(m.yaw, Math.atan2(cue.pointAt.x - m.x, cue.pointAt.z - m.z));
      const pp = Math.atan2(cue.pointAt.y - (FLOOR_Y + placement.y + 1.4), Math.max(0.5, Math.hypot(cue.pointAt.x - m.x, cue.pointAt.z - m.z)));
      overlayPoint(pose, pr, pp, cue.point);
    }
    overlayWave(pose, t, cue.wave);
    overlayHandshake(pose, t, cue.extend, cue.pump);
    overlayWalk(pose, m.walkPhase, m.walk);
    applyPose(rig, pose, dt, m.walk > 0.1 ? 12 : 8);

    // Talking and blinking.
    const talking = cue.talk > 0 || experience().speech?.memberId === member.id ? 1 : 0;
    rig.mouth.scale.y = 1 + talking * Math.abs(Math.sin(t * 13)) * 1.8;
    const b = blink.current;
    if (t > b.next) {
      b.until = t + 0.12;
      b.next = t + 2.5 + ((t * 7.3) % 3.5);
    }
    rig.eyes.scale.y = t < b.until ? 0.15 : 1;

    rig.head.getWorldPosition(anchors.head);
    anchors.head.y += rig.dims.H * 0.07;
    rig.handR.getWorldPosition(anchors.hand);
    anchors.position.set(m.x, 0, m.z);

    // Tags name people across the room; up close the face is enough.
    const tagWant = (m.look > 0.5 || talking ? 1 : 0) * Math.min(1, Math.max(0, (dist - 2.2) / 1.4));
    tagWeight.current += (tagWant - tagWeight.current) * (1 - Math.exp(-dt * 6));
    if (tag.current) tag.current.position.set(m.x, anchors.head.y + 0.32, m.z);
  });

  return (
    <>
      <primitive object={rig.root} />
      <group ref={tag}>
        <NameTag member={member} weight={tagWeight} />
      </group>
    </>
  );
}

/** GLB body: plays clips by name (Idle / <Activity> / Walk / Wave / Handshake). */
function GlbNPC({ placement, path }: Props & { path: string }) {
  const { member } = placement;
  const { scene, animations } = useGLTF(path);
  const root = useMemo(() => scene.clone(true), [scene]);
  const group = useRef<Group>(null);
  const { actions } = useAnimations(animations, group);
  const current = useRef<string | null>(null);
  const m = useMotion(placement);
  const head = useMemo(() => {
    let found: Object3D | null = null;
    root.traverse((o) => {
      if (!found && /head/i.test(o.name)) found = o;
    });
    return found as Object3D | null;
  }, [root]);
  const anchors = useMemo(() => ({ head: new Vector3(), hand: new Vector3(), position: new Vector3() }), []);
  useEffect(() => {
    npcAnchors.set(member.id, anchors);
    return () => {
      npcAnchors.delete(member.id);
    };
  }, [member.id, anchors]);

  useFrame(({ camera }, dt) => {
    const cue = cues.get(member.id) ?? EMPTY;
    const tx = cue.pos ? cue.pos.x : placement.x;
    const tz = cue.pos ? cue.pos.z : placement.z;
    const moved = Math.hypot(tx - m.x, tz - m.z);
    m.x = tx;
    m.z = tz;
    const toCam = Math.atan2(camera.position.x - m.x, camera.position.z - m.z);
    m.yaw = lerpAngle(cue.yaw ?? placement.yaw, toCam, cue.turn);
    const act = cue.activity ?? placement.activity;
    const clip = moved / Math.max(dt, 1e-3) > 0.3 ? 'Walk' : cue.extend > 0.5 ? 'Handshake' : cue.wave > 0.5 ? 'Wave' : act[0].toUpperCase() + act.slice(1);
    const name = actions[clip] ? clip : actions.Idle ? 'Idle' : null;
    if (name && name !== current.current) {
      if (current.current) actions[current.current]?.fadeOut(0.3);
      actions[name]?.reset().fadeIn(0.3).play();
      current.current = name;
    }
    if (group.current) {
      group.current.position.set(m.x, FLOOR_Y + placement.y, m.z);
      group.current.rotation.y = m.yaw;
    }
    if (head) {
      head.rotation.y += angleDelta(m.yaw, toCam) * 0.6 * cue.look;
      head.getWorldPosition(anchors.head);
    } else anchors.head.set(m.x, FLOOR_Y + 1.6, m.z);
    anchors.hand.set(m.x + Math.sin(m.yaw) * 0.45, FLOOR_Y + 1.05, m.z + Math.cos(m.yaw) * 0.45);
    anchors.position.set(m.x, 0, m.z);
  });

  return (
    <group ref={group}>
      <primitive object={root} />
    </group>
  );
}

export function NPC(props: Props) {
  const path = props.placement.member.model ?? avatarModelPath(props.placement.member.id);
  if (isAvailable(path)) {
    return (
      <SafeBoundary name={`avatar:${props.placement.member.id}`} fallback={<ProceduralNPC {...props} />}>
        <Suspense fallback={<ProceduralNPC {...props} />}>
          <GlbNPC {...props} path={path} />
        </Suspense>
      </SafeBoundary>
    );
  }
  return <ProceduralNPC {...props} />;
}
