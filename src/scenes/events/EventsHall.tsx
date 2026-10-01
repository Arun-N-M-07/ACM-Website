'use client';
/**
 * The Events — the hall beyond the lobby's door, and the one object in it:
 * the matrix (config/world: MATRIX, EVENT_ROOMS).
 *
 *   the hall     dark concrete, a polished floor, light slots overhead; at
 *                its far end a niche in the end wall, and in it the matrix
 *   the matrix   three massive columns standing side by side, three bays to
 *                a column: a beveled front of dark bronze, a body of honed
 *                stone, each bay a layered reveal — the front's chamfered
 *                edge, a recessed liner of blackened steel with a bright
 *                inner edge, a line of light in its head — and in each, an
 *                event's room itself (EventRoom), at the bay's scale. A small
 *                plaque under each bay: its number and its name.
 *   the passage  behind it, to the portal (teams/portal/Portal)
 *
 * What moves reads eventsFrame (controller.ts), which reads the scroll: the
 * hall and the bays come up out of the dark as the camera arrives; a bay under
 * the pointer lights, the others quieten (a veil over their rooms) and lines
 * of light trace across it, left to right; in the portal segment the matrix
 * opens — its outer columns slide into the wall, the middle one sinks until
 * its top is the floor. Everything is built once; nothing is rebuilt as the
 * journey moves.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  type BufferGeometry,
  Color,
  ExtrudeGeometry,
  type Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  ShaderMaterial,
  Shape,
  Vector3,
} from 'three';
import { QUALITY } from '@/config/quality';
import { EVENT_ROOMS, EVENTS_HALL, EVENTS_PASSAGE, FLOOR_Y, MATRIX, UNDERGROUND, columnOf, type RoomLayout } from '@/config/world';
import { useExperience } from '@/store/experience';
import { trackAnchor } from '@/systems/anchors/anchors';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { useGainedLightAnchors } from '@/systems/lighting/lightPool';
import { useDisposable } from '@/systems/performance/useDisposable';
import { text } from '@/systems/textures/typeset';
import { Portal } from '@/teams/portal/Portal';
import { LOBBY, PASSAGE as LOBBY_PASSAGE } from '@/intro/world/lobbyLayout';
import { CanvasPanel } from '../shared/CanvasPanel';
import { useKit } from '../underground/kit';
import { EventRoom } from './EventRoom';
import { eventsFrame } from './state';

const M = MATRIX;
const HALL = EVENTS_HALL;
const PASS = EVENTS_PASSAGE;
const N = EVENT_ROOMS.length;
const pad2 = (n: number) => String(n).padStart(2, '0');
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoother = (x: number) => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const sstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** The matrix's three columns: their extent, and the rooms they hold (a hairline between them). */
const SEAM_GAP = 0.006;
const BLOCKS = ([-1, 0, 1] as const).map((b) => ({
  b,
  x0: b < 0 ? -M.width / 2 : b === 0 ? -M.seam + SEAM_GAP : M.seam + SEAM_GAP,
  x1: b < 0 ? -M.seam - SEAM_GAP : b === 0 ? M.seam - SEAM_GAP : M.width / 2,
  rooms: EVENT_ROOMS.filter((r) => columnOf(r.col) === b),
}));

/** How far the matrix has opened, column by column: the outer ones slide first, then the middle sinks. */
export function splitOffsets(split: number) {
  const side = smoother(split / 0.62);
  const sink = smoother((split - 0.26) / 0.74);
  return { side: side * M.slide, sink: sink * M.height };
}

/** The bay's opening (x left/right, y bottom/top above the floor). */
const bayRect = (r: RoomLayout) => ({ x0: r.bayX - M.bay.w / 2, x1: r.bayX + M.bay.w / 2, y0: r.baySill, y1: r.baySill + M.bay.h });

// ─── The hall ───────────────────────────────────────────────────────────────

/** Continuous metric UVs across architectural pieces, rather than each box
 * restarting the plank/tile pattern at a different origin. The floor origin
 * matches the existing lobby passage so its grid also meets at the doorway. */
