#!/usr/bin/env node
/**
 * THE CREW's member portraits: from the chapter's photographs to the prints on
 * the member cards (src/teams/ui/MemberHand.tsx).
 *
 *   node scripts/crew-portraits.mjs ["acm photos"]
 *
 * Who is who comes from the FILE NAMES — each photograph is named after its
 * member — never from order or appearance. A name is matched to exactly one
 * member of src/content/teams.ts:
 *
 *   exact      the same letters, ignoring case, spaces and punctuation
 *              ("Manesh Ram.png" → Manesh Ram)
 *   prefix     the start of the member's name — a first name, or first names
 *              run together ("Prithvi.png", "SankaraKrishnan.png" → Sankara
 *              Krishnan P, "Swayam.png" → Swayamprabha Narayanan)
 *   spelling   one letter off the member's first name, and no other member's
 *              ("Viswam.png" → Visvam Srinivasan)
 *
 * Anything else — a file that matches nobody, or more than one member, or two
 * files for one member, or a member without a file — stops the script with the
 * list. Nothing is guessed.
 *
 * Each print is framed from the face in it (macOS Vision, run once here — the
 * site never detects anything): every face the same size, at the same place on
 * the card, whatever the photograph's own framing. Then it is made part of the
 * card: its black ground becomes the card's own dark coat (the tones are mapped
 * from the coat's shade to a warm paper white, and the ground is let go of, so
 * no edge of the photograph shows), and it fades out under the name and above
 * the foot. The result is one WebP per member, and the member → print table the
 * cards read (src/content/generated/crew-portraits.json).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const root = process.cwd();
const sourceDir = join(root, process.argv[2] ?? 'acm photos');
const outDir = join(root, 'public', 'media', 'crew');
const dataFile = join(root, 'src', 'content', 'generated', 'crew-portraits.json');

// ─── The card (card-width units; MemberHand's card is 1 × 1.42) ──────────────
/** The print's band on the card: from under the name block to above the foot. */
const PRINT = { top: 0.4, height: 0.92 };
/**
 * Where every face goes, and how tall (Vision's face box: brows to chin): large enough that the person,
 * not the card, is what the eye finds — the head filling the band under the name, the hair clear of it.
 */
const FACE = { x: 0.5, y: 0.87, h: 0.3 };
const CHIN = FACE.y + FACE.h / 2;
/** Pixels per card width: a drawn card on a 2× desktop is ~820 px wide. */
const PPU = 820;
/**
 * How much larger than its photograph a print may be made. The photographs whose faces are smallest
 * in their frames set it (janis.png, about 1.19× at this face size): a little enlargement there keeps
 * every other print at its photograph's full detail, rather than all of them made coarser to spare one.
 */
const ENLARGE_MAX = 1.25;
/** Fades, in card units: in below the name, out (slowly) from the chin to above the foot, and at the sides. */
const FADE = { topFrom: 0.4, topTo: 0.6, bottomFrom: CHIN - 0.0075, bottomTo: 1.31, side: 0.13, edge: 0.04 };
/** Printed down below the chin, as a darkroom print is: the face stays the brightest thing on it. */
const BURN = { from: CHIN + 0.0175, to: CHIN + 0.2975, amount: 0.34 };
/** The coat under the print (hand-card background at the face's height) and the paper white. */
const SHADOW = [17, 17, 21];
const PAPER = [243, 238, 229];

// ─── Who is who ──────────────────────────────────────────────────────────────
const { TEAM_DOMAINS } = await import(pathToFileURL(join(root, 'src/content/teams.ts')).href);
const members = TEAM_DOMAINS.flatMap((d) => d.members.map((name) => ({ name, domain: d.name })));

const letters = (s) => s.normalize('NFKD').toLowerCase().replace(/[^a-z]/g, '');
const firstName = (s) => s.normalize('NFKD').toLowerCase().split(/[^a-z]+/).filter(Boolean)[0] ?? '';
const slugOf = (s) => s.normalize('NFKD').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join('-');
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function memberFor(file) {
  const f = letters(basename(file, extname(file)));
  const one = (how, hits) => (hits.length === 1 ? { member: hits[0], how } : hits.length > 1 ? { ambiguous: hits.map((m) => m.name) } : null);
  return (
    one('exact', members.filter((m) => letters(m.name) === f)) ??
    (f.length >= 4 ? one('prefix', members.filter((m) => letters(m.name).startsWith(f))) : null) ??
    one('spelling', members.filter((m) => distance(f, firstName(m.name)) <= 1)) ?? { none: true }
  );
}

