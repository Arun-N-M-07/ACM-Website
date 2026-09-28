/**
 * The Teams world's reflections: a small procedural "light-box" rendered once
 * into a prefiltered environment map (PMREM) and assigned to the spine and
 * card materials directly (the facility keeps its own scene.environment).
 *
 * The box is dark with a faint blue-violet wash (teal high on one side,
 * violet low on the other), two tall soft strips (cool left, rose right), a
 * ring light overhead and a few small hard glints. On a metallic, iridescent
 * surface those become the long bright seams and colour shifts that make the
 * spine read as a real object — no lights added to the scene, so no shader
 * recompiles.
 */
import {
  BackSide,
  Color,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  type Texture,
  type WebGLRenderer,
} from 'three';

/**
 * One environment per renderer, made the first time the Teams world mounts and kept: it never
 * changes, and rebuilding it on every visit leaked a prefiltered render target each time (the map
 * is the target's texture — disposing the texture doesn't free the target — and a factory run twice
 * in development left one behind unowned), so a looping journey built them up.
 */
const environments = new WeakMap<WebGLRenderer, Texture>();
export function teamsEnvironment(gl: WebGLRenderer): Texture {
  let env = environments.get(gl);
  if (!env) {
    env = buildTeamsEnvironment(gl);
    environments.set(gl, env);
  }
  return env;
}

function buildTeamsEnvironment(gl: WebGLRenderer): Texture {
  const scene = new Scene();
  const disposables: { dispose: () => void }[] = [];
  const add = (geo: PlaneGeometry | SphereGeometry | TorusGeometry, color: Color, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0]) => {
    const mat = new MeshBasicMaterial({ color, side: 2 });
    const m = new Mesh(geo, mat);
    m.position.set(...pos);
    m.rotation.set(...rot);
    m.lookAt(0, pos[1] * 0.5, 0);
    scene.add(m);
    disposables.push(geo, mat);
  };

  const skyGeo = new SphereGeometry(40, 48, 24);
  const skyMat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vec3 base = vec3(0.012, 0.014, 0.02);
        float teal = smoothstep(-0.2, 1.0, dot(vDir, normalize(vec3(0.7, 0.6, 0.2))));
        float violet = smoothstep(-0.1, 1.0, dot(vDir, normalize(vec3(-0.6, -0.5, 0.3))));
        vec3 c = base + vec3(0.03, 0.09, 0.1) * teal * teal + vec3(0.09, 0.04, 0.14) * violet * violet;
        c += vec3(0.02) * smoothstep(0.6, 1.0, vDir.y);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new Mesh(skyGeo, skyMat));
  disposables.push(skyGeo, skyMat);

  add(new PlaneGeometry(2.2, 22), new Color('#cfdcff').multiplyScalar(5), [-11, 1, 5]);
  add(new PlaneGeometry(1.6, 18), new Color('#ffc6d6').multiplyScalar(3.6), [10, -1, 3]);
  add(new PlaneGeometry(1.2, 14), new Color('#b9a6ff').multiplyScalar(1.6), [3, -2, -12]);
  add(new PlaneGeometry(6, 0.5), new Color('#ffffff').multiplyScalar(2.2), [0, 6, 12]);
  const ring = new TorusGeometry(7, 0.35, 8, 64);
  add(ring, new Color('#f2f4ff').multiplyScalar(1.7), [0, 14, 0], [Math.PI / 2, 0, 0]);
  // Glints.
  for (const [x, y, z, c] of [
    [-6, 8, -8, '#ffffff'],
    [7, 5, -6, '#ffe7f0'],
    [-9, -6, -2, '#dfe8ff'],
    [5, -9, 8, '#ffffff'],
  ] as const) add(new PlaneGeometry(0.7, 0.7), new Color(c).multiplyScalar(4), [x, y, z]);

  const pmrem = new PMREMGenerator(gl);
  const env = pmrem.fromScene(scene, 0.035).texture;
  pmrem.dispose();
  disposables.forEach((d) => d.dispose());
  return env;
}
