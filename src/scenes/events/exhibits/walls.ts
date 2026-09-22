/**
 * Wall projections for every exhibit. Each room's back and side walls are one
 * wraparound projection that plays its event as you stand inside it, drawn
 * with Canvas 2D from the visit progress `u` (0 → 1, scrubbable) and time `t`.
 *
 * Facts stay facts: anything stated (who it's for, what it covers, sponsors,
 * prizes) comes from the event record; everything else is illustration.
 */
import { PRODIGY_PROGRAMME } from '@/content/prodigy';
import { fitSize, paragraph, text } from '@/systems/textures/typeset';
import { BONE, clamp01, DIM, hash, pad2, ramp, roundRect, sstep, titleBand, typed, type WallDraw } from './common';

const fact = (info: { ev: { facts: { label: string; value: string }[] } }, label: string, fallback = '') => info.ev.facts.find((f) => f.label === label)?.value ?? fallback;

// ─── Head First: sorting, one swap at a time ───────────────────────────────

/** The array the columns sort (distinct values), and every state of an insertion sort. */
export const SORT = (() => {
  const values = [9, 3, 12, 6, 1, 14, 8, 4, 11, 2, 13, 7, 5, 10];
  const states: { a: number[]; i: number; j: number }[] = [{ a: [...values], i: 1, j: 1 }];
  const a = [...values];
  for (let i = 1; i < a.length; i++) {
    for (let j = i; j > 0 && a[j - 1] > a[j]; j--) {
      [a[j - 1], a[j]] = [a[j], a[j - 1]];
      states.push({ a: [...a], i, j: j - 1 });
    }
  }
  return { values, states };
})();

/** Fractional step through the sort for visit progress u. */
export const sortStep = (u: number) => ramp(u, 0.1, 0.84) * (SORT.states.length - 1);

const headFirst: WallDraw = (ctx, w, h, wall, u, t, info) => {
  ctx.fillStyle = '#0b1018';
  ctx.fillRect(0, 0, w, h);
  const s = h / 100;
  if (wall === 'back') {
    const y0 = titleBand(ctx, w, h, info);
    const k = Math.min(SORT.states.length - 1, Math.floor(sortStep(u)));
    const st = SORT.states[k];
    const done = u > 0.86;
    const code = ['for (i = 1; i < n; i++)', '  for (j = i; j > 0 && a[j-1] > a[j]; j--)', '    swap(a[j-1], a[j]);'];
    code.forEach((line, i) => {
      const hot = !done && u > 0.1 && i === (k % 2 === 0 ? 1 : 2);
      if (hot) {
        ctx.fillStyle = 'rgba(159,180,201,0.18)';
        ctx.fillRect(w * 0.045, y0 + s * (6 + i * 8) - s * 5.2, w * 0.5, s * 7);
      }
      text(ctx, line, w * 0.05, y0 + s * (6 + i * 8), { family: 'mono', size: s * 4.2, color: hot ? '#ffffff' : 'rgba(239,233,223,0.72)' });
    });
    // The array, as numbers, with the pair being compared.
    const cw = (w * 0.9) / st.a.length;
    st.a.forEach((v, i) => {
      const x = w * 0.05 + i * cw;
      const y = y0 + s * 40;
      const hot = !done && u > 0.1 && (i === st.j || i === st.j + 1);
      ctx.fillStyle = hot ? '#e8c07a' : done ? 'rgba(159,211,168,0.25)' : 'rgba(239,233,223,0.08)';
      ctx.fillRect(x + cw * 0.06, y - s * 9, cw * 0.88, s * 12);
      text(ctx, String(v), x + cw / 2, y, { family: 'mono', weight: 500, size: s * 6, color: hot ? '#10131a' : BONE, align: 'center' });
    });
    text(ctx, done ? 'sorted ✓  — every journey starts with the fundamentals.' : `i = ${st.i}    j = ${st.j}    step ${k} / ${SORT.states.length - 1}`, w * 0.05, y0 + s * 58, {
      family: 'mono',
      size: s * 3.6,
      color: done ? '#9fd3a8' : DIM,
    });
    return;
  }
  if (wall === 'left') {
    const hello = typed('hello, world', u + 0.3, 0.05, 0.4);
    const size = fitSize(ctx, 'hello, world_', w * 0.8, { family: 'mono', size: s * 18 }, s * 18);
    text(ctx, hello + (Math.floor(t * 2) % 2 ? '_' : ' '), w * 0.08, h * 0.42, { family: 'mono', size, color: BONE });
    text(ctx, 'FOR', w * 0.08, h * 0.62, { family: 'mono', size: s * 3, color: DIM, tracking: 0.24 });
    text(ctx, fact(info, 'For', 'First-year students'), w * 0.08, h * 0.7, { family: 'sans', weight: 600, size: s * 6, color: BONE });
    text(ctx, 'FOCUS', w * 0.08, h * 0.8, { family: 'mono', size: s * 3, color: DIM, tracking: 0.24 });
    paragraph(ctx, fact(info, 'Focus'), w * 0.08, h * 0.88, w * 0.84, s * 6.5, { family: 'sans', weight: 600, size: s * 5.4, color: BONE }, 2);
    return;
  }
  // Right: the basic data structures, moving.
  const draws = [
    { name: 'STACK', x: 0.1 },
    { name: 'QUEUE', x: 0.42 },
    { name: 'LINKED LIST', x: 0.72 },
  ];
  draws.forEach((d, n) => {
    text(ctx, d.name, w * d.x, h * 0.18, { family: 'mono', size: s * 3.4, color: DIM, tracking: 0.24 });
    const phase = (t * 0.6 + n) % 4;
    if (n === 0) {
      const height = 2 + Math.floor(phase);
      for (let i = 0; i < height; i++) {
        ctx.fillStyle = i === height - 1 ? '#9fb4c9' : 'rgba(159,180,201,0.35)';
        ctx.fillRect(w * d.x, h * (0.8 - i * 0.1), w * 0.2, h * 0.08);
      }
    } else if (n === 1) {
      for (let i = 0; i < 5; i++) {
        const x = w * (d.x + i * 0.05) - ((phase % 1) * w * 0.05);
        ctx.fillStyle = `rgba(159,180,201,${0.25 + i * 0.12})`;
        ctx.fillRect(x, h * 0.48, w * 0.04, h * 0.14);
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const x = w * (d.x + i * 0.085);
        ctx.strokeStyle = '#9fb4c9';
        ctx.lineWidth = s * 0.5;
        ctx.strokeRect(x, h * (0.5 + i * 0.1), w * 0.05, h * 0.08);
        if (i < 2) {
          ctx.beginPath();
          ctx.moveTo(x + w * 0.05, h * (0.54 + i * 0.1));
          ctx.lineTo(x + w * 0.085, h * (0.64 + i * 0.1));
          ctx.stroke();
        }
      }
    }
  });
};