if (!existsSync(sourceDir)) throw new Error(`No photographs at ${sourceDir}`);
const files = readdirSync(sourceDir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && !f.startsWith('.')).sort();
const problems = [];
const byMember = new Map();
for (const file of files) {
  const r = memberFor(file);
  if (r.ambiguous) problems.push(`${file}: matches more than one member (${r.ambiguous.join(', ')})`);
  else if (r.none) problems.push(`${file}: matches no member`);
  else if (byMember.has(r.member.name)) problems.push(`${file}: ${r.member.name} already has ${byMember.get(r.member.name).file}`);
  else byMember.set(r.member.name, { file, how: r.how, ...r.member });
}
for (const m of members) if (!byMember.has(m.name)) problems.push(`${m.name} (${m.domain}): no photograph`);
if (problems.length) {
  console.error('[crew-portraits] stopped — the photographs and the crew do not match one to one:\n  ' + problems.join('\n  '));
  process.exit(1);
}

// ─── Faces (macOS Vision, through JavaScript for Automation) ─────────────────
const previous = existsSync(dataFile) ? JSON.parse(readFileSync(dataFile, 'utf8')) : { members: {} };
const sha = (file) => createHash('sha256').update(readFileSync(join(sourceDir, file))).digest('hex');
function detectFaces(paths) {
  const script = join(tmpdir(), `crew-faces-${process.pid}.js`);
  writeFileSync(
    script,
    `ObjC.import('Foundation'); ObjC.import('Vision');
function run(argv) {
  return JSON.stringify(argv.map((path) => {
    const handler = $.VNImageRequestHandler.alloc.initWithURLOptions($.NSURL.fileURLWithPath(path), $.NSDictionary.dictionary);
    const req = $.VNDetectFaceRectanglesRequest.alloc.init;
    handler.performRequestsError($.NSArray.arrayWithObject(req), null);
    const faces = [];
    for (let i = 0; i < req.results.count; i++) {
      const o = req.results.objectAtIndex(i), b = o.boundingBox;
      faces.push({ x: b.origin.x, y: b.origin.y, w: b.size.width, h: b.size.height, confidence: o.confidence });
    }
    return faces;
  }));
}`,
  );
  try {
    return JSON.parse(execFileSync('osascript', ['-l', 'JavaScript', script, ...paths], { encoding: 'utf8', maxBuffer: 1 << 24 }));
  } catch {
    return null;
  } finally {
    rmSync(script, { force: true });
  }
}
const entries = [...byMember.values()];
const detected = process.platform === 'darwin' ? detectFaces(entries.map((e) => join(sourceDir, e.file))) : null;
entries.forEach((e, i) => {
  e.sha256 = sha(e.file);
  const faces = detected?.[i];
  if (faces && faces.length === 1) {
    const f = faces[0];
    // (Vision's box is normalised with its origin at the bottom left.)
    e.face = { cx: f.x + f.w / 2, cy: 1 - (f.y + f.h / 2), w: f.w, h: f.h, confidence: +f.confidence.toFixed(3) };
    return;
  }
  const cached = previous.members?.[e.name];
  if (cached?.source?.sha256 === e.sha256 && cached.face) e.face = cached.face;
  else problems.push(`${e.file}: ${faces ? `${faces.length} faces found` : 'face detection unavailable'} (the framing needs exactly one face)`);
});
if (problems.length) {
  console.error('[crew-portraits] stopped:\n  ' + problems.join('\n  '));
  process.exit(1);
}