function hallUv(g: BufferGeometry) {
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, x + UNDERGROUND.corridor.halfWidth, LOBBY.north - z);
    else if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, n.getX(i) > 0 ? LOBBY_PASSAGE.z0 - z : z - LOBBY_PASSAGE.z1, y - FLOOR_Y);
    else uv.setXY(i, x + UNDERGROUND.corridor.halfWidth, y - FLOOR_Y);
  }
  uv.needsUpdate = true;
  return g;
}

function Hall() {
  const kit = useKit();
  const geo = useDisposable(() => {
    const t = 0.4;
    const H = HALL.height;
    const F = FLOOR_Y;
    const walls: BufferGeometry[] = [];
    const g = UNDERGROUND.corridor;
    // The south wall, open where the lobby's passage comes through.
    // The lobby passage stops at `south`. Put this wall on the hall side of that
    // joint: putting it behind the mouth duplicated the passage's inner jamb faces.
    const sz = HALL.south - t / 2;
    for (const s of [-1, 1]) walls.push(place(metricBox(HALL.halfWidth - g.halfWidth, H, t), { position: [(s * (HALL.halfWidth + g.halfWidth)) / 2, F + H / 2, sz] }));
    walls.push(place(metricBox(2 * g.halfWidth, H - g.height, t), { position: [0, F + g.height + (H - g.height) / 2, sz] }));
    // The side walls, and pilasters along them.
    const len = HALL.south - HALL.wall;
    for (const s of [-1, 1]) {
      walls.push(place(metricBox(t, H, len), { position: [s * (HALL.halfWidth + t / 2), F + H / 2, HALL.wall + len / 2] }));
      for (let z = HALL.south - 4; z > HALL.wall + 2; z -= 5.6) walls.push(place(metricBox(0.6, H, 1), { position: [s * (HALL.halfWidth - 0.3), F + H / 2, z] }));
    }
    // The end wall's face, up to the niche's own walls (the two meet edge to edge: no face shared).
    const nw = HALL.niche.halfWidth;
    const nh = HALL.niche.height;
    const nr = 0.4;
    const wt = 0.6;
    const ez = HALL.wall - wt / 2;
    const ow = nw + nr;
    for (const s of [-1, 1]) walls.push(place(metricBox(HALL.halfWidth - ow, H, wt), { position: [(s * (HALL.halfWidth + ow)) / 2, F + H / 2, ez] }));
    walls.push(place(metricBox(2 * ow, H - nh - nr, wt), { position: [0, F + nh + nr + (H - nh - nr) / 2, ez] }));

    // The niche: its sides and head, back to its back wall — open in the middle to the passage.
    const niche: BufferGeometry[] = [];
    const nd = HALL.wall - HALL.niche.back;
    const nz = HALL.wall - nd / 2;
    for (const s of [-1, 1]) niche.push(place(metricBox(nr, nh, nd), { position: [s * (nw + nr / 2), F + nh / 2, nz] }));
    niche.push(place(metricBox(2 * ow, nr, nd), { position: [0, F + nh + nr / 2, nz] }));
    const bz = HALL.niche.back - 0.2;
    for (const s of [-1, 1]) niche.push(place(metricBox(nw - PASS.halfWidth, nh, 0.4), { position: [(s * (nw + PASS.halfWidth)) / 2, F + nh / 2, bz] }));
    niche.push(place(metricBox(2 * PASS.halfWidth, nh - PASS.height, 0.4), { position: [0, F + PASS.height + (nh - PASS.height) / 2, bz] }));

    // The floor: the hall's; the niche's round the pit the middle column sinks into; the passage's.
    const floors: BufferGeometry[] = [];
    const pit = M.seam;
    // Meet the existing lobby floor edge-to-edge. Its top occupies z >= south;
    // extending this floor through the mouth produced a coplanar overlap strip.
    floors.push(place(metricBox(2 * HALL.halfWidth + 2 * t, 0.2, len), { position: [0, F - 0.1, (HALL.south + HALL.wall) / 2] }));
    floors.push(place(metricBox(2 * nw, 0.2, HALL.wall - M.face), { position: [0, F - 0.1, (HALL.wall + M.face) / 2] }));
    for (const s of [-1, 1]) floors.push(place(metricBox(nw - pit, 0.2, M.face - HALL.niche.back), { position: [(s * (nw + pit)) / 2, F - 0.1, (M.face + HALL.niche.back) / 2] }));
    floors.push(place(metricBox(2 * pit, 0.2, M.back - HALL.niche.back), { position: [0, F - 0.1, (M.back + HALL.niche.back) / 2] }));
    floors.push(place(metricBox(2 * PASS.halfWidth + 0.8, 0.2, PASS.z0 - PASS.z1), { position: [0, F - 0.1, (PASS.z0 + PASS.z1) / 2] }));

    // The pit (seen only as the middle column goes down into it).
    const D = M.height + 0.1;
    const pitWalls = merge([
      place(metricBox(0.3, D, M.depth), { position: [-(pit + 0.15), F - D / 2, M.face - M.depth / 2] }),
      place(metricBox(0.3, D, M.depth), { position: [pit + 0.15, F - D / 2, M.face - M.depth / 2] }),
      place(metricBox(2 * pit, D, 0.3), { position: [0, F - D / 2, M.face + 0.15] }),
      place(metricBox(2 * pit, D, 0.3), { position: [0, F - D / 2, M.back - 0.15] }),
      place(metricBox(2 * pit, 0.3, M.depth), { position: [0, F - D - 0.15, M.face - M.depth / 2] }),
    ]);

    const ceiling = place(metricBox(2 * HALL.halfWidth + 2 * t, 0.4, len), { position: [0, F + H + 0.2, HALL.wall + len / 2] });
    // Light: two long slots overhead, either side of the axis.
    const slots = merge([-6.5, 6.5].map((x) => place(metricBox(0.14, 0.04, len - 7), { position: [x, F + H - 0.02, HALL.wall + len / 2 + 1.5] })));
    return { walls: hallUv(merge(walls)), niche: hallUv(merge(niche)), floor: hallUv(merge(floors)), pitWalls, ceiling, slots };
  }, []);
  return (
    <group name="events-hall">
      <mesh geometry={geo.floor} material={kit.floor} />
      <mesh geometry={geo.walls} material={kit.concreteDark} />
      <mesh geometry={geo.niche} material={kit.concreteDark} />
      <mesh geometry={geo.pitWalls} material={kit.concreteDark} />
      <mesh geometry={geo.ceiling} material={kit.ceiling} />
      <mesh geometry={geo.slots} material={kit.lightCool} />
    </group>
  );
}