// ─── CodeX: contest night ─────────────────────────────────────────────────

const PROBLEMS = ['A', 'B', 'C', 'D', 'E', 'F'];
export const BALLOON_COLORS = ['#e05252', '#e8a33d', '#e8d84a', '#4fb56b', '#3d7be0', '#9a5fd1'];
const PROBLEM_TOPICS = ['Two pointers', 'Binary search', 'Graphs', 'Dynamic programming', 'Number theory', 'Segment trees'];

/** When (0..1 through the contest) team `t` solves problem `p`, or > 1 if never. */
export const solveAt = (team: number, p: number) => {
  const skill = 0.55 + hash(team * 3.1) * 0.5;
  const difficulty = 0.08 + p * 0.13;
  const r = hash(team * 17 + p * 7);
  return r > skill + 0.2 - p * 0.08 ? 2 : difficulty / skill + r * 0.18;
};
export const contestT = (u: number) => ramp(u, 0.02, 0.92);

const codex: WallDraw = (ctx, w, h, wall, u, t, info) => {
  ctx.fillStyle = '#05070b';
  ctx.fillRect(0, 0, w, h);
  const s = h / 100;
  const ct = contestT(u);
  if (wall === 'back') {
    const y0 = titleBand(ctx, w, h, info);
    const remaining = Math.round((1 - ct) * 7200);
    const clock = `${pad2(Math.floor(remaining / 3600))}:${pad2(Math.floor((remaining % 3600) / 60))}:${pad2(remaining % 60)}`;
    text(ctx, ct >= 1 ? 'FINAL' : clock, w * 0.955, s * 20, { family: 'mono', weight: 500, size: s * 11, color: ct >= 1 ? '#e8c07a' : BONE, align: 'right' });
    // Standings.
    const teams = Array.from({ length: 8 }, (_, team) => {
      const solved = PROBLEMS.map((_, p) => solveAt(team, p) <= ct);
      const pen = PROBLEMS.reduce((a, _, p) => a + (solveAt(team, p) <= ct ? solveAt(team, p) : 0), 0);
      return { team, solved, n: solved.filter(Boolean).length, pen };
    }).sort((a, b) => b.n - a.n || a.pen - b.pen);
    const rowH = s * 7.4;
    const tx = w * 0.05;
    PROBLEMS.forEach((p, i) => text(ctx, p, w * (0.5 + i * 0.07), y0 + s * 4, { family: 'mono', size: s * 3.4, color: DIM, align: 'center' }));
    text(ctx, 'SOLVED', w * 0.95, y0 + s * 4, { family: 'mono', size: s * 3, color: DIM, align: 'right', tracking: 0.2 });
    teams.forEach((row, r) => {
      const y = y0 + s * 12 + r * rowH;
      ctx.fillStyle = r % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(tx, y - rowH * 0.7, w * 0.9, rowH * 0.92);
      text(ctx, `${r + 1}`, tx + w * 0.015, y, { family: 'mono', size: s * 4, color: r === 0 && row.n ? '#e8c07a' : DIM });
      text(ctx, `Team ${pad2(row.team + 1)}`, tx + w * 0.06, y, { family: 'sans', weight: 600, size: s * 4.2, color: BONE });
      row.solved.forEach((ok, p) => {
        const cx = w * (0.5 + p * 0.07);
        if (ok) {
          ctx.fillStyle = BALLOON_COLORS[p];
          ctx.beginPath();
          ctx.arc(cx, y - s * 1.4, s * 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else text(ctx, '·', cx, y, { family: 'mono', size: s * 4, color: 'rgba(255,255,255,0.2)', align: 'center' });
      });
      text(ctx, String(row.n), w * 0.95, y, { family: 'mono', weight: 500, size: s * 4.4, color: BONE, align: 'right' });
    });
    return;
  }
  if (wall === 'left') {
    text(ctx, 'PROBLEM SET', w * 0.08, h * 0.16, { family: 'mono', size: s * 3.4, color: DIM, tracking: 0.26 });
    PROBLEMS.forEach((p, i) => {
      const y = h * (0.26 + i * 0.12);
      ctx.fillStyle = BALLOON_COLORS[i];
      ctx.beginPath();
      ctx.arc(w * 0.1, y - s * 2.2, s * 3, 0, Math.PI * 2);
      ctx.fill();
      text(ctx, p, w * 0.1, y - s * 0.6, { family: 'mono', weight: 500, size: s * 3.6, color: '#0b0b0c', align: 'center' });
      text(ctx, PROBLEM_TOPICS[i], w * 0.16, y, { family: 'sans', weight: 600, size: s * 5.4, color: BONE });
    });
    return;
  }
  text(ctx, 'EVERY CONTEST GETS', w * 0.08, h * 0.2, { family: 'mono', size: s * 3.4, color: DIM, tracking: 0.26 });
  text(ctx, 'an editorial.', w * 0.08, h * 0.33, { family: 'serif', italic: true, size: s * 10, color: BONE });
  text(ctx, 'SESSIONS ON', w * 0.08, h * 0.5, { family: 'mono', size: s * 3.4, color: DIM, tracking: 0.26 });
  paragraph(ctx, fact(info, 'Sessions'), w * 0.08, h * 0.58, w * 0.84, s * 7, { family: 'sans', weight: 600, size: s * 6, color: BONE }, 2);
  text(ctx, 'AND', w * 0.08, h * 0.77, { family: 'mono', size: s * 3.4, color: DIM, tracking: 0.26 });
  text(ctx, fact(info, 'Also'), w * 0.08, h * 0.86, { family: 'sans', weight: 700, size: s * 6.4, color: '#7fb0ff' });
};

// ─── C.O.D.E: the whiteboard round ─────────────────────────────────────────

const BOXES: { label: string; x: number; y: number; at: number }[] = [
  { label: 'Client', x: 0.1, y: 0.55, at: 0.06 },
  { label: 'Load balancer', x: 0.3, y: 0.55, at: 0.16 },
  { label: 'API', x: 0.52, y: 0.4, at: 0.26 },
  { label: 'API', x: 0.52, y: 0.55, at: 0.3 },
  { label: 'API', x: 0.52, y: 0.7, at: 0.34 },
  { label: 'Cache', x: 0.74, y: 0.42, at: 0.44 },
  { label: 'Database', x: 0.74, y: 0.66, at: 0.5 },
];
const ARROWS: [number, number, number][] = [
  [0, 1, 0.12],
  [1, 2, 0.24],
  [1, 3, 0.28],
  [1, 4, 0.32],
  [3, 5, 0.42],
  [3, 6, 0.48],
];

const code: WallDraw = (ctx, w, h, wall, u, t, info) => {
  const s = h / 100;
  if (wall === 'back') {
    ctx.fillStyle = '#dcd9d0';
    ctx.fillRect(0, 0, w, h);
    titleBand(ctx, w, h, info, '#16181c', 'rgba(22,24,28,0.55)');
    const bw = w * 0.13;
    const bh = h * 0.1;
    ctx.lineCap = 'round';
    ARROWS.forEach(([a, b, at]) => {
      const k = ramp(u, at, at + 0.06);
      if (k <= 0) return;
      const A = BOXES[a];
      const B = BOXES[b];
      const x0 = w * A.x + bw / 2;
      const y0 = h * A.y;
      const x1 = w * B.x - bw / 2;
      const y1 = h * B.y;
      ctx.strokeStyle = '#27415f';
      ctx.lineWidth = s * 0.6;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k);
      ctx.stroke();
      if (k >= 1) {
        const ang = Math.atan2(y1 - y0, x1 - x0);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - Math.cos(ang - 0.4) * s * 2.4, y1 - Math.sin(ang - 0.4) * s * 2.4);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - Math.cos(ang + 0.4) * s * 2.4, y1 - Math.sin(ang + 0.4) * s * 2.4);
        ctx.stroke();
      }
    });
    BOXES.forEach((b) => {
      const k = ramp(u, b.at, b.at + 0.05);
      if (k <= 0) return;
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#16181c';
      ctx.lineWidth = s * 0.55;
      roundRect(ctx, w * b.x - bw / 2, h * b.y - bh / 2, bw, bh, s * 1.5);
      ctx.stroke();
      text(ctx, b.label, w * b.x, h * b.y + s * 1.6, { family: 'serif', italic: true, size: s * 4.4, color: '#16181c', align: 'center' });
      ctx.globalAlpha = 1;
    });
    // The syllabus, as sticky notes.
    (fact(info, 'Covers', 'OS · DBMS · Networks · System Design').split('·').map((x) => x.trim())).forEach((topic, i) => {
      const k = ramp(u, 0.58 + i * 0.05, 0.64 + i * 0.05);
      if (k <= 0) return;
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate(w * (0.88 + (i % 2) * 0.05), h * (0.34 + i * 0.13));
      ctx.rotate(((i % 3) - 1) * 0.05);
      ctx.fillStyle = ['#f3d86b', '#9ed5b0', '#f2a6a0', '#a9c8f0'][i % 4];
      ctx.fillRect(-w * 0.045, -h * 0.05, w * 0.09, h * 0.1);
      text(ctx, topic, 0, s * 1.4, { family: 'sans', weight: 700, size: s * 3.1, color: '#1b1b1d', align: 'center' });
      ctx.restore();
    });
    if (u > 0.86) {
      ctx.save();
      ctx.translate(w * 0.3, h * 0.86);
      ctx.rotate(-0.06);
      ctx.strokeStyle = '#1f6f3f';
      ctx.lineWidth = s * 0.8;
      ctx.globalAlpha = sstep(u, 0.86, 0.92);
      ctx.strokeRect(-w * 0.14, -s * 5, w * 0.28, s * 9);
      text(ctx, 'INTERVIEW-READY', 0, s * 1.8, { family: 'sans', weight: 800, size: s * 5, color: '#1f6f3f', align: 'center', tracking: 0.08 });
      ctx.restore();
    }
    return;
  }
  ctx.fillStyle = '#10151a';
  ctx.fillRect(0, 0, w, h);
  if (wall === 'left') {
    text(ctx, 'PROBLEM SHEETS, BY TOPIC', w * 0.08, h * 0.16, { family: 'mono', size: s * 3.2, color: DIM, tracking: 0.24 });
    const topics = ['Arrays', 'Strings', 'Trees', 'Graphs', 'DP', 'Greedy', 'OS', 'DBMS', 'Networks', 'System design', 'Contests', 'Grand finale'];
    topics.forEach((tp, i) => {
      const c = i % 3;
      const r = Math.floor(i / 3);
      const x = w * (0.08 + c * 0.29);
      const y = h * (0.24 + r * 0.17);
      const done = u > 0.08 + i * 0.065;
      ctx.fillStyle = done ? 'rgba(127,156,134,0.35)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(x, y, w * 0.26, h * 0.13);
      text(ctx, tp, x + w * 0.02, y + h * 0.085, { family: 'sans', weight: 600, size: s * 4.4, color: BONE });
      if (done) text(ctx, '✓', x + w * 0.235, y + h * 0.085, { family: 'sans', weight: 700, size: s * 4.6, color: '#9fd3a8', align: 'right' });
    });
    return;
  }
  text(ctx, 'THEN', w * 0.08, h * 0.2, { family: 'mono', size: s * 3.4, color: DIM, tracking: 0.26 });
  text(ctx, 'the mock interview.', w * 0.08, h * 0.32, { family: 'serif', italic: true, size: s * 8.4, color: BONE });
  const left = Math.max(0, Math.round((1 - ramp(u, 0.1, 0.95)) * 45 * 60));
  text(ctx, `${pad2(Math.floor(left / 60))}:${pad2(left % 60)}`, w * 0.08, h * 0.58, { family: 'mono', weight: 500, size: s * 16, color: '#9fd3a8' });
  text(ctx, 'FOR', w * 0.08, h * 0.74, { family: 'mono', size: s * 3.2, color: DIM, tracking: 0.24 });
  text(ctx, fact(info, 'For'), w * 0.08, h * 0.82, { family: 'sans', weight: 600, size: s * 5.4, color: BONE });
  text(ctx, 'Experienced mentors, throughout.', w * 0.08, h * 0.92, { family: 'serif', italic: true, size: s * 4.6, color: DIM });
};

