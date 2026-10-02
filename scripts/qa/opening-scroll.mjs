// The authored beat sheet and later track lengths must survive opening-scroll compression.
// node scripts/qa/opening-scroll.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const moduleURL = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64')}`;
const introURL = moduleURL(readFileSync(new URL('../../src/intro/timeline.ts', import.meta.url), 'utf8'));
const { T, INTRO_START, INTRO_END, INTRO_VH_PER_BEAT, introScrollAt, introBeatAt } = await import(introURL);
const { SCROLL_LENGTH_VH, SEGMENTS, EVENTS_VH } = await import(moduleURL(
  readFileSync(new URL('../../src/config/timeline.ts', import.meta.url), 'utf8').replace('@/intro/timeline', introURL),
));
// Before this pass: preserve the existing early-only 18% reduction and the author's cadence.
const previousRanges = [
  [INTRO_START, T.prologue, 1], [T.prologue, T.clearing, 0.94 * 0.82],
  [T.clearing, T.heroEnd, 0.82], [T.heroEnd, T.rise, 0.94 * 0.82], [T.rise, INTRO_END, 1],
];
const previous = (t) => previousRanges.reduce((sum, [from, to, density]) =>
  sum + Math.max(0, Math.min(t, to) - from) * INTRO_VH_PER_BEAT * density, 0);
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} != ${expected}`);
const oldDistance = previous(T.shaft) - previous(T.prologue);
const newDistance = introScrollAt(T.shaft) - introScrollAt(T.prologue);
const reduction = 1 - newDistance / oldDistance;
assert.ok(reduction >= 0.15 && reduction <= 0.20, `opening reduction outside 15–20%: ${reduction}`);
close(introScrollAt(T.prologue), previous(T.prologue), 'unchanged cyclic mist / initial frame');
let sampledBeats = 0;
for (let t = INTRO_START; t <= INTRO_END; t += 0.025) {
  sampledBeats++;
  close(introBeatAt(introScrollAt(t)), t, `forward/reverse inverse at ${t}`);
  assert.ok(introScrollAt(t + 0.001) > introScrollAt(t), `non-monotonic mapping at ${t}`);
  if (t >= T.prologue && t <= T.wellOpen) {
    close(introScrollAt(t) - introScrollAt(T.prologue), (previous(t) - previous(T.prologue)) * 0.8, `entire opening compressed at ${t}`);
  }
  if (t >= T.shaft) close(introScrollAt(t) - introScrollAt(T.shaft), previous(t) - previous(T.shaft), `later tunnel/door cadence at ${t}`);
}
for (const t of [T.prologue, T.story1, T.clearing, T.heroEnd, T.rise, T.descend, T.wellOpen, T.shaft, INTRO_END]) {
  assert.ok(introScrollAt(t + 1e-6) - introScrollAt(t - 1e-6) < 0.00003, `distance jump at ${t}`);
}
const h = 0.0001;
close((introScrollAt(T.shaft) - introScrollAt(T.shaft - h)) / h,
  INTRO_VH_PER_BEAT - h * INTRO_VH_PER_BEAT * 0.2 / (2 * (T.shaft - T.wellOpen)), 'smooth return to tunnel cadence');
close(introBeatAt(-1), INTRO_START, 'lower clamp');
close(introBeatAt(introScrollAt(INTRO_END) + 1), INTRO_END, 'upper clamp');
for (const [id, vh] of [['events', Object.values(EVENTS_VH).reduce((a, b) => a + b, 0)], ['portal', 210 * 0.94], ['teams', 720], ['return', 300]]) {
  close((SEGMENTS[id].end - SEGMENTS[id].start) * SCROLL_LENGTH_VH, vh, `unchanged ${id} scroll distance`);
}
const oldTotal = previous(INTRO_END) + 1430 + 210 * 0.94 + 720 + 300;
console.log(JSON.stringify({
  passed: true, sampledBeats, openingBeats: [T.prologue, T.shaft],
  previous: { distanceVH: oldDistance, progress: [previous(T.prologue) / oldTotal, previous(T.shaft) / oldTotal] },
  current: { distanceVH: newDistance, progress: [introScrollAt(T.prologue) / SCROLL_LENGTH_VH, introScrollAt(T.shaft) / SCROLL_LENGTH_VH] },
  reductionPercent: reduction * 100, laterSegmentsUnchanged: true,
}, null, 2));