// ─── The prints ──────────────────────────────────────────────────────────────
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Box blur, three passes (≈ gaussian), on a W×H float field. */
function blur(src, W, H, r) {
  let a = Float32Array.from(src);
  let b = new Float32Array(a.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < H; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += a[y * W + Math.min(W - 1, Math.max(0, x))];
      for (let x = 0; x < W; x++) {
        b[y * W + x] = acc / (2 * r + 1);
        acc += a[y * W + Math.min(W - 1, x + r + 1)] - a[y * W + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += b[Math.min(H - 1, Math.max(0, y)) * W + x];
      for (let y = 0; y < H; y++) {
        a[y * W + x] = acc / (2 * r + 1);
        acc += b[Math.min(H - 1, y + r + 1) * W + x] - b[Math.max(0, y - r) * W + x];
      }
    }
  }
  return a;
}

mkdirSync(outDir, { recursive: true });
const OW = PPU;
const OH = Math.round(PRINT.height * PPU);
const out = { note: 'Generated by scripts/crew-portraits.mjs — do not edit by hand.', print: PRINT, face: FACE, members: {} };
const written = new Set();
for (const e of entries) {
  // (Upright, one grey channel.)
  const grey = () => sharp(join(sourceDir, e.file)).rotate().removeAlpha().greyscale();
  const { data: probe, info } = await grey().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) throw new Error(`${e.file}: expected one channel, got ${info.channels}`);
  const [SW, SH] = [info.width, info.height];
  // The ground's own black: the median of the photograph's upper border (and its sides, above the shoulders).
  const ring = [];
  for (let y = 0; y < Math.round(SH * 0.08); y += 3) for (let x = 0; x < SW; x += 7) ring.push(probe[y * SW + x]);
  for (let y = 0; y < Math.round(SH * 0.55); y += 7) for (const x of [2, 10, SW - 11, SW - 3]) ring.push(probe[y * SW + x]);
  ring.sort((a, b) => a - b);
  const ground = ring[Math.floor(ring.length / 2)] / 255;

  // Framing: the face to FACE.h of a card width, its centre to (FACE.x, FACE.y).
  const s = (FACE.h * PPU) / (e.face.h * SH);
  if (s > ENLARGE_MAX) throw new Error(`${e.file}: would need enlarging ${s.toFixed(2)}× (more than ${ENLARGE_MAX}×)`);
  const RW = Math.round(SW * s);
  const RH = Math.round(SH * s);
  const ox = Math.round(FACE.x * PPU - e.face.cx * RW);
  const oy = Math.round((FACE.y - PRINT.top) * PPU - e.face.cy * RH);
  const scaled = await grey().resize(RW, RH, { kernel: 'lanczos3' }).raw().toBuffer();
  if (scaled.length !== RW * RH) throw new Error(`${e.file}: unexpected buffer size`);

  const L = new Float32Array(OW * OH);
  const inside = new Float32Array(OW * OH);
  for (let y = 0; y < OH; y++)
    for (let x = 0; x < OW; x++) {
      const sx = x - ox;
      const sy = y - oy;
      if (sx < 0 || sy < 0 || sx >= RW || sy >= RH) continue;
      L[y * OW + x] = scaled[sy * RW + sx] / 255;
      // Feathered at the photograph's own edges, wherever they fall on the card.
      const d = Math.min(sx, sy, RW - 1 - sx, RH - 1 - sy) / PPU;
      inside[y * OW + x] = smoothstep(0, FADE.edge, d);
    }
  // Let go of the ground: where the photograph is its own black (a soft matte, so no stroke of the
  // person is cut and no speck of the ground stays), the card's coat shows instead.
  const matte = blur(L, OW, OH, 4);
  const rgba = Buffer.alloc(OW * OH * 4);
  for (let y = 0; y < OH; y++) {
    const cy = PRINT.top + y / PPU;
    const out = 1 - smoothstep(FADE.bottomFrom, FADE.bottomTo, cy);
    const vertical = smoothstep(FADE.topFrom, FADE.topTo, cy) * out * out;
    const burn = 1 - BURN.amount * smoothstep(BURN.from, BURN.to, cy);
    for (let x = 0; x < OW; x++) {
      const i = y * OW + x;
      const cx = x / PPU;
      const sides = smoothstep(0, FADE.side, cx) * smoothstep(0, FADE.side, 1 - cx);
      const alpha = smoothstep(ground + 0.012, ground + 0.1, matte[i]) * inside[i] * vertical * sides;
      const l = L[i] * burn;
      rgba[i * 4] = Math.round(SHADOW[0] + (PAPER[0] - SHADOW[0]) * l);
      rgba[i * 4 + 1] = Math.round(SHADOW[1] + (PAPER[1] - SHADOW[1]) * l);
      rgba[i * 4 + 2] = Math.round(SHADOW[2] + (PAPER[2] - SHADOW[2]) * l);
      rgba[i * 4 + 3] = Math.round(255 * alpha);
    }
  }
  const slug = slugOf(e.name);
  const name = `${slug}.webp`;
  await sharp(rgba, { raw: { width: OW, height: OH, channels: 4 } }).webp({ quality: 82, alphaQuality: 88, effort: 6 }).toFile(join(outDir, name));
  written.add(name);
  out.members[e.name] = {
    src: `/media/crew/${name}`,
    width: OW,
    height: OH,
    source: { file: e.file, match: e.how, sha256: e.sha256 },
    face: Object.fromEntries(Object.entries(e.face).map(([k, v]) => [k, +(+v).toFixed(4)])),
    scale: +s.toFixed(4),
  };
  console.log(`${e.file.padEnd(22)} → ${e.name.padEnd(24)} (${e.how.padEnd(8)}) ${e.domain.padEnd(50)} → ${name}  scale ${s.toFixed(3)}  ground ${ground.toFixed(3)}`);
}
// (A print no member has any more is removed, so a renamed member never keeps a stale one.)
for (const f of readdirSync(outDir)) if (f.endsWith('.webp') && !written.has(f)) rmSync(join(outDir, f));
writeFileSync(dataFile, JSON.stringify(out, null, 2) + '\n');
console.log(`[crew-portraits] ${entries.length} prints → public/media/crew, table → src/content/generated/crew-portraits.json`);
