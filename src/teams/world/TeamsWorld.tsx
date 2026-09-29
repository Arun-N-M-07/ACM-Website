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
import { type Group, HalfFloatType, type Material, type Object3D, type Texture, Vector3, WebGLRenderTarget } from 'three';
import { useExperience } from '@/store/experience';
import { useLightAnchor } from '@/systems/lighting/lightPool';
import { smoothstep } from '@/systems/camera/pose';
import { cardCenter, composition, O } from '../layout';
import { teams, teamsFrame } from '../state';
import { Backdrop } from './Backdrop';
import { DomainCards } from './DomainCards';
import { teamsEnvironment } from './environment';
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

  // (Shared for the renderer's life — see environment.ts: never disposed per visit.)
  const env = useMemo(() => teamsEnvironment(gl), [gl]);

  // The frosted cards' transmission pass redraws only the spine behind them;
  // on smaller tiers it runs at reduced resolution (it's blurred anyway), and
  // a device that can't keep up (experience.degrade) steps it down the same way.
  const quality = useExperience((s) => s.quality);
  const degrade = useExperience((s) => s.degrade);
  useEffect(() => {
    const r = gl as typeof gl & { transmissionResolutionScale?: number };
    const level = Math.max(0, (quality === 'high' ? 2 : quality === 'medium' ? 1 : 0) - degrade);
    r.transmissionResolutionScale = [0.5, 0.75, 1][level];
    return () => {
      r.transmissionResolutionScale = 1;
    };
  }, [gl, quality, degrade]);

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
      // Parts hidden at this moment compile now too, so revealing one never waits on a shader.
      const hidden: Object3D[] = [];
      g.traverse((o) => {
        if (!o.visible) {
          hidden.push(o);
          o.visible = true;
        }
      });
      let materials: Set<Material>;
      // (Twice: for the canvas, and for a render target — inside this world everything is drawn
      // through the post-processing composer (teams/post), and three links a separate program for
      // drawing into a target (no tone mapping, linear output). Without it those programs linked the
      // first frame the world was seen — a dropped frame as the loop came round into it.)
      const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
      const previous = gl.getRenderTarget();
      try {
        materials = gl.compile(g, camera, scene) as unknown as Set<Material>;
        gl.setRenderTarget(target);
        gl.compile(g, camera, scene);
      } catch {
        hidden.forEach((o) => (o.visible = false));
        return done();
      } finally {
        gl.setRenderTarget(previous);
        target.dispose();
      }
      hidden.forEach((o) => (o.visible = false));
      // …and its textures uploaded now too (the card faces, the spine's maps): compiling doesn't upload
      // them, and the first frame the world is seen would otherwise do it all at once.
      const uploaded = new Set<Texture>();
      const upload = (v: unknown) => {
        const t = v as Texture & { isRenderTargetTexture?: boolean };
        if (t && t.isTexture && !t.isRenderTargetTexture && !uploaded.has(t)) {
          uploaded.add(t);
          gl.initTexture(t);
        }
      };
      for (const m of materials) {
        for (const v of Object.values(m)) upload(v);
        const uniforms = (m as Material & { uniforms?: Record<string, { value?: unknown }> }).uniforms;
        if (uniforms) for (const u of Object.values(uniforms)) upload(u?.value);
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
    if (turn > 0.01) {
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
    pointerLight.position.lerp(_goal, 1 - Math.exp(-dt * (turn > 0.01 ? 6 : 10)));
    const prox = f.hover >= 0 ? f.hoverAmt[f.hover] : 0;
    const pointerGain = f.inside && f.pointer.active && !reduced ? (0.07 + 0.06 * prox) * (1 - f.focus) : 0;
    pointerLight.gain = Math.max(pointerGain, 0.12 * turn);
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
      <Tunnel />
    </group>
  );
}
