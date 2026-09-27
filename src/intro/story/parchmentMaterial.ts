/**
 * The parchment's material: a physical sheet (MeshStandardMaterial — the
 * world's light falls on it, the mist swallows it at distance) with the
 * artefact's life written into its shaders.
 *
 * Vertex: the sheet is not flat — a gentle bend across its width, corners
 * with the memory of having been rolled, a slow flutter in the air (more at
 * the edges), and where the fire has passed, the paper curls up and away.
 * Normals are rebuilt from the deformation, so light rakes across every fold.
 *
 * Fragment:
 *   paper   tone from the texture between old-paper light and stain; edges
 *           darker and browner (aged), the back plainer and darker
 *   ink     surfaces rather than prints: each line in order, left to right,
 *           soft and faint first and then sharp — a memory becoming visible
 *   fire    ahead of the front the paper browns with heat; at the front it
 *           chars, carries a thin ember line (small, never a flame), and
 *           behind it there is no paper. The words go with the paper.
 *
 * Arrival: the sheet condenses where it hangs — its torn edge draws itself
 * first as a faint pale line, then the fibres fill in from the edges towards
 * the middle (along the paper's grain, not as a wipe), a faint cool light on
 * the forming front; only then does the ink surface. The opposite of the
 * fire: making, not unmaking. The torn edge and the fire's front are
 * antialiased in the shader.
 */
import { Color, DoubleSide, MeshStandardMaterial, type Texture, Vector2, Vector4 } from 'three';

export interface ParchmentUniforms {
  uTex: { value: Texture };
  uNoise: { value: Texture };
  uSize: { value: Vector2 };
  uReveal: { value: number };
  uBurn: { value: number };
  uTime: { value: number };
  uFlutter: { value: number };
  uCurl: { value: number };
  uSeed: { value: number };
  uPresence: { value: number };
  uForm: { value: number };
  uFill: { value: number };
  uLines: { value: Vector4[] };
  uLineCount: { value: number };
  uPaperLight: { value: Color };
  uPaperDark: { value: Color };
  uInk: { value: Color };
  uChar: { value: Color };
  uEmber: { value: Color };
}

const VERTEX_PARS = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uSize;
uniform float uBurn, uTime, uFlutter, uCurl, uSeed;
vec3 deformSheet(vec2 uv) {
  vec2 p = (uv - 0.5) * uSize;
  vec2 q = abs(uv - 0.5) * 2.0;
  float z = 0.0;
  // A gentle bend across the width, and a little sag.
  z += p.x * p.x * 0.085 * uCurl - p.y * p.y * 0.03 * uCurl;
  // Corners remember being rolled.
  float corner = pow(q.x, 4.0) * pow(q.y, 2.0);
  z += corner * 0.06 * uCurl;
  // The air: slow travelling waves, stronger towards the edges.
  float edge = max(q.x, q.y);
  z += sin(p.x * 3.4 + uTime * 1.3 + uSeed) * cos(p.y * 2.7 - uTime * 0.9 + uSeed * 0.5) * uFlutter * (0.35 + 0.65 * edge);
  z += sin(p.y * 5.1 + uTime * 2.1 + uSeed * 1.7) * uFlutter * 0.25 * edge;
  // Fire: behind the front, the paper curls up and away from you. (Nothing
  // curls before the match is struck, and outside the torn silhouette the
  // burn channel means nothing — there it burns last — or the cells along
  // the torn edge would warp into steps.)
  vec4 tx = texture2D(uTex, uv);
  float bt = tx.a > 0.02 ? tx.b : 1.0;
  float local = uBurn * 1.28 - bt;
  float curl = smoothstep(-0.14, 0.06, local) * smoothstep(0.0, 0.025, uBurn);
  z -= curl * curl * 0.07;
  vec2 pull = normalize(p + 1e-4) * curl * curl * 0.025;
  return vec3(p - pull, z);
}
`;

const VERTEX_NORMAL = /* glsl */ `
vec3 sheetPos = deformSheet(uv);
float eS = 0.004;
vec3 sheetDx = deformSheet(uv + vec2(eS, 0.0)) - sheetPos;
vec3 sheetDy = deformSheet(uv + vec2(0.0, eS)) - sheetPos;
vec3 objectNormal = normalize(cross(sheetDx, sheetDy));
#ifdef USE_TANGENT
  vec3 objectTangent = vec3( tangent.xyz );