// ─── The tracing: lines of light across a bay under the pointer ─────────────

const TRACE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * A lit bay's highlight, drawn on a quad over the bay and a margin of its frame, and kept to the bay:
 * the opening hatched with fine diagonal lines of light — drawn in from the left, the hatching's edge
 * running along its own diagonal — its edge drawn round in a hairline as they come, and a small cross
 * at each corner. Held while the bay stays lit; nothing of it crosses the frame into another bay.
 * uT is the bay's tracing clock (s); uLit, how lit it is.
 */
const TRACE_FRAG = /* glsl */ `
uniform float uT;
uniform float uLit;
uniform vec2 uSize;
uniform vec4 uBay;
uniform vec3 uColor;
varying vec2 vUv;

float seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}
float ink(float d, float px, float w) { return 1.0 - smoothstep(w * px, (w + 1.1) * px, d); }

void main() {
  vec2 p = vUv * uSize;
  float px = max(fwidth(p.x), fwidth(p.y));
  vec2 b0 = uBay.xy * uSize;
  vec2 b1 = uBay.zw * uSize;
  vec2 bs = b1 - b0;
  // How far the hatching has come in: its edge a diagonal sweeping left to right across the bay.
  float sweep = smoothstep(0.0, 0.6, uT);
  float front = mix(-bs.y, bs.x, sweep);
  vec2 lp = p - b0;
  float inBay = step(0.0, lp.x) * step(lp.x, bs.x) * step(0.0, lp.y) * step(lp.y, bs.y);
  float reached = 1.0 - smoothstep(front - 0.25, front, lp.x - lp.y * 0.5);
  // The hatching: fine lines rising to the right, evenly spaced.
  float spacing = 0.085;
  float k = (lp.x - lp.y) * 0.7071;
  float dl = abs(fract(k / spacing + 0.5) - 0.5) * spacing;
  float hatch = ink(dl, px, 0.35) * 0.3 + 0.035;
  float a = hatch * inBay * reached;
  // Its edge, a hairline drawn round as the hatching comes.
  float reach = mix(b0.x, b1.x, sweep);
  float edge = 0.0;
  edge += ink(seg(p, vec2(b0.x, b1.y), vec2(reach, b1.y)), px, 0.45);
  edge += ink(seg(p, vec2(b0.x, b0.y), vec2(reach, b0.y)), px, 0.45);
  edge += ink(seg(p, b0, vec2(b0.x, b1.y)), px, 0.45) * smoothstep(0.0, 0.2, uT);
  edge += ink(seg(p, vec2(b1.x, b0.y), b1), px, 0.45) * smoothstep(0.45, 0.6, uT);
  a += min(edge, 1.0) * 0.5;
  // A small cross at each corner.
  float arm = 0.07;
  float cross = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 c = vec2(i == 0 || i == 3 ? b0.x : b1.x, i < 2 ? b0.y : b1.y);
    cross += ink(seg(p, c - vec2(arm, 0.0), c + vec2(arm, 0.0)), px, 0.55);
    cross += ink(seg(p, c - vec2(0.0, arm), c + vec2(0.0, arm)), px, 0.55);
  }
  a += min(cross, 1.0) * 0.85 * smoothstep(0.15, 0.45, uT);
  gl_FragColor = vec4(uColor * a * uLit, 1.0);
}
`;