// ─── Bell Labs: the machine boots ──────────────────────────────────────────

const BOOT = [
  'POST ................................ OK',
  'memory test ................. 16384K OK',
  'boot device: disk 0',
  'loading stage 1 bootloader from sector 0',
  'stage 2: reading kernel image',
  'switching to 32-bit protected mode',
  'enabling paging — 4 KiB pages',
  'memory manager: free lists ready',
  'IDT loaded · interrupts on',
  'scheduler: round robin, 10 ms quantum',
  'mounting root filesystem ........ done',
  'init: starting session',
  '',
  'Welcome to Bell Labs.',
];
export const BOOTED = 0.62;
const AMBER = '#ffb347';

const bellLabs: WallDraw = (ctx, w, h, wall, u, t, info) => {
  ctx.fillStyle = '#050403';
  ctx.fillRect(0, 0, w, h);
  const s = h / 100;
  const on = u > 0.02;
  if (!on) {
    if (wall === 'back' && Math.floor(t * 2) % 2) ctx.fillRect(w * 0.05, h * 0.3, s * 2.4, s * 4);
    return;
  }
  // Scanlines.
  ctx.fillStyle = 'rgba(255,179,71,0.035)';
  for (let y = 0; y < h; y += Math.max(3, s * 0.8)) ctx.fillRect(0, y, w, Math.max(1, s * 0.25));
  if (wall === 'back') {
    const y0 = titleBand(ctx, w, h, info, AMBER, 'rgba(255,179,71,0.6)');
    const shown = Math.floor(ramp(u, 0.04, BOOTED) * BOOT.length);
    BOOT.slice(0, shown).forEach((line, i) => {
      const last = i === BOOT.length - 1;
      text(ctx, line, w * 0.05, y0 + s * (5 + i * 4.6), { family: 'mono', weight: last ? 500 : 400, size: s * (last ? 4.4 : 3.3), color: last ? '#ffe2b0' : AMBER });
    });
    if (u > BOOTED) {
      const prompt = `login: ${typed('visitor', u, BOOTED + 0.05, BOOTED + 0.2)}${Math.floor(t * 2) % 2 ? '_' : ''}`;
      text(ctx, prompt, w * 0.05, y0 + s * (5 + BOOT.length * 4.6 + 2), { family: 'mono', size: s * 3.6, color: '#ffe2b0' });
    }
    return;
  }
  const live = sstep(u, BOOTED - 0.1, BOOTED + 0.05);
  ctx.globalAlpha = 0.25 + 0.75 * live;
  if (wall === 'left') {
    text(ctx, 'THE PIPELINE', w * 0.08, h * 0.16, { family: 'mono', size: s * 3.2, color: AMBER, tracking: 0.26 });
    const stages = ['IF', 'ID', 'EX', 'MEM', 'WB'];
    const cw = (w * 0.84) / stages.length;
    stages.forEach((st, i) => text(ctx, st, w * 0.08 + cw * (i + 0.5), h * 0.28, { family: 'mono', weight: 500, size: s * 4.4, color: '#ffe2b0', align: 'center' }));
    for (let row = 0; row < 6; row++) {
      for (let c = 0; c < stages.length; c++) {
        const tick = Math.floor(t * 1.6);
        if ((tick - row) % 7 !== c && (tick - row + 7) % 7 !== c) continue;
        ctx.fillStyle = `rgba(255,179,71,${0.35 + 0.1 * c})`;
        ctx.fillRect(w * 0.08 + cw * c + cw * 0.08, h * (0.34 + row * 0.09), cw * 0.84, h * 0.07);
        text(ctx, `i${row + tick}`, w * 0.08 + cw * (c + 0.5), h * (0.39 + row * 0.09), { family: 'mono', size: s * 3, color: '#050403', align: 'center' });
      }
    }
    text(ctx, fact(info, 'Topics'), w * 0.08, h * 0.95, { family: 'sans', weight: 600, size: s * 4.4, color: '#ffe2b0' });
  } else {
    text(ctx, 'VIRTUAL → PHYSICAL', w * 0.08, h * 0.16, { family: 'mono', size: s * 3.2, color: AMBER, tracking: 0.26 });
    const page = Math.floor(t * 0.8) % 6;
    for (let i = 0; i < 6; i++) {
      const y = h * (0.28 + i * 0.1);
      ctx.fillStyle = i === page ? 'rgba(255,179,71,0.5)' : 'rgba(255,179,71,0.1)';
      ctx.fillRect(w * 0.08, y, w * 0.3, h * 0.08);
      text(ctx, `page ${i}`, w * 0.1, y + h * 0.055, { family: 'mono', size: s * 3.2, color: '#ffe2b0' });
      const frame = (i * 5 + 3) % 8;
      ctx.fillStyle = i === page ? 'rgba(255,179,71,0.5)' : 'rgba(255,179,71,0.1)';
      ctx.fillRect(w * 0.6, h * (0.26 + frame * 0.075), w * 0.3, h * 0.06);
      if (i === page) {
        ctx.strokeStyle = '#ffe2b0';
        ctx.lineWidth = s * 0.4;
        ctx.beginPath();
        ctx.moveTo(w * 0.38, y + h * 0.04);
        ctx.lineTo(w * 0.6, h * (0.29 + frame * 0.075));
        ctx.stroke();
        text(ctx, `frame ${frame}`, w * 0.62, h * (0.305 + frame * 0.075), { family: 'mono', size: s * 3, color: '#050403' });
      }
    }
    text(ctx, fact(info, 'Deep dives'), w * 0.08, h * 0.95, { family: 'sans', weight: 600, size: s * 4.4, color: '#ffe2b0' });
  }
  ctx.globalAlpha = 1;
};