#endif
`;

const FRAGMENT_PARS = /* glsl */ `
uniform sampler2D uTex;
uniform sampler2D uNoise;
uniform float uReveal, uBurn, uTime, uPresence, uFill, uForm;
uniform vec2 uSize;
uniform vec4 uLines[5];
uniform int uLineCount;
uniform vec3 uPaperLight, uPaperDark, uInk, uChar, uEmber;
/** 0..1: when this point's ink surfaces (lines in order, each left to right). */
float inkOrder(vec2 uv) {
  float o = 2.0;
  for (int i = 0; i < 5; i++) {
    if (i >= uLineCount) break;
    vec4 r = uLines[i];
    vec2 m = vec2(0.012, 0.02);
    if (uv.x > r.x - m.x && uv.x < r.z + m.x && uv.y > r.y - m.y && uv.y < r.w + m.y) {
      float along = clamp((uv.x - r.x) / max(r.z - r.x, 1e-3), 0.0, 1.0);
      o = (float(i) + along * 0.85) / float(uLineCount);
    }
  }
  return o;
}
`;

const FRAGMENT_MAP = /* glsl */ `
vec4 sheet = texture2D(uTex, vUv);
float n1 = texture2D(uNoise, vUv * 2.1).r;
float n2 = texture2D(uNoise, vUv * 7.3 + 0.37).g;
float n3 = texture2D(uNoise, vUv * 23.0 + 0.11).b;
// Paper.
vec3 paper = mix(uPaperDark, uPaperLight, smoothstep(0.16, 0.68, sheet.r));
float soft = texture2D(uTex, vUv, 4.5).a;
float edge = 1.0 - smoothstep(0.5, 0.97, soft);
paper = mix(paper, paper * vec3(0.66, 0.53, 0.4), edge * 0.8);
paper *= 0.93 + 0.1 * n3;
// Ink: a memory becoming visible.
float order = inkOrder(vUv);
float reveal = smoothstep(order - 0.015, order + 0.075, uReveal * 1.12 + (n2 - 0.5) * 0.08);
float inkSharp = sheet.g;
float inkSoft = texture2D(uTex, vUv, 2.4).g;
float inkAmt = mix(inkSoft * 0.5, inkSharp, smoothstep(0.3, 1.0, reveal)) * reveal * (0.8 + 0.2 * n1);
vec3 col = mix(paper, uInk, clamp(inkAmt, 0.0, 1.0) * 0.93);
// The Trace: a small red archival rule, printed low on every sheet with a registration tick —
// the same red that returns in the stone's inlay, and in the building.
vec2 rr = (vUv - vec2(0.085, 0.14)) * uSize;
float rw = max(fwidth(rr.y), 1e-4);
float rule = (1.0 - smoothstep(0.0022, 0.0022 + rw, abs(rr.y))) * smoothstep(-rw, rw, rr.x) * (1.0 - smoothstep(0.2 - rw, 0.2 + rw, rr.x));
float tick = (1.0 - smoothstep(0.0018, 0.0018 + rw, abs(rr.x))) * (1.0 - smoothstep(0.018, 0.018 + rw, abs(rr.y)));
float trace = max(rule, tick) * smoothstep(0.05, 0.35, uReveal) * (0.7 + 0.3 * n2);
col = mix(col, vec3(0.58, 0.1, 0.07), trace * 0.9);
// Fire.
float bt = sheet.b + (n2 - 0.5) * 0.07 + (n3 - 0.5) * 0.035;
float local = uBurn * 1.28 - bt;
// Nothing happens before the match is struck.
float lit = smoothstep(0.0, 0.025, uBurn);
float heat = smoothstep(-0.22, -0.02, local) * lit;
col = mix(col, col * vec3(0.52, 0.34, 0.2), heat * 0.85);
float charred = smoothstep(-0.04, -0.004, local) * lit;
col = mix(col, uChar, charred);
// (Squared by hand: GLSL's pow() is undefined for a negative base — NaN here
// would bloom into black blocks.)
float emberX = (local + 0.002) / 0.009;
float ember = exp(-emberX * emberX) * lit;
// Edges — the torn silhouette and the fire's front — antialiased over about a
// pixel (a hard cut-off would step along every tear).
float silW = max(fwidth(sheet.a), 0.004) * 0.85;
float sil = smoothstep(0.5 - silW, 0.5 + silW, sheet.a);
float fireW = max(fwidth(local), 0.0005);
float kept = 1.0 - smoothstep(-fireW, fireW, local) * lit;
// Arrival: the edge first, then the fibres in towards the middle.
vec2 cq = abs(vUv - 0.5) * 2.0;
float inward = 1.0 - max(cq.x, cq.y);
// Gathering in patches (the fibres find each other), with a little grain at the front.
float blotch = texture2D(uNoise, vUv * 1.4 + 0.21).g;
float fibre = texture2D(uNoise, vUv * vec2(3.0, 9.0) + 0.53).r;
float formOrder = inward * 0.62 + (blotch - 0.5) * 0.52 + (n1 - 0.5) * 0.18 + (fibre - 0.5) * 0.07;
float front = uForm * 1.5 - 0.3;
float formed = smoothstep(front + 0.035, front - 0.035, formOrder);
// The torn edge itself is drawn first, as a line.
float rim = smoothstep(0.62, 0.9, 1.0 - soft) * smoothstep(0.0, 0.12, uForm);
float cover = sil * kept * max(formed, rim * 0.85);
if (cover < 0.02) discard;
float forming = exp(-pow((formOrder - front) / 0.045, 2.0)) * (1.0 - smoothstep(0.9, 1.0, uForm));
if (!gl_FrontFacing) col = paper * 0.62;
diffuseColor.rgb = col;
// Arrival: it comes out of the mist (the fog does most of it; this keeps the first moment soft).
diffuseColor.a = uPresence * cover;
`;

const FRAGMENT_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
float flicker = 0.75 + 0.25 * sin(uTime * 17.0 + vUv.x * 40.0) * sin(uTime * 11.0 + vUv.y * 31.0);
totalEmissiveRadiance += uEmber * ember * flicker + diffuseColor.rgb * uFill;
// The forming front, and the edge as it is drawn: a little cool light caught in the new fibres.
totalEmissiveRadiance += vec3(0.62, 0.68, 0.78) * (forming * 0.55 + rim * (1.0 - formed) * 0.35) * sil;
`;