// ─── The matrix ─────────────────────────────────────────────────────────────

const FRONT = { depth: 0.2, bevel: 0.035 };
const LINER = { z: 0.3, width: 0.07, depth: 0.05, edge: 0.012 };

interface Materials {
  bronze: MeshStandardMaterial;
  stone: MeshStandardMaterial;
  liner: MeshStandardMaterial;
  edge: MeshStandardMaterial;
  strips: MeshBasicMaterial[];
  veils: MeshBasicMaterial[];
  traces: ShaderMaterial[];
}

/** One column of the matrix: its body, its beveled front, its bays' liners, lights and lintels. */
function columnGeometry(bk: (typeof BLOCKS)[number]) {
  const F = FLOOR_Y;
  const { x0, x1 } = bk;
  const bodyZ0 = M.face - FRONT.depth - 2 * FRONT.bevel;
  const bodyDepth = bodyZ0 - M.back;
  const bodyZ = M.back + bodyDepth / 2;
  const bays = bk.rooms.map(bayRect).sort((a, b) => a.y0 - b.y0);
  const bl = bays[0].x0;
  const br = bays[0].x1;
  const body: BufferGeometry[] = [];
  // The uprights either side of the bays (a pier, or half a mullion), full height, full depth.
  if (bl - x0 > 0.01) body.push(place(metricBox(bl - x0, M.height, bodyDepth), { position: [(x0 + bl) / 2, F + M.height / 2, bodyZ] }));
  if (x1 - br > 0.01) body.push(place(metricBox(x1 - br, M.height, bodyDepth), { position: [(br + x1) / 2, F + M.height / 2, bodyZ] }));
  // Across between them: the base, the transoms, the crown. (Each top that is a bay's sill stops a
  // hair under it: the room's own floor is the sill — never two faces in one plane.)
  const SILL = 0.006;
  const spans: [number, number][] = [[0, bays[0].y0 - SILL]];
  for (let k = 1; k < bays.length; k++) spans.push([bays[k - 1].y1, bays[k].y0 - SILL]);
  spans.push([bays[bays.length - 1].y1, M.height]);
  for (const [y0, y1] of spans) body.push(place(metricBox(br - bl, y1 - y0, bodyDepth), { position: [(bl + br) / 2, F + (y0 + y1) / 2, bodyZ] }));
  // Its back.
  body.push(place(metricBox(x1 - x0, M.height, 0.12), { position: [(x0 + x1) / 2, F + M.height / 2, M.back + 0.06] }));
  // The lintel over a room lower than its bay (a flagship's).
  for (const r of bk.rooms) {
    const lh = M.bay.h - r.height * r.scale;
    if (lh > 0.005) body.push(place(metricBox(M.bay.w, lh, 0.14), { position: [r.bayX, F + r.baySill + M.bay.h - lh / 2, M.face - M.reveal + 0.07] }));
  }

  // The front: the column's face with its bays cut through, the edges chamfered.
  const inset = FRONT.bevel;
  const shape = new Shape();
  shape.moveTo(x0 + inset, inset);
  shape.lineTo(x1 - inset, inset);
  shape.lineTo(x1 - inset, M.height - inset);
  shape.lineTo(x0 + inset, M.height - inset);
  shape.lineTo(x0 + inset, inset);
  for (const b of bays) {
    const hole = new Path();
    hole.moveTo(b.x0, b.y0);
    hole.lineTo(b.x0, b.y1);
    hole.lineTo(b.x1, b.y1);
    hole.lineTo(b.x1, b.y0);
    hole.lineTo(b.x0, b.y0);
    shape.holes.push(hole);
  }
  const front = new ExtrudeGeometry(shape, { depth: FRONT.depth, bevelEnabled: true, bevelThickness: FRONT.bevel, bevelSize: FRONT.bevel, bevelSegments: 3, curveSegments: 1 });
  front.translate(0, F, M.face - FRONT.depth - FRONT.bevel);

  // Inside each bay: the liner (a frame of blackened steel set back in the reveal, a bright inner edge).
  const liners: BufferGeometry[] = [];
  const edges: BufferGeometry[] = [];
  const lz = M.face - LINER.z;
  for (const b of bays) {
    const w = b.x1 - b.x0;
    const h = b.y1 - b.y0;
    const cx = (b.x0 + b.x1) / 2;
    const L = LINER.width;
    liners.push(
      place(metricBox(w, L, LINER.depth), { position: [cx, F + b.y1 - L / 2, lz] }),
      place(metricBox(w, L, LINER.depth), { position: [cx, F + b.y0 + L / 2, lz] }),
      place(metricBox(L, h - 2 * L, LINER.depth), { position: [b.x0 + L / 2, F + (b.y0 + b.y1) / 2, lz] }),
      place(metricBox(L, h - 2 * L, LINER.depth), { position: [b.x1 - L / 2, F + (b.y0 + b.y1) / 2, lz] }),
    );
    const E = LINER.edge;
    const ez = lz + LINER.depth / 2 + 0.002;
    edges.push(
      place(metricBox(w - 2 * L, E, 0.004), { position: [cx, F + b.y1 - L, ez] }),
      place(metricBox(w - 2 * L, E, 0.004), { position: [cx, F + b.y0 + L, ez] }),
      place(metricBox(E, h - 2 * L, 0.004), { position: [b.x0 + L, F + (b.y0 + b.y1) / 2, ez] }),
      place(metricBox(E, h - 2 * L, 0.004), { position: [b.x1 - L, F + (b.y0 + b.y1) / 2, ez] }),
    );
  }
  return { body: merge(body), front, liners: merge(liners), edges: merge(edges) };
}

