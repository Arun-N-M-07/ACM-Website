'use client';
/**
 * TeamsWorld — the scene on the other side of the portal.
 *
 * It mounts while the visitor walks down the vestibule, builds its studio
 * reflections, compiles every material against the real light rig (so the
 * crossing never hitches), then hides until the camera arrives.
 *
 * Lighting: the site keeps one constant light rig (adding lights would
 * recompile every shader), so this world borrows it — WorldLights turns its
 * key and fill to this world when `world.teams` is 1, and the pooled point
 * lights are drawn here by an anchor that follows the pointer (so highlights
 * slide over the spine and glass as you move).
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { type Group, type Material, type Object3D, Vector3 } from 'three';
import { useExperience } from '@/store/experience';
import { useLightAnchor } from '@/systems/lighting/lightPool';
import { smoothstep } from '@/systems/camera/pose';
import { cardCenter, composition, O } from '../layout';
import { teams, teamsFrame } from '../state';
import { Backdrop } from './Backdrop';
import { DomainCards } from './DomainCards';
import { DomainInterior, roomPoint } from './DomainInterior';
import { buildTeamsEnvironment } from './environment';
import { ParticleField } from './ParticleField';
import { Spine } from './Spine';
import { Tunnel } from './Tunnel';
import { TeamEntrance } from './TeamEntrance';

const _cam = new Vector3();
const _ray = new Vector3();
const _goal = new Vector3();

export function TeamsWorld() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const comp = useMemo(() => composition(size.width / Math.max(1, size.height)), [size.width, size.height]);
  const group = useRef<Group>(null);
  const ready = useRef(false);

  const env = useMemo(() => buildTeamsEnvironment(gl), [gl]);
  useEffect(() => () => env.dispose(), [env]);

  // The frosted cards' transmission pass redraws only the spine behind them;
  // on smaller tiers it runs at reduced resolution (it's blurred anyway).
  const quality = useExperience((s) => s.quality);
  useEffect(() => {
    const r = gl as typeof gl & { transmissionResolutionScale?: number };
    r.transmissionResolutionScale = quality === 'high' ? 1 : quality === 'medium' ? 0.75 : 0.5;
    return () => {
      r.transmissionResolutionScale = 1;
    };
  }, [gl, quality]);

  // Compile everything ahead of the crossing (visible for the compile, hidden
  // after), once per mount. The programs link in parallel where the driver
  // supports it; readiness is polled here rather than with compileAsync,
  // because a material rebuilt mid-compile (a quality or layout change) makes
  // three's own poller throw from inside its timer.
  useEffect(() => {
    let alive = true;
    let poll = 0;
    ready.current = false;
    const done = () => {
      if (alive) ready.current = true;
    };
    const id = window.setTimeout(() => {
      const g = group.current;
      if (!alive || !g) return done();
      g.visible = true;
      // Hidden parts (the domains' rooms) compile now too, so entering one never waits on a shader.
      const hidden: Object3D[] = [];
      g.traverse((o) => {
        if (!o.visible) {
          hidden.push(o);
          o.visible = true;
        }
      });
      let materials: Set<Material>;
      try {
        materials = gl.compile(g, camera, scene) as unknown as Set<Material>;
      } catch {
        hidden.forEach((o) => (o.visible = false));
        return done();
      }
      hidden.forEach((o) => (o.visible = false));
      const started = performance.now();
      const check = () => {
        if (!alive) return;
        let pending = false;
        for (const m of materials) {
          const program = (gl.properties.get(m) as { currentProgram?: { isReady?: () => boolean } }).currentProgram;
          if (program?.isReady && !program.isReady()) {
            pending = true;
            break;
          }
        }
        if (!pending || performance.now() - started > 8000) done();
        else poll = window.setTimeout(check, 40);
      };
      check();
    }, 450);
    return () => {
      alive = false;
      window.clearTimeout(id);
      window.clearTimeout(poll);
    };
  }, [gl, camera, scene]);

  // The pointer's light (the soft glint that follows it across the glass).
  const pointerLight = useLightAnchor([O.x, O.y, O.z], '#fff0f3', 0.9, 10);

  useFrame(({ camera: cam }, dt) => {
    const g = group.current;
    if (!g) return;
    const f = teamsFrame;
    const st = teams().state;
    const show = f.inside || st === 'portalEntering' || st === 'portalExiting';
    g.visible = ready.current ? show : true;
    // The pointer's light rides the pointer ray between the lens and the cards
    // (following the short damped field, not the slow channel), so its sheen
    // slides broadly over the spine and glass instead of burning a spot under
    // the cursor; near a card it warms a little. (The card's own material
    // answers the exact point touched.)
    _cam.setFromMatrixPosition(cam.matrixWorld);
    const reduced = useExperience.getState().reducedMotion;
    // A card chosen: the light turns to it — it slides to just in front of the
    // plate and warms a little as the plate comes forward, and fades as the
    // eye closes in.
    const turn = reduced ? 0 : f.commit * (1 - smoothstep(0.35, 0.65, f.focus));
    // Inside a domain the same light is the room's key: warm, above its centrepiece (CORE: down its axis).
    const room = smoothstep(0.6, 0.9, f.focus);
    if (room > 0.01 && teams().selected !== null) {
      const k = teams().selected!;
      const core = k === 0;
      // Above and just ahead of the eye, off the axis: a key on the people and the
      // piece whose highlight falls away from the lens (no glint on the pane's edge).
      roomPoint(k, comp, core ? 0 : comp.portrait ? 0.2 : 0.4, comp.portrait ? 2.0 : 2.3, core ? -3.4 : comp.portrait ? -3.8 : -1.7, _goal);
    } else if (turn > 0.01) {
      // High and well in front, so its reflection in the coat sits at the top edge, not mid-card.
      cardCenter(f.focusK, comp, _goal, 3.5);
      _goal.y += 1.6;
    } else {
      _ray.set(f.pointer.fx, f.pointer.fy, 0.5).unproject(cam).sub(_cam).normalize();
      const reach = Math.max(1.2, _cam.distanceTo(O) - comp.radius);
      _goal.copy(_cam).addScaledVector(_ray, reach * 0.22);
      // Lifted well above the ray: its reflection in the cards' coat then rides
      // their top edge with the pointer instead of sitting mid-card on the type.
      _goal.y += reach * 0.4;
    }
    pointerLight.position.lerp(_goal, room > 0.01 ? 1 : 1 - Math.exp(-dt * (turn > 0.01 ? 6 : 10)));
    const prox = f.hover >= 0 ? f.hoverAmt[f.hover] : 0;
    const pointerGain = f.inside && f.pointer.active && !reduced ? (0.07 + 0.06 * prox) * (1 - f.focus) : 0;
    pointerLight.gain = Math.max(pointerGain, 0.12 * turn, 1.1 * room);
  });

  return (
    <group ref={group} name="teams-world">
      <Backdrop />
      <TeamEntrance env={env} comp={comp} />
      <group position={O}>
        <Spine env={env} comp={comp} />
      </group>
      <ParticleField comp={comp} />
      <DomainCards comp={comp} env={env} />
      <DomainInterior comp={comp} env={env} />
      <Tunnel />
    </group>
  );
}
