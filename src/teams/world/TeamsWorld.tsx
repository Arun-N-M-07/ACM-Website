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
import { type Group, type Material, Vector3 } from 'three';
import { useExperience } from '@/store/experience';
import { useLightAnchor } from '@/systems/lighting/lightPool';
import { composition, O } from '../layout';
import { teams, teamsFrame } from '../state';
import { Backdrop } from './Backdrop';
import { DomainCards } from './DomainCards';
import { DomainInterior } from './DomainInterior';
import { buildTeamsEnvironment } from './environment';
import { ParticleField } from './ParticleField';
import { Spine } from './Spine';
import { Tunnel } from './Tunnel';
import { TeamEntrance } from './TeamEntrance';

const _cam = new Vector3();
const _ray = new Vector3();

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
      let materials: Set<Material>;
      try {
        materials = gl.compile(g, camera, scene) as unknown as Set<Material>;
      } catch {
        return done();
      }
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

  useFrame(({ camera: cam }) => {
    const g = group.current;
    if (!g) return;
    const st = teams().state;
    const show = teamsFrame.inside || st === 'portalEntering' || st === 'portalExiting';
    g.visible = ready.current ? show : true;
    // The pointer's light: along the pointer ray, just in front of the cards.
    _cam.setFromMatrixPosition(cam.matrixWorld);
    _ray.set(teamsFrame.pointer.sx, teamsFrame.pointer.sy, 0.5).unproject(cam).sub(_cam).normalize();
    // Between the lens and the cards, so its highlight slides broadly rather than burning a spot.
    pointerLight.position.copy(_cam).addScaledVector(_ray, Math.max(1.2, (_cam.distanceTo(O) - comp.radius) * 0.22));
    pointerLight.gain = teamsFrame.inside && teamsFrame.pointer.active && !useExperience.getState().reducedMotion ? 0.18 * (1 - teamsFrame.focus) : 0;
  });

  return (
    <group ref={group} name="teams-world">
      <Backdrop />
      <TeamEntrance env={env} />
      <group position={O}>
        <Spine env={env} />
      </group>
      <ParticleField comp={comp} />
      <DomainCards comp={comp} env={env} />
      <DomainInterior comp={comp} />
      <Tunnel />
    </group>
  );
}