function Column({ bk, mats }: { bk: (typeof BLOCKS)[number]; mats: Materials }) {
  const group = useRef<Group>(null);
  const frame = useRef<Group>(null);
  const roomGroups = useRef<(Group | null)[]>([]);
  const geo = useDisposable(() => columnGeometry(bk), [bk]);
  // Per bay: the head's line of light, the veil over its room, and the tracing quad.
  const bayGeo = useDisposable(
    () => ({
      strip: metricBox(M.bay.w - 0.34, 0.018, 0.03),
      veil: new PlaneGeometry(M.bay.w, M.bay.h),
      trace: new PlaneGeometry(M.bay.w + 1.1, M.bay.h + 1.0),
    }),
    [],
  );

  useFrame(({ camera }) => {
    const v = eventsFrame.view;
    const { side, sink } = splitOffsets(v.split);
    if (group.current) {
      group.current.position.x = bk.b * side;
      group.current.position.y = bk.b === 0 ? -sink : 0;
    }
    // Cull only after the camera (including its near plane) is physically inside this room. The
    // entry state alone is not an occlusion test: the threshold pose still stands before its portal,
    // especially in portrait. Hiding the shelf there exposed the room as a floating separate box.
    const selected = EVENT_ROOMS[v.index];
    const near = camera.near;
    const at = camera.position;
    const inside = !!selected && v.enter === 1
      && Math.abs(at.x - selected.center[0]) + near < selected.length * selected.scale / 2
      && at.y - near > selected.center[1]
      && at.y + near < selected.center[1] + selected.height * selected.scale
      && at.z + near < selected.center[2] + selected.depth * selected.scale / 2
      && at.z - near > selected.center[2] - selected.depth * selected.scale / 2;
    if (frame.current) frame.current.visible = !inside;
    bk.rooms.forEach((r, k) => {
      const g = roomGroups.current[k];
      if (g) g.visible = !inside || r.index === v.index;
    });
  });

  return (
    <group ref={group} name={`matrix-column-${bk.b}`}>
      <group ref={frame}>
        <mesh geometry={geo.body} material={mats.stone} />
        <mesh geometry={geo.front} material={mats.bronze} />
        <mesh geometry={geo.liners} material={mats.liner} />
        <mesh geometry={geo.edges} material={mats.edge} />
        {bk.rooms.map((r) => {
          const b = bayRect(r);
          return (
            <group key={`bay-${r.index}`}>
              <mesh geometry={bayGeo.strip} material={mats.strips[r.index]} position={[r.bayX, FLOOR_Y + b.y1 - 0.052, M.face - 0.14]} />
              <mesh geometry={bayGeo.veil} material={mats.veils[r.index]} position={[r.bayX, FLOOR_Y + (b.y0 + b.y1) / 2, M.face - M.reveal + 0.015]} renderOrder={3} />
              <mesh geometry={bayGeo.trace} material={mats.traces[r.index]} position={[r.bayX, FLOOR_Y + (b.y0 + b.y1) / 2, M.face + 0.03]} renderOrder={5} />
              <BayPlaque room={r} />
            </group>
          );
        })}
        {bk.b === 0 && <Inscription />}
      </group>
      {bk.rooms.map((r, k) => (
        <group key={r.event.slug} ref={(g) => void (roomGroups.current[k] = g)}>
          <EventRoom layout={r} total={N} />
        </group>
      ))}
    </group>
  );
}