// ─── Machine Learning 101: learning, visibly ───────────────────────────────

export const epochs = (u: number) => ramp(u, 0.08, 0.9);
const lossAt = (e: number) => 0.08 + 1.1 * Math.exp(-4.2 * e) + 0.03 * Math.sin(e * 40) * (1 - e);

const ml101: WallDraw = (ctx, w, h, wall, u, t, info) => {
  ctx.fillStyle = '#0d0b17';
  ctx.fillRect(0, 0, w, h);
  const s = h / 100;
  const e = epochs(u);
  const accent = '#a79ff0';
  if (wall === 'back') {
    const y0 = titleBand(ctx, w, h, info);
    const layers = [4, 6, 6, 3];
    const pos = layers.map((n, li) => Array.from({ length: n }, (_, i) => [w * (0.12 + li * 0.25), y0 + (h - y0) * (0.12 + ((i + 0.5) / n) * 0.7)] as const));
    for (let l = 0; l < pos.length - 1; l++)
      for (const a of pos[l])
        for (const b of pos[l + 1]) {
          ctx.strokeStyle = `rgba(167,159,240,${0.08 + 0.18 * e})`;
          ctx.lineWidth = s * 0.2;
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        }
    // A pulse sweeping forward through the layers.
    const sweep = (t * 0.5) % 1;
    pos.forEach((col, li) =>
      col.forEach(([x, y], i) => {
        const near = Math.max(0, 1 - Math.abs(sweep * 3 - li) * 1.4);
        const act = 0.3 + 0.7 * hash(li * 13 + i + Math.floor(e * 12));
        ctx.fillStyle = `rgba(167,159,240,${0.25 + 0.75 * near * act})`;
        ctx.beginPath();
        ctx.arc(x, y, s * (1.6 + near * 1.2), 0, Math.PI * 2);
        ctx.fill();
      }),
    );
    text(ctx, `epoch ${Math.max(1, Math.ceil(e * 12))} / 12`, w * 0.955, s * 12, { family: 'mono', size: s * 3.6, color: DIM, align: 'right' });
    text(ctx, `loss ${lossAt(e).toFixed(3)}`, w * 0.955, s * 20, { family: 'mono', weight: 500, size: s * 6, color: accent, align: 'right' });
    return;
  }
  if (wall === 'left') {
    text(ctx, 'TRAINING LOSS', w * 0.08, h * 0.16, { family: 'mono', size: s * 3.2, color: DIM, tracking: 0.26 });
    const x0 = w * 0.08;
    const x1 = w * 0.92;
    const yTop = h * 0.24;
    const yBot = h * 0.86;
    ctx.strokeStyle = 'rgba(239,233,223,0.25)';
    ctx.lineWidth = s * 0.3;
    ctx.beginPath();
    ctx.moveTo(x0, yTop);
    ctx.lineTo(x0, yBot);
    ctx.lineTo(x1, yBot);
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineWidth = s * 0.7;
    ctx.beginPath();
    const n = Math.max(2, Math.floor(e * 120));
    for (let i = 0; i < n; i++) {
      const ee = (i / 120) * 1;
      const x = x0 + (x1 - x0) * ee;
      const y = yBot - (yBot - yTop) * Math.min(1, lossAt(ee) / 1.2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    text(ctx, 'epochs →', x1, yBot + s * 5, { family: 'mono', size: s * 3, color: DIM, align: 'right' });
    return;
  }
  // Right: a decision boundary finding its place between two classes.
  text(ctx, fact(info, 'Covers', 'Machine learning · deep learning').toUpperCase(), w * 0.08, h * 0.16, { family: 'mono', size: s * 3.2, color: DIM, tracking: 0.2 });
  const cx = w * 0.5;
  const cy = h * 0.56;
  for (let i = 0; i < 60; i++) {
    const cls = i % 2;
    const px = cx + (hash(i * 7) - 0.5) * w * 0.7 + (cls ? w * 0.12 : -w * 0.12);
    const py = cy + (hash(i * 11) - 0.5) * h * 0.55 + (cls ? -h * 0.06 : h * 0.06);
    ctx.fillStyle = cls ? '#a79ff0' : '#e8c07a';
    ctx.beginPath();
    ctx.arc(px, py, s * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  const ang = (1 - e) * 1.2 - 0.35;
  ctx.strokeStyle = BONE;
  ctx.lineWidth = s * 0.5;
  ctx.setLineDash([s * 2, s * 1.4]);
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(ang) * w * 0.45, cy - Math.sin(ang) * w * 0.45);
  ctx.lineTo(cx + Math.cos(ang) * w * 0.45, cy + Math.sin(ang) * w * 0.45);
  ctx.stroke();
  ctx.setLineDash([]);
};

// ─── Schr0ding3r5: capture the flag ────────────────────────────────────────

const FLAG = 'flag{c0mp3t1t1v3_s3cur1ty}';
export const OPEN_AT = 0.74;
const TEAL = '#6fd6c8';

const schrodingers: WallDraw = (ctx, w, h, wall, u, t, info) => {
  ctx.fillStyle = '#040807';
  ctx.fillRect(0, 0, w, h);
  const s = h / 100;
  if (wall === 'back') {
    const y0 = titleBand(ctx, w, h, info, TEAL, 'rgba(111,214,200,0.6)');
    const solved = Math.floor(ramp(u, 0.08, OPEN_AT) * FLAG.length);
    const glyphs = '0123456789abcdef{}_#$%&';
    let shown = '';
    for (let i = 0; i < FLAG.length; i++) shown += i < solved ? FLAG[i] : glyphs[Math.floor(hash(i * 31 + Math.floor(t * 18)) * glyphs.length)];
    const size = fitSize(ctx, FLAG, w * 0.86, { family: 'mono', weight: 500, size: s * 9 }, s * 9);
    text(ctx, shown, w * 0.05, y0 + s * 22, { family: 'mono', weight: 500, size, color: u >= OPEN_AT ? '#b8fff4' : TEAL });
    text(ctx, u < OPEN_AT ? 'The box is locked and unlocked — until someone looks.' : 'OBSERVED: UNLOCKED.', w * 0.05, y0 + s * 40, {
      family: u < OPEN_AT ? 'serif' : 'mono',
      italic: u < OPEN_AT,
      weight: u < OPEN_AT ? 400 : 500,
      size: s * (u < OPEN_AT ? 5.6 : 5),
      color: u < OPEN_AT ? 'rgba(111,214,200,0.75)' : '#b8fff4',
      tracking: u < OPEN_AT ? 0 : 0.2,
    });
    text(ctx, fact(info, 'Focus').toUpperCase(), w * 0.05, h * 0.94, { family: 'mono', size: s * 3, color: 'rgba(111,214,200,0.55)', tracking: 0.24 });
    return;
  }
  // Hex dump (left) and a disassembly (right), streaming.
  const rows = 18;
  const off = Math.floor(t * 6);
  for (let r = 0; r < rows; r++) {
    const y = h * (0.1 + r * 0.047);
    if (wall === 'left') {
      text(ctx, (0x4000 + (r + off) * 16).toString(16).padStart(8, '0'), w * 0.06, y, { family: 'mono', size: s * 2.6, color: 'rgba(111,214,200,0.5)' });
      let line = '';
      for (let b = 0; b < 8; b++) line += Math.floor(hash((r + off) * 16 + b) * 256).toString(16).padStart(2, '0') + ' ';
      text(ctx, line, w * 0.32, y, { family: 'mono', size: s * 2.6, color: (r + off) % 9 === 0 ? '#b8fff4' : TEAL });
    } else {
      const ops = ['mov', 'xor', 'cmp', 'jne', 'call', 'push', 'pop', 'lea', 'ret'];
      const k = r + off;
      text(ctx, `0x${(0x1130 + k * 4).toString(16)}`, w * 0.06, y, { family: 'mono', size: s * 2.6, color: 'rgba(111,214,200,0.5)' });
      text(ctx, `${ops[k % ops.length]}  ${['eax', 'rbx', 'rcx', 'rdi'][k % 4]}, ${k % 3 ? `0x${(k * 37 % 255).toString(16)}` : 'rsi'}`, w * 0.34, y, {
        family: 'mono',
        size: s * 2.6,
        color: r === rows - 3 ? '#b8fff4' : TEAL,
      });
    }
  }
};

// ─── MasterClass: the lecture ──────────────────────────────────────────────

const masterclass: WallDraw = (ctx, w, h, wall, u, t, info) => {
  const s = h / 100;
  if (wall === 'back') {
    ctx.fillStyle = '#17120c';
    ctx.fillRect(0, 0, w, h);
    titleBand(ctx, w, h, info);
    // The screen.
    const sx = w * 0.2;
    const sy = h * 0.32;
    const sw = w * 0.6;
    const sh = h * 0.56;
    ctx.fillStyle = '#f4efe6';
    ctx.fillRect(sx, sy, sw, sh);
    const slides = [
      { k: 'MASTERCLASS', t: 'The master’s journey,\nfrom those on it.' },
      { k: 'FIELDS', t: fact(info, 'Fields', 'Computer Science · AI · ECE · MBA') },
      { k: 'PREPARING', t: fact(info, 'Resources', 'GRE preparation material') + '\n& articles' },
      { k: 'YOUR TURN', t: 'Questions?' },
    ];
    const i = Math.min(slides.length - 1, Math.floor(ramp(u, 0.02, 0.98) * slides.length));
    const sl = slides[i];
    text(ctx, sl.k, sx + sw * 0.06, sy + sh * 0.18, { family: 'mono', size: s * 3, color: '#8a6d45', tracking: 0.26 });
    sl.t.split('\n').forEach((line, n) =>
      text(ctx, line, sx + sw * 0.06, sy + sh * (0.45 + n * 0.2), { family: 'serif', italic: n > 0, size: fitSize(ctx, line, sw * 0.88, { family: 'serif', size: s * 8 }, s * 8), color: '#1b1814' }),
    );
    text(ctx, `${i + 1} / ${slides.length}`, sx + sw * 0.94, sy + sh * 0.9, { family: 'mono', size: s * 2.6, color: '#8a6d45', align: 'right' });
    return;
  }
  // Slatted wood acoustic panels, with a line of type.
  ctx.fillStyle = '#2a1f14';
  ctx.fillRect(0, 0, w, h);
  const slat = w / 40;
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = i % 2 ? '#3a2b1b' : '#33261a';
    ctx.fillRect(i * slat, 0, slat * 0.8, h);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, h * 0.62, w, h * 0.16);
  text(ctx, wall === 'left' ? 'ALUMNI ON THE MASTER’S JOURNEY' : 'GRE PREP · ARTICLES · Q&A', w * 0.06, h * 0.72, { family: 'mono', size: s * 3.8, color: '#e7cfa6', tracking: 0.24 });
};

// ─── OffCamp: the opportunity wall ─────────────────────────────────────────

const OPPS = ['SCHOLARSHIP', 'INTERNSHIP', 'JOB', 'INTERNSHIP', 'SCHOLARSHIP', 'JOB', 'INTERNSHIP', 'SCHOLARSHIP', 'JOB', 'INTERNSHIP', 'JOB', 'SCHOLARSHIP'];
const OPP_COLOR: Record<string, string> = { SCHOLARSHIP: '#e8c07a', INTERNSHIP: '#cf7a58', JOB: '#9fd3a8' };

const offcamp: WallDraw = (ctx, w, h, wall, u, t, info) => {
  const s = h / 100;
  if (wall === 'back') {
    ctx.fillStyle = '#8f6c46';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(40,25,10,${0.08 + hash(i) * 0.12})`;
      ctx.fillRect(hash(i * 3) * w, hash(i * 5) * h, 2, 2);
    }
    ctx.fillStyle = 'rgba(12,10,8,0.82)';
    ctx.fillRect(0, 0, w, h * 0.26);
    titleBand(ctx, w, h, info);
    OPPS.forEach((kind, i) => {
      const k = sstep(u, 0.04 + i * 0.06, 0.1 + i * 0.06);
      if (k <= 0) return;
      const c = i % 6;
      const r = Math.floor(i / 6);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate(w * (0.1 + c * 0.155), h * (0.44 + r * 0.3) - (1 - k) * h * 0.05);
      ctx.rotate(((i * 7) % 5 - 2) * 0.025);
      ctx.fillStyle = '#f7f2e8';
      ctx.fillRect(-w * 0.065, -h * 0.12, w * 0.13, h * 0.24);
      ctx.fillStyle = OPP_COLOR[kind];
      ctx.fillRect(-w * 0.065, -h * 0.12, w * 0.13, h * 0.05);
      text(ctx, kind, -w * 0.055, -h * 0.083, { family: 'mono', weight: 500, size: s * 2.4, color: '#1b1b1d', tracking: 0.12 });
      ctx.fillStyle = 'rgba(27,27,29,0.3)';
      for (let l = 0; l < 4; l++) ctx.fillRect(-w * 0.055, -h * 0.03 + l * h * 0.035, w * (0.1 - (l % 3) * 0.02), h * 0.012);
      ctx.fillStyle = '#b5452f';
      ctx.beginPath();
      ctx.arc(0, -h * 0.11, s * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    return;
  }
  ctx.fillStyle = '#141110';
  ctx.fillRect(0, 0, w, h);
  if (wall === 'left') {
    text(ctx, 'WE SHARE', w * 0.08, h * 0.2, { family: 'mono', size: s * 3.4, color: DIM, tracking: 0.26 });
    ['Scholarships', 'Internships', 'Jobs', '& more'].forEach((x, i) =>
      text(ctx, x, w * 0.08, h * (0.36 + i * 0.13), { family: 'serif', italic: i === 3, size: s * 9, color: i === 3 ? DIM : Object.values(OPP_COLOR)[i] ?? BONE }),
    );
    return;
  }
  text(ctx, 'WHERE', w * 0.08, h * 0.2, { family: 'mono', size: s * 3.4, color: DIM, tracking: 0.26 });
  text(ctx, fact(info, 'Where', 'Instagram and LinkedIn'), w * 0.08, h * 0.34, { family: 'serif', size: s * 8, color: BONE });
  // A feed of posts sliding up.
  for (let i = 0; i < 4; i++) {
    const y = h * (0.46 + i * 0.13) - ((t * 0.05) % 0.13) * h;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(w * 0.08, y, w * 0.84, h * 0.1);
    ctx.fillStyle = OPP_COLOR[OPPS[i]];
    ctx.fillRect(w * 0.08, y, s * 0.8, h * 0.1);
    text(ctx, `OffCamp · ${OPPS[(i + Math.floor(t * 0.4)) % OPPS.length].toLowerCase()}`, w * 0.11, y + h * 0.062, { family: 'sans', weight: 600, size: s * 3.6, color: BONE });
  }
};

// ─── Prodigy: the puzzle comes together ────────────────────────────────────

const prodigy: WallDraw = (ctx, w, h, wall, u, t, info) => {
  const s = h / 100;
  if (wall === 'back') {
    ctx.fillStyle = '#1a0f0c';
    ctx.fillRect(0, 0, w, h);
    const y0 = titleBand(ctx, w, h, info);
    // Where the pieces go: dashed outlines until they arrive.
    ctx.strokeStyle = 'rgba(239,233,223,0.18)';
    ctx.setLineDash([s * 1.2, s * 1.2]);
    ctx.lineWidth = s * 0.3;
    ctx.strokeRect(w * 0.23, y0 + s * 4, w * 0.54, h - y0 - s * 16);
    ctx.setLineDash([]);
    const done = u > 0.9;
    text(ctx, done ? `${fact(info, 'Legacy', 'More than 15 years').toUpperCase()}  ·  ${fact(info, 'For').toUpperCase()}` : `${fact(info, 'Scale').toUpperCase()}`, w / 2, h * 0.95, {
      family: 'mono',
      size: s * 3,
      color: done ? '#f2b09a' : DIM,
      align: 'center',
      tracking: 0.24,
    });
    return;
  }
  // Chalkboards with the day's events in chalk.
  ctx.fillStyle = '#1d3028';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let i = 0; i < 300; i++) ctx.fillRect(hash(i) * w, hash(i * 7) * h, hash(i * 3) * w * 0.05, 1);
  const half = wall === 'left' ? PRODIGY_PROGRAMME.slice(0, 4) : PRODIGY_PROGRAMME.slice(4, 8);
  text(ctx, wall === 'left' ? 'ON THE DAY' : 'AND ALSO', w * 0.08, h * 0.16, { family: 'mono', size: s * 3.2, color: 'rgba(240,240,230,0.55)', tracking: 0.26 });
  half.forEach((p, i) => {
    const k = ramp(u, 0.05 + i * 0.1, 0.15 + i * 0.1);
    text(ctx, typed(p.title, k, 0, 1), w * 0.08, h * (0.32 + i * 0.17), { family: 'serif', italic: true, size: s * 7.4, color: 'rgba(245,245,236,0.92)' });
  });
};

// ─── CodHer: the commit wall ───────────────────────────────────────────────

const codher: WallDraw = (ctx, w, h, wall, u, t, info) => {
  const s = h / 100;
  ctx.fillStyle = '#0c0a07';
  ctx.fillRect(0, 0, w, h);
  const gold = '#d4a24c';
  if (wall === 'back') {
    const y0 = titleBand(ctx, w, h, info);
    const cols = 40;
    const rows = 7;
    const gx = w * 0.05;
    const cell = (w * 0.9) / cols;
    const gy = y0 + s * 8;
    let commits = 0;
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++) {
        const at = hash(c * 7 + r * 131) * 0.8 + (c / cols) * 0.15;
        const lvl = u > at ? 1 + Math.floor(hash(c * 3 + r) * 3.99) : 0;
        commits += lvl;
        ctx.fillStyle = lvl ? `rgba(212,162,76,${0.2 + lvl * 0.2})` : 'rgba(255,255,255,0.05)';
        roundRect(ctx, gx + c * cell + cell * 0.1, gy + r * cell + cell * 0.1, cell * 0.8, cell * 0.8, cell * 0.12);
        ctx.fill();
      }
    text(ctx, `${commits} commits tonight`, gx, gy + rows * cell + s * 7, { family: 'mono', size: s * 3.6, color: DIM });
    if (u > 0.86) {
      const k = sstep(u, 0.86, 0.93);
      ctx.globalAlpha = k;
      text(ctx, 'Ship it.', w * 0.95, gy + rows * cell + s * 10, { family: 'serif', italic: true, size: s * 12, color: gold, align: 'right' });
      ctx.globalAlpha = 1;
    }
    return;
  }
  if (wall === 'left') {
    text(ctx, 'WITH SPONSORS LIKE', w * 0.08, h * 0.24, { family: 'mono', size: s * 3.4, color: DIM, tracking: 0.26 });
    fact(info, 'Sponsors', 'Motorq · GitHub')
      .split('·')
      .map((x) => x.trim())
      .forEach((sp, i) => text(ctx, sp.toUpperCase(), w * 0.08, h * (0.46 + i * 0.2), { family: 'sans', weight: 800, size: s * 14, color: BONE, stretch: 'expanded' }));
    return;
  }
  text(ctx, fact(info, 'Format', 'Women-only hackathon').toUpperCase(), w * 0.08, h * 0.2, { family: 'mono', size: s * 3.4, color: DIM, tracking: 0.26 });
  paragraph(ctx, fact(info, 'Prizes'), w * 0.08, h * 0.36, w * 0.84, s * 10, { family: 'serif', size: s * 8.4, color: gold }, 3);
  const left = Math.max(0, Math.round((1 - ramp(u, 0.02, 0.86)) * 30 * 60));
  text(ctx, 'SUBMISSIONS CLOSE IN', w * 0.08, h * 0.72, { family: 'mono', size: s * 3.2, color: DIM, tracking: 0.26 });
  text(ctx, left > 0 ? `00:${pad2(Math.floor(left / 60))}:${pad2(left % 60)}` : 'CLOSED', w * 0.08, h * 0.86, { family: 'mono', weight: 500, size: s * 11, color: left > 0 ? BONE : gold });
};

export const WALLS = { headFirst, codex, code, bellLabs, ml101, schrodingers, masterclass, offcamp, prodigy, codher };
export { clamp01 };