export function createParchmentMaterial(tex: Texture, noise: Texture, size: [number, number], lines: Vector4[], seed: number) {
  const padded = [...lines, ...Array.from({ length: Math.max(0, 5 - lines.length) }, () => new Vector4(-1, -1, -1, -1))].slice(0, 5);
  const uniforms: ParchmentUniforms = {
    uTex: { value: tex },
    uNoise: { value: noise },
    uSize: { value: new Vector2(size[0], size[1]) },
    uReveal: { value: 0 },
    uBurn: { value: 0 },
    uTime: { value: 0 },
    uFlutter: { value: 0.012 },
    uCurl: { value: 1 },
    uSeed: { value: seed },
    uPresence: { value: 0 },
    uForm: { value: 1 },
    uFill: { value: 0.3 },
    uLines: { value: padded },
    uLineCount: { value: Math.min(5, lines.length) },
    uPaperLight: { value: new Color('#eadcbd') },
    uPaperDark: { value: new Color('#a88c63') },
    uInk: { value: new Color('#24160d') },
    uChar: { value: new Color('#0f0906') },
    uEmber: { value: new Color('#ff5a14').multiplyScalar(2.4) },
  };
  const m = new MeshStandardMaterial({ roughness: 0.9, metalness: 0, side: DoubleSide, transparent: true, depthWrite: true });
  // The sheet's UVs (declares the uv attribute and vUv in both stages).
  const withDefines = m as unknown as { defines?: Record<string, string> };
  withDefines.defines = { ...(withDefines.defines ?? {}), USE_UV: '' };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
      .replace('#include <beginnormal_vertex>', VERTEX_NORMAL)
      .replace('#include <begin_vertex>', 'vec3 transformed = sheetPos;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
      .replace('#include <map_fragment>', FRAGMENT_MAP)
      .replace('#include <emissivemap_fragment>', FRAGMENT_EMISSIVE);
  };
  m.customProgramCacheKey = () => 'intro-parchment';
  return { material: m, uniforms };
}