/** Under each bay, on the frame: its number, and its name (a museum's label — small, and quiet). */
function BayPlaque({ room }: { room: RoomLayout }) {
  const b = bayRect(room);
  const w = 1.5;
  const h = 0.2;
  return (
    <CanvasPanel
      width={w}
      height={h}
      pxPerMeter={420}
      position={[b.x0 + w / 2 + 0.02, FLOOR_Y + b.y0 - 0.16 - h / 2, M.face + 0.004]}
      shading="glow"
      glowStrength={0.85}
      transparent
      drawKey={`plaque-${room.event.slug}`}
      draw={(ctx, cw, ch) => {
        const e = room.event;
        ctx.fillStyle = e.accent;
        ctx.fillRect(0, ch * 0.3, ch * 0.05, ch * 0.4);
        text(ctx, pad2(room.index + 1), ch * 0.22, ch * 0.66, { family: 'mono', weight: 600, size: ch * 0.42, color: 'rgba(239,233,223,0.82)', tracking: 0.04 });
        text(ctx, e.title.toUpperCase(), ch * 1.25, ch * 0.64, { family: 'mono', weight: 600, size: ch * 0.3, color: 'rgba(239,233,223,0.62)', tracking: 0.16 });
      }}
    />
  );
}

/** Across the crown: the one inscription — what this is. */
function Inscription() {
  return (
    <CanvasPanel
      width={6}
      height={0.42}
      pxPerMeter={300}
      position={[0, FLOOR_Y + M.height - M.crown / 2, M.face + 0.004]}
      shading="glow"
      glowStrength={0.7}
      transparent
      drawKey="matrix-inscription"
      draw={(ctx, w, h) => {
        text(ctx, 'ACM — CEG   ·   EVENTS', w / 2, h * 0.68, { family: 'mono', weight: 600, size: h * 0.44, color: 'rgba(239,233,223,0.55)', align: 'center', tracking: 0.42 });
      }}
    />
  );
}

