/**
 * Procedural avatar rig.
 *
 * Builds a stylised person with natural adult proportions (head ≈ 1/7.7 of
 * height, hip joint ≈ 0.52 H, shoulders ≈ 0.82 H), professional clothing and
 * the hair / eyewear / facial-hair options in AvatarAppearance. There are no
 * exaggerated or sexualised features, and body shape does not vary by gender —
 * only height and a narrow "build" range.
 *
 * Each articulated part is merged into a single vertex-coloured mesh, and every
 * avatar shares one material: ~12 draw calls per person.
 */
import {
  type BufferGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  type Material,
  Mesh,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { AvatarAppearance } from '@/content/avatar';
import { merge, metricBox, paint, place } from '@/systems/geometry/build';

export interface AvatarRig {
  root: Group;
  hips: Group;
  spine: Group;
  head: Group;
  shoulderL: Group;
  elbowL: Group;
  handL: Group;
  shoulderR: Group;
  elbowR: Group;
  handR: Group;
  hipL: Group;
  kneeL: Group;
  hipR: Group;
  kneeR: Group;
  eyes: Mesh;
  mouth: Mesh;
  dims: AvatarDims;
  geometries: BufferGeometry[];
}

export interface AvatarDims {
  H: number;
  hipY: number;
  seatedHipY: number;
  spine: number;
  thigh: number;
  shin: number;
  upperArm: number;
  forearm: number;
  shoulderHalf: number;
  eyeY: number;
}

const SKIN_SHADE = 0.9;

function mix(a: string, b: string, t: number) {
  return `#${new Color(a).lerp(new Color(b), t).getHexString()}`;
}

export function buildAvatar(a: AvatarAppearance, material: Material): AvatarRig {
  const H = a.height;
  const b = a.build;
  const geometries: BufferGeometry[] = [];

  const hipY = 0.52 * H;
  const thigh = 0.245 * H;
  const shin = 0.235 * H;
  const spineLen = 0.3 * H;
  const neckLen = 0.045 * H;
  const upperArm = 0.17 * H;
  const forearm = 0.15 * H;
  const shoulderHalf = 0.108 * H * b;
  const hipHalf = 0.052 * H * b;
  const r = 0.058 * H; // skull radius
  const headCy = 0.062 * H;

  const longSleeves = a.top !== 'tshirt';
  const skin = a.skin;
  const skinShade = mix(skin, '#000000', 1 - SKIN_SHADE);
  const top = a.topColor;
  const bottom = a.bottomColor;
  const hair = a.hairColor;

  const mesh = (parts: BufferGeometry[]) => {
    const g = merge(parts, true);
    geometries.push(g);
    const m = new Mesh(g, material);
    m.castShadow = false;
    return m;
  };
  const group = (name: string, x = 0, y = 0, z = 0) => {
    const g = new Group();
    g.name = name;
    g.position.set(x, y, z);
    return g;
  };

  // ── Hierarchy ────────────────────────────────────────────────────────────
  const root = group('avatar');
  const hips = group('hips', 0, hipY, 0);
  const spine = group('spine');
  const head = group('head', 0, spineLen + neckLen, 0);
  const shoulderL = group('shoulderL', shoulderHalf, spineLen - 0.02 * H, 0);
  const shoulderR = group('shoulderR', -shoulderHalf, spineLen - 0.02 * H, 0);
  const elbowL = group('elbowL', 0, -upperArm, 0);
  const elbowR = group('elbowR', 0, -upperArm, 0);
  const handL = group('handL', 0, -forearm, 0);
  const handR = group('handR', 0, -forearm, 0);
  const hipL = group('hipL', hipHalf, 0, 0);
  const hipR = group('hipR', -hipHalf, 0, 0);
  const kneeL = group('kneeL', 0, -thigh, 0);
  const kneeR = group('kneeR', 0, -thigh, 0);
  root.add(hips);
  hips.add(spine, hipL, hipR);
  spine.add(head, shoulderL, shoulderR);
  shoulderL.add(elbowL);
  shoulderR.add(elbowR);
  elbowL.add(handL);
  elbowR.add(handR);
  hipL.add(kneeL);
  hipR.add(kneeR);

  // ── Pelvis / tunic ─────────────────────────────────────────────────────────
  const pelvisParts: BufferGeometry[] = [paint(place(new SphereGeometry(0.09 * H, 20, 12), { scale: [1.04 * b, 0.62, 0.74] }), a.top === 'kurta' ? top : bottom)];
  if (a.top === 'kurta') {
    pelvisParts.push(paint(place(new CylinderGeometry(0.098 * H * b, 0.112 * H * b, 0.2 * H, 20, 1, true), { position: [0, -0.09 * H, 0], scale: [1, 1, 0.76] }), top));
  }
  hips.add(mesh(pelvisParts));

  // ── Torso ───────────────────────────────────────────────────────────────
  const torso: BufferGeometry[] = [
    paint(place(new CapsuleGeometry(0.075 * H, 0.08 * H, 6, 16), { position: [0, spineLen * 0.3, 0], scale: [1.08 * b, 1, 0.72] }), top),
    paint(place(new CapsuleGeometry(0.084 * H, 0.1 * H, 6, 16), { position: [0, spineLen * 0.68, 0], scale: [1.12 * b, 1, 0.7] }), top),
    paint(place(new SphereGeometry(0.036 * H, 12, 10), { position: [shoulderHalf - 0.012 * H, spineLen - 0.03 * H, 0] }), top),
    paint(place(new SphereGeometry(0.036 * H, 12, 10), { position: [-shoulderHalf + 0.012 * H, spineLen - 0.03 * H, 0] }), top),
    paint(place(new CylinderGeometry(0.026 * H, 0.028 * H, neckLen + 0.03 * H, 12), { position: [0, spineLen + neckLen / 2 - 0.005 * H, 0] }), skinShade),
  ];
  const chestFront = 0.084 * H * 0.7;
  if (a.top === 'blazer') {
    torso.push(paint(place(metricBox(0.045 * H, 0.12 * H, 0.01 * H), { position: [0, spineLen * 0.78, chestFront + 0.002 * H] }), '#ebe7df'));
    torso.push(paint(place(metricBox(0.012 * H, 0.09 * H, 0.012 * H), { position: [0, spineLen * 0.74, chestFront + 0.006 * H] }), mix(top, '#000000', 0.4)));
  } else if (a.top === 'shirt') {
    torso.push(paint(place(new TorusGeometry(0.03 * H, 0.008 * H, 6, 16), { position: [0, spineLen + 0.004 * H, 0], rotation: [Math.PI / 2, 0, 0], scale: [1, 1.1, 1] }), mix(top, '#ffffff', 0.15)));
    for (let i = 0; i < 4; i++) torso.push(paint(place(new SphereGeometry(0.004 * H, 6, 4), { position: [0, spineLen * (0.85 - i * 0.14), chestFront + 0.004 * H] }), mix(top, '#ffffff', 0.45)));
  } else if (a.top === 'hoodie') {
    torso.push(paint(place(new SphereGeometry(0.06 * H, 14, 10), { position: [0, spineLen + 0.01 * H, -0.05 * H], scale: [1.35, 0.55, 0.9] }), top));
    torso.push(paint(place(metricBox(0.004 * H, 0.07 * H, 0.004 * H), { position: [0.018 * H, spineLen * 0.8, chestFront + 0.004 * H] }), '#e8e4dc'));
    torso.push(paint(place(metricBox(0.004 * H, 0.07 * H, 0.004 * H), { position: [-0.018 * H, spineLen * 0.8, chestFront + 0.004 * H] }), '#e8e4dc'));
  } else if (a.top === 'tshirt') {
    torso.push(paint(place(new TorusGeometry(0.03 * H, 0.006 * H, 6, 16), { position: [0, spineLen + 0.004 * H, 0], rotation: [Math.PI / 2, 0, 0] }), mix(top, '#000000', 0.2)));
  }
  spine.add(mesh(torso));

  // ── Head ───────────────────────────────────────────────────────────────
  const headParts: BufferGeometry[] = [
    paint(place(new SphereGeometry(r, 28, 20), { position: [0, headCy, 0], scale: [0.9, 1.12, 0.98] }), skin),
    paint(place(new CapsuleGeometry(0.0068 * H, 0.015 * H, 4, 8), { position: [0, headCy - 0.004 * H, r * 0.93], rotation: [-0.36, 0, 0] }), skinShade),
    paint(place(new SphereGeometry(0.012 * H, 10, 8), { position: [r * 0.9, headCy, -0.004 * H], scale: [0.45, 1, 0.8] }), skinShade),
    paint(place(new SphereGeometry(0.012 * H, 10, 8), { position: [-r * 0.9, headCy, -0.004 * H], scale: [0.45, 1, 0.8] }), skinShade),
    // Brows.
    paint(place(metricBox(0.024 * H, 0.0045 * H, 0.006 * H), { position: [0.021 * H, headCy + 0.024 * H, r * 0.9], rotation: [0, 0.2, -0.06] }), hair),
    paint(place(metricBox(0.024 * H, 0.0045 * H, 0.006 * H), { position: [-0.021 * H, headCy + 0.024 * H, r * 0.9], rotation: [0, -0.2, 0.06] }), hair),
  ];
  const cap = (radiusK: number, thetaLen: number, phiStart = 0, phiLen = Math.PI * 2, thetaStart = 0, color = hair) =>
    paint(place(new SphereGeometry(r * radiusK, 28, 16, phiStart, phiLen, thetaStart, thetaLen), { position: [0, headCy + 0.003 * H, -0.003 * H], scale: [0.9, 1.12, 0.98] }), color);
  const backHalf = (radiusK: number, thetaStart: number, thetaLen: number, wrap = 1) =>
    paint(
      place(new SphereGeometry(r * radiusK, 24, 12, Math.PI - (wrap - 1) * 0.5 * Math.PI, Math.PI * wrap, thetaStart, thetaLen), { position: [0, headCy, -0.002 * H], scale: [0.9, 1.12, 0.98] }),
      hair,
    );
  // The crown cap stops at the hairline (~0.32π from the top); back/side pieces
  // wrap round to the ears but never across the face.
  switch (a.hair) {
    case 'buzz':
      headParts.push(cap(1.015, Math.PI * 0.33), backHalf(1.012, Math.PI * 0.25, Math.PI * 0.36, 1.1));
      break;
    case 'short':
      headParts.push(cap(1.05, Math.PI * 0.32), backHalf(1.04, Math.PI * 0.25, Math.PI * 0.4, 1.15));
      break;
    case 'medium':
      headParts.push(cap(1.06, Math.PI * 0.33), backHalf(1.05, Math.PI * 0.25, Math.PI * 0.52, 1.35));
      break;
    case 'long':
      headParts.push(
        cap(1.07, Math.PI * 0.33),
        backHalf(1.06, Math.PI * 0.25, Math.PI * 0.62, 1.38),
        paint(place(new CapsuleGeometry(0.045 * H, 0.13 * H, 6, 12), { position: [0, -0.02 * H, -0.04 * H], scale: [1.55, 1, 0.45] }), hair),
      );
      break;
    case 'ponytail':
      headParts.push(
        cap(1.05, Math.PI * 0.33),
        backHalf(1.04, Math.PI * 0.25, Math.PI * 0.45, 1.2),
        paint(place(new SphereGeometry(0.014 * H, 8, 6), { position: [0, headCy + 0.012 * H, -r * 1.02] }), hair),
        paint(place(new CapsuleGeometry(0.016 * H, 0.08 * H, 4, 8), { position: [0, headCy - 0.045 * H, -r * 1.06], rotation: [0.2, 0, 0] }), hair),
      );
      break;
    case 'bun':
      headParts.push(cap(1.05, Math.PI * 0.33), backHalf(1.04, Math.PI * 0.25, Math.PI * 0.45, 1.2), paint(place(new SphereGeometry(0.03 * H, 14, 10), { position: [0, headCy + 0.045 * H, -r * 0.85] }), hair));
      break;
    case 'curly': {
      headParts.push(cap(1.04, Math.PI * 0.33), backHalf(1.04, Math.PI * 0.25, Math.PI * 0.4, 1.15));
      for (let i = 0; i < 14; i++) {
        const phi = (i / 14) * Math.PI * 2;
        const th = i % 2 ? 0.3 : 0.55;
        const x = Math.sin(th * Math.PI) * Math.cos(phi) * r * 0.95 * 0.9;
        const z = Math.sin(th * Math.PI) * Math.sin(phi) * r * 0.95 * 0.98 - 0.003 * H;
        if (z > r * 0.55 && th > 0.5) continue; // keep the face clear
        headParts.push(paint(place(new SphereGeometry(0.022 * H, 8, 6), { position: [x, headCy + Math.cos(th * Math.PI) * r * 1.1 + 0.004 * H, z] }), hair));
      }
      break;
    }
    case 'covered': {
      const c = a.coveringColor ?? '#3d4a5c';
      headParts.push(
        paint(place(new SphereGeometry(r * 1.1, 28, 16, Math.PI * 0.78, Math.PI * 1.44, 0, Math.PI * 0.74), { position: [0, headCy, -0.002 * H], scale: [0.92, 1.12, 1] }), c),
        paint(place(new SphereGeometry(r * 1.1, 28, 10, 0, Math.PI * 2, 0, Math.PI * 0.26), { position: [0, headCy, -0.002 * H], scale: [0.92, 1.12, 1] }), c),
        paint(place(new CapsuleGeometry(0.06 * H, 0.06 * H, 6, 12), { position: [0, -0.035 * H, -0.02 * H], scale: [1.5, 1, 0.9] }), c),
      );
      break;
    }
  }
  if (a.facialHair === 'stubble' || a.facialHair === 'beard') {
    const k = a.facialHair === 'beard' ? 1.035 : 1.008;
    const color = a.facialHair === 'beard' ? hair : mix(skin, hair, 0.45);
    headParts.push(paint(place(new SphereGeometry(r * k, 24, 10, Math.PI * 0.12, Math.PI * 0.76, Math.PI * 0.56, Math.PI * (a.facialHair === 'beard' ? 0.36 : 0.3)), { position: [0, headCy, 0], scale: [0.9, 1.12, 0.98] }), color));
  }
  if (a.facialHair === 'moustache' || a.facialHair === 'beard') {
    headParts.push(paint(place(metricBox(0.03 * H, 0.006 * H, 0.008 * H), { position: [0, headCy - 0.017 * H, r * 0.93] }), hair));
  }
  if (a.glasses) {
    const eyeY = headCy + 0.008 * H;
    const gz = r * 0.99;
    for (const s of [-1, 1]) {
      headParts.push(paint(place(new TorusGeometry(0.0135 * H, 0.0016 * H, 6, 20), { position: [s * 0.021 * H, eyeY, gz] }), '#151515'));
      headParts.push(paint(place(metricBox(0.0025 * H, 0.0025 * H, r * 0.95), { position: [s * 0.046 * H, eyeY, gz - r * 0.47] }), '#151515'));
    }
    headParts.push(paint(place(metricBox(0.014 * H, 0.0025 * H, 0.0025 * H), { position: [0, eyeY + 0.002 * H, gz] }), '#151515'));
  }
  head.add(mesh(headParts));

  // Eyes: whites, iris and a catch-light, grouped at eye level so a blink
  // squashes them in place.
  const eyeParts: BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const x = sx * 0.021 * H;
    eyeParts.push(
      paint(place(new SphereGeometry(0.0078 * H, 14, 10), { position: [x, 0, 0], scale: [1.25, 0.82, 0.42] }), '#eee7de'),
      paint(place(new SphereGeometry(0.0047 * H, 12, 10), { position: [x, -0.0003 * H, 0.0022 * H], scale: [1, 1, 0.5] }), '#2b1d15'),
      paint(place(new SphereGeometry(0.0012 * H, 6, 4), { position: [x + 0.0016 * H, 0.0016 * H, 0.0042 * H] }), '#fbf8f2'),
    );
  }
  const eyes = mesh(eyeParts);
  eyes.position.set(0, headCy + 0.008 * H, r * 0.9);
  head.add(eyes);
  const mouth = mesh([paint(metricBox(0.02 * H, 0.0034 * H, 0.004 * H), mix(skin, '#5a2a24', 0.55))]);
  mouth.position.set(0, headCy - 0.026 * H, r * 0.915);
  head.add(mouth);

  // ── Arms ──────────────────────────────────────────────────────────────
  const sleeve = longSleeves ? top : skin;
  for (const [shoulder, elbow] of [
    [shoulderL, elbowL],
    [shoulderR, elbowR],
  ] as const) {
    const upper = [paint(place(new CapsuleGeometry(0.029 * H * b, upperArm - 0.03 * H, 4, 12), { position: [0, -upperArm / 2, 0] }), top)];
    if (!longSleeves) {
      // Short sleeve: skin below the sleeve hem.
      upper[0] = paint(place(new CapsuleGeometry(0.031 * H * b, upperArm * 0.35, 4, 12), { position: [0, -upperArm * 0.22, 0] }), top);
      upper.push(paint(place(new CapsuleGeometry(0.025 * H, upperArm * 0.55, 4, 12), { position: [0, -upperArm * 0.62, 0] }), skin));
    }
    shoulder.add(mesh(upper));
    elbow.add(
      mesh([
        paint(place(new CapsuleGeometry(0.025 * H, forearm - 0.03 * H, 4, 12), { position: [0, -forearm / 2, 0] }), sleeve),
        paint(place(new SphereGeometry(0.027 * H, 12, 10), { position: [0, -forearm - 0.028 * H, 0], scale: [0.72, 1.3, 0.5] }), skin),
      ]),
    );
  }

  // ── Legs ──────────────────────────────────────────────────────────────
  for (const [hip, knee] of [
    [hipL, kneeL],
    [hipR, kneeR],
  ] as const) {
    hip.add(mesh([paint(place(new CapsuleGeometry(0.043 * H * b, thigh - 0.04 * H, 4, 12), { position: [0, -thigh / 2, 0] }), bottom)]));
    knee.add(
      mesh([
        paint(place(new CapsuleGeometry(0.034 * H, shin - 0.05 * H, 4, 12), { position: [0, -shin / 2 + 0.01 * H, 0] }), bottom),
        paint(place(new CapsuleGeometry(0.03 * H, 0.08 * H, 4, 10), { position: [0, -shin - 0.012 * H, 0.03 * H], rotation: [Math.PI / 2, 0, 0], scale: [1.05, 1, 0.62] }), a.shoeColor),
      ]),
    );
  }

  return {
    root,
    hips,
    spine,
    head,
    shoulderL,
    elbowL,
    handL,
    shoulderR,
    elbowR,
    handR,
    hipL,
    kneeL,
    hipR,
    kneeR,
    eyes,
    mouth,
    geometries,
    dims: {
      H,
      hipY,
      seatedHipY: 0.5,
      spine: spineLen,
      thigh,
      shin,
      upperArm,
      forearm,
      shoulderHalf,
      eyeY: hipY + spineLen + neckLen + headCy + 0.008 * H,
    },
  };
}