function Matrix() {
  // (Metal reads by what it reflects: without an environment to reflect — the lowest quality — the
  // bronze and steel are given more of their own colour, so the matrix keeps its form under a phone's
  // two lights.)
  const quality = useExperience((st) => st.quality);
  const reflects = QUALITY[quality].environmentMap;
  const mats = useDisposable<Materials>(
    () => ({
      bronze: new MeshStandardMaterial({ color: reflects ? '#3b3129' : '#5a4a3c', roughness: reflects ? 0.42 : 0.55, metalness: reflects ? 0.72 : 0.3 }),
      stone: new MeshStandardMaterial({ color: reflects ? '#1f1d1b' : '#2a2724', roughness: 0.86, metalness: 0.05 }),
      liner: new MeshStandardMaterial({ color: '#0f0f11', roughness: 0.38, metalness: reflects ? 0.6 : 0.25 }),
      edge: new MeshStandardMaterial({ color: '#b39a7c', roughness: 0.3, metalness: reflects ? 0.85 : 0.35, emissive: new Color('#ffcf9a'), emissiveIntensity: reflects ? 0.06 : 0.16 }),
      strips: EVENT_ROOMS.map(() => new MeshBasicMaterial({ color: new Color('#ffd9a8'), toneMapped: false })),
      veils: EVENT_ROOMS.map(() => new MeshBasicMaterial({ color: '#050506', transparent: true, opacity: 1, depthWrite: false })),
      traces: EVENT_ROOMS.map(
        (r) =>
          new ShaderMaterial({
            vertexShader: TRACE_VERT,
            fragmentShader: TRACE_FRAG,
            uniforms: {
              uT: { value: 0 },
              uLit: { value: 0 },
              uSize: { value: [M.bay.w + 1.1, M.bay.h + 1.0] },
              uBay: { value: [0.55 / (M.bay.w + 1.1), 0.5 / (M.bay.h + 1.0), (0.55 + M.bay.w) / (M.bay.w + 1.1), (0.5 + M.bay.h) / (M.bay.h + 1.0)] },
              uColor: { value: new Color('#f4f1ea') },
            },
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
            toneMapped: false,
          }),
      ),
    }),
    [reflects],
  );

  useFrame(() => {
    const F = eventsFrame;
    const v = F.view;
    let litMax = 0;
    for (let i = 0; i < N; i++) litMax = Math.max(litMax, F.lit[i]);
    for (let i = 0; i < N; i++) {
      const lit = F.lit[i];
      // Coming up out of the dark as the camera arrives: first the bays' light, then — one after
      // another — the rooms themselves.
      // One architectural object, one reveal. The old per-row stagger ended
      // above 1 for the last bays, so they stayed veiled even at the full view.
      const arrive = sstep(0.18, 0.5, v.reveal);
      const worlds = sstep(0.45, 0.85, v.reveal);
      // The one under the pointer: its room clear, the others quieter (never gone).
      const quiet = 0.24 * Math.max(0, litMax - lit);
      const entering = v.index === i ? v.enter : 0;
      mats.veils[i].opacity = Math.max(0, Math.min(1, (1 - worlds) * 0.94 + quiet) * (1 - entering));
      mats.veils[i].visible = mats.veils[i].opacity > 0.003;
      mats.strips[i].color.setRGB(1, 0.85, 0.66).multiplyScalar((0.35 + 1.25 * arrive) * (1 + 0.9 * lit - 0.35 * Math.max(0, litMax - lit)));
      const tr = mats.traces[i];
      tr.uniforms.uT.value = F.trace[i];
      tr.uniforms.uLit.value = lit;
      tr.visible = lit > 0.003;
    }
  });

  return (
    <group name="events-matrix">
      {BLOCKS.map((bk) => (
        <Column key={bk.b} bk={bk} mats={mats} />
      ))}
    </group>
  );
}

// ─── The passage ────────────────────────────────────────────────────────────

function Passage() {
  const kit = useKit();
  const geo = useDisposable(() => {
    const len = PASS.z0 - PASS.z1;
    const zc = (PASS.z0 + PASS.z1) / 2;
    const walls = merge([
      place(metricBox(0.4, PASS.height, len), { position: [-(PASS.halfWidth + 0.2), FLOOR_Y + PASS.height / 2, zc] }),
      place(metricBox(0.4, PASS.height, len), { position: [PASS.halfWidth + 0.2, FLOOR_Y + PASS.height / 2, zc] }),
    ]);
    const ceiling = place(metricBox(2 * PASS.halfWidth + 0.8, 0.3, len), { position: [0, FLOOR_Y + PASS.height + 0.15, zc] });
    const slot = merge([-2.6, 2.6].map((x) => place(metricBox(0.08, 0.03, len - 2.5), { position: [x, FLOOR_Y + PASS.height - 0.02, zc] })));
    return { walls, ceiling, slot };
  }, []);
  return (
    <group name="events-passage">
      <mesh geometry={geo.walls} material={kit.concreteDark} />
      <mesh geometry={geo.ceiling} material={kit.ceiling} />
      <mesh geometry={geo.slot} material={kit.lightCool} />
      <Portal />
    </group>
  );
}

// ─── Light ──────────────────────────────────────────────────────────────────

/**
 * The hall's light, placed for the light pool (systems/lighting): only the few anchors nearest the
 * camera are lit, so the nearest are the ones that matter — from wherever the whole matrix is framed,
 * the light above and before it, then its key; closer, the washes either side; in the passage, its own.
 */
function HallLights() {
  const anchors = useGainedLightAnchors(
    useMemo(
      () => [
        // (These two ask for their light first — priority — so even a phone's two stay on the matrix,
        // not on the lobby's behind the camera.)
        { position: new Vector3(0, FLOOR_Y + 12, M.face + 9), color: new Color('#dfe6f5'), intensity: 70, distance: 26, priority: 5 },
        { position: new Vector3(0, FLOOR_Y + 9.5, M.face + 7), color: new Color('#ffe6c8'), intensity: 105, distance: 24, priority: 5 },
        { position: new Vector3(-8.5, FLOOR_Y + 3.2, M.face + 3.5), color: new Color('#ffc995'), intensity: 30, distance: 12 },
        { position: new Vector3(8.5, FLOOR_Y + 3.2, M.face + 3.5), color: new Color('#ffc995'), intensity: 30, distance: 12 },
        { position: new Vector3(0, FLOOR_Y + PASS.height - 1, PASS.z0 - 6), color: new Color('#cfdcff'), intensity: 30, distance: 13 },
        { position: new Vector3(0, FLOOR_Y + PASS.height - 1, PASS.z1 + 5), color: new Color('#cfdcff'), intensity: 26, distance: 12 },
      ],
      [],
    ),
  );
  useFrame(() => {
    const v = eventsFrame.view;
    // The hall first, then the matrix's own light, as the camera arrives; in a room, all of it down.
    const hall = 0.55 + 0.45 * sstep(0, 0.4, v.reveal);
    const matrix = sstep(0.15, 0.6, v.reveal);
    let litMax = 0;
    for (let i = 0; i < N; i++) litMax = Math.max(litMax, eventsFrame.lit[i]);
    const quiet = 1 - 0.12 * litMax;
    anchors[0].gain = hall * quiet;
    anchors[1].gain = matrix * quiet;
    anchors[2].gain = matrix * quiet;
    anchors[3].gain = matrix * quiet;
  });
  return null;
}

// ─── Where the interface finds it ───────────────────────────────────────────

/**
 * The matrix on screen, for its interface (EventsUI): each bay's opening (its hit area and its
 * tracing), and the matrix's foot (where the way on to the Crew is offered) — corners in the world,
 * projected every frame after the camera is placed (systems/anchors).
 */
function MatrixAnchors() {
  useEffect(() => {
    const off: (() => void)[] = [];
    for (const r of EVENT_ROOMS) {
      const b = bayRect(r);
      const col = columnOf(r.col);
      const a = new Vector3();
      const c = new Vector3();
      const at = (out: Vector3, x: number, y: number) => {
        const { side, sink } = splitOffsets(eventsFrame.view.split);
        return out.set(x + col * side, FLOOR_Y + y - (col === 0 ? sink : 0), M.face);
      };
      off.push(trackAnchor(`events:bay:${r.index}:a`, () => at(a, b.x0, b.y1)));
      off.push(trackAnchor(`events:bay:${r.index}:b`, () => at(c, b.x1, b.y0)));
    }
    const foot = new Vector3(0, FLOOR_Y + 0.02, M.face + 0.6);
    const head = new Vector3(0, FLOOR_Y + M.height, M.face);
    off.push(trackAnchor('events:foot', () => foot));
    off.push(trackAnchor('events:head', () => head));
    return () => off.forEach((f) => f());
  }, []);
  return null;
}

export function EventsHall() {
  return (
    <group name="events">
      <Hall />
      <Matrix />
      <Passage />
      <HallLights />
      <MatrixAnchors />
    </group>
  );
}
