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
import { BONE, clamp01, DIM, hash, openSpan, pad2, ramp, roundRect, sstep, titleBand, typed, type WallDraw } from './common';

const fact = (info: { ev: { facts: { label: string; value: string }[] } }, label: string, fallback = '') => info.ev.facts.find((f) => f.label === label)?.value ?? fallback;

// ─── Head Start: sorting, one swap at a time ───────────────────────────────

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

const headStart: WallDraw = (ctx, w, h, wall, u, t, info) => {
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
  // Left board: the technical events; right: the non-technical ones.
  const half = PRODIGY_PROGRAMME.filter((p) => p.track === (wall === 'left' ? 'Technical' : 'Non-Technical'));
  text(ctx, `${wall === 'left' ? 'Technical' : 'Non-Technical'} events`.toUpperCase(), w * 0.08, h * 0.16, { family: 'mono', size: s * 3.2, color: 'rgba(240,240,230,0.55)', tracking: 0.26 });
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

// ─── Tech Talks: the room the voice travels through ────────────────────────
// The walls stay dark and architectural: the line the voice runs along is a
// physical piece of the installation (pieces.tsx). The side walls say, below
// it, who speaks and on what.

const techTalks: WallDraw = (ctx, w, h, wall, _u, _t, info) => {
  ctx.fillStyle = '#0d0a08';
  ctx.fillRect(0, 0, w, h);
  const s = h / 100;
  if (wall === 'back') {
    titleBand(ctx, w, h, info);
    return;
  }
  // Toward the stage end of each side wall (the left wall's canvas runs portal → back, the right's back → portal).
  const x = wall === 'left' ? w * 0.5 : w * 0.08;
  if (wall === 'left') {
    text(ctx, 'CONDUCTED BY', x, h * 0.64, { family: 'mono', size: s * 2.6, color: DIM, tracking: 0.26 });
    fact(info, 'Speakers')
      .split('·')
      .map((v) => v.trim())
      .forEach((name, i) => text(ctx, name[0].toUpperCase() + name.slice(1), x, h * (0.73 + i * 0.085), { family: 'serif', size: s * 5.6, color: BONE }));
    return;
  }
  text(ctx, 'ON', x, h * 0.64, { family: 'mono', size: s * 2.6, color: DIM, tracking: 0.26 });
  paragraph(ctx, fact(info, 'Topics'), x, h * 0.73, w * 0.42, s * 6.6, { family: 'serif', size: s * 5.6, color: BONE }, 3);
};

// ─── PatternX: from scattered to a pattern, and on to CodeX ────────────────
//
// One story across the visit, scrubbed by scroll (pieces.tsx builds it in the
// room): a floor of scattered lit cells; three terms of a sequence on
// plinths; the cells find the grid, then a path; the fourth term is built
// from the third; the path leads out, toward CodeX. The back wall writes the
// sequence out and marks where the reading has got to.

/** The story, as fractions of the visit (u). */
export const PX_U = { read: 0.06, align: 0.08, ask: 0.18, path: 0.2, copy: 0.24, add: 0.33, solved: 0.42, lead: 0.5, codex: 0.68 };
/** The four terms on the plinths: steps of 1, 2, 3 and 4 columns. */
export const STAIRS = [1, 2, 3, 4].map((k) => {
  const out: [number, number][] = [];
  for (let c = 0; c < k; c++) for (let r = 0; r <= c; r++) out.push([c, r]);
  return out;
});
/** The reading of it, stage by stage (the room's own framing, not a syllabus). */
export const PX_STAGES = [
  { word: 'Observe', at: 0 },
  { word: 'Identify', at: PX_U.align },
  { word: 'Understand', at: PX_U.path },
  { word: 'Solve', at: PX_U.solved - 0.04 },
  { word: 'CodeX', at: PX_U.codex },
];

const patternx: WallDraw = (ctx, w, h, wall, u, _t, info) => {
  ctx.fillStyle = '#0c0a12';
  ctx.fillRect(0, 0, w, h);
  const s = h / 100;
  const accent = info.ev.accent;
  if (wall === 'back') {
    titleBand(ctx, w, h, info);
    const [f0, f1] = openSpan(info.index);
    const x0 = f0 * w;
    const span = (f1 - f0) * w;
    // Where the reading has got to.
    const railY = h * 0.43;
    const stage = PX_STAGES.reduce((k, st, i) => (u >= st.at ? i : k), -1);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = BONE;
    ctx.fillRect(x0, railY, span, s * 0.15);
    PX_STAGES.forEach((st, i) => {
      const x = x0 + (span * i) / (PX_STAGES.length - 1);
      const on = i <= stage && u > -0.05;
      ctx.globalAlpha = on ? 1 : 0.35;
      ctx.fillStyle = on ? (i === PX_STAGES.length - 1 ? accent : BONE) : DIM;
      ctx.beginPath();
      ctx.arc(x, railY, s * (i === stage ? 0.8 : 0.5), 0, Math.PI * 2);
      ctx.fill();
      text(ctx, st.word.toUpperCase(), x, railY - s * 2, { family: 'mono', size: s * 2.1, color: i === stage ? '#ffffff' : on ? BONE : DIM, tracking: 0.2, align: i === 0 ? 'left' : i === PX_STAGES.length - 1 ? 'right' : 'center' });
    });
    // The sequence, written out: the fourth term is a question until it's built.
    const solved = sstep(u, PX_U.solved - 0.03, PX_U.solved + 0.02);
    const counts = STAIRS.map((t) => String(t.length));
    const numY = h * 0.57;
    counts.forEach((n, i) => {
      const x = x0 + (span * i) / 3.4;
      const shown = i < 3 ? sstep(u, PX_U.read + i * 0.035, PX_U.read + i * 0.035 + 0.04) : 1;
      ctx.globalAlpha = 0.25 + 0.75 * shown;
      const label = i < 3 ? n : solved > 0.5 ? n : '?';
      text(ctx, label, x, numY, { family: 'serif', size: s * 9, color: i === 3 ? (solved > 0.5 ? accent : '#ffffff') : BONE });
      if (i < 3) {
        ctx.globalAlpha = 0.5 * shown;
        text(ctx, '·', x + span / 3.4 - span * 0.07, numY - s * 2.5, { family: 'serif', size: s * 6, color: DIM });
      }
    });
    const rule = sstep(u, PX_U.solved, PX_U.solved + 0.06);
    if (rule > 0.01) {
      ctx.globalAlpha = rule;
      paragraph(ctx, 'Each term is the last one, with one more column.', x0, h * 0.66, span, s * 5.4, { family: 'serif', italic: true, size: s * 4.4, color: BONE }, 2);
    }
    ctx.globalAlpha = 1;
    return;
  }
  // Side walls: who it's for and what it teaches; and, downstream, where it leads (lit once the path gets there).
  if (wall === 'left') {
    const x = w * 0.5;
    text(ctx, 'FOR', x, h * 0.56, { family: 'mono', size: s * 2.6, color: DIM, tracking: 0.26 });
    text(ctx, fact(info, 'For', 'Beginners'), x, h * 0.64, { family: 'serif', size: s * 6, color: BONE });
    text(ctx, 'FOCUS', x, h * 0.74, { family: 'mono', size: s * 2.6, color: DIM, tracking: 0.26 });
    paragraph(ctx, fact(info, 'Focus'), x, h * 0.82, w * 0.45, s * 6.6, { family: 'serif', size: s * 5.6, color: BONE }, 2);
    return;
  }
  const lit = sstep(u, PX_U.codex - 0.04, PX_U.codex + 0.06);
  const x = w * 0.08;
  text(ctx, 'A PRECURSOR TO', x, h * 0.56, { family: 'mono', size: s * 2.6, color: DIM, tracking: 0.26 });
  ctx.globalAlpha = 0.45 + 0.55 * lit;
  text(ctx, `${fact(info, 'Leads into', 'CodeX')}  →`, x, h * 0.68, { family: 'serif', size: s * 9, color: accent });
  ctx.globalAlpha = 1;
};

// ─── Open Source Mentorship Program: the loom ──────────────────────────────
//
// Scrubbed by scroll (pieces.tsx builds the loom in the room): a frame held up
// by ACM-CEG and GDG-AU; the warp hanging from the mentors' beam; the project
// as a cloth already begun; and the cohort's contributions woven into it, one
// row at a time — until a light passes up through the finished piece. The
// back wall carries only the key to the drawing.

/** The weaving, as fractions of the visit (u): the cohort's rows, one `row` apart from `start`; then the light through the whole. */
export const LOOM_U = { start: -0.12, row: 0.048, rows: 10, sweep: 0.37, whole: 0.45 };
/** When the cohort's last row is beaten in. */
export const LOOM_WOVEN = LOOM_U.start + LOOM_U.rows * LOOM_U.row;

const openSource: WallDraw = (ctx, w, h, wall, u, _t, info) => {
  ctx.fillStyle = '#070d0a';
  ctx.fillRect(0, 0, w, h);
  const s = h / 100;
  const accent = info.ev.accent;
  if (wall === 'back') {
    titleBand(ctx, w, h, info);
    // The key to the loom, low on the wall beside it; and, once the cloth is whole, what it has become.
    const [, f1] = openSpan(info.index);
    const xr = (f1 - 0.07) * w;
    const y = h * 0.8;
    const key: [string, string][] = [
      ['WARP', 'THE MENTORS’ GUIDANCE'],
      ['WEFT', 'THE COHORT’S CONTRIBUTIONS'],
    ];
    key.forEach(([term, meaning], i) => {
      ctx.globalAlpha = 0.8;
      text(ctx, meaning, xr, y + i * s * 4.4, { family: 'mono', size: s * 2.2, color: BONE, tracking: 0.22, align: 'right' });
      const mw = ctx.measureText(meaning).width;
      text(ctx, term, xr - mw - s * 3, y + i * s * 4.4, { family: 'mono', size: s * 2.2, color: accent, tracking: 0.22, align: 'right' });
    });
    const whole = sstep(u, LOOM_U.sweep, LOOM_U.whole);
    if (whole > 0.01) {
      ctx.globalAlpha = whole;
      text(ctx, 'Woven into one project.', xr, y - s * 6, { family: 'serif', italic: true, size: s * 4.4, color: '#ffffff', align: 'right' });
    }
    ctx.globalAlpha = 1;
    return;
  }
  if (wall === 'left') {
    const x = w * 0.5;
    text(ctx, 'A COLLABORATIVE INITIATIVE', x, h * 0.56, { family: 'mono', size: s * 2.6, color: DIM, tracking: 0.26 });
    text(ctx, 'ACM-CEG', x, h * 0.66, { family: 'serif', size: s * 7, color: BONE });
    text(ctx, `× ${fact(info, 'With', 'GDG-AU')}`, x, h * 0.76, { family: 'serif', size: s * 7, color: accent });
    return;
  }
  const x = w * 0.08;
  text(ctx, 'MENTORED BY', x, h * 0.52, { family: 'mono', size: s * 2.6, color: DIM, tracking: 0.26 });
  paragraph(ctx, fact(info, 'Mentors', 'Former GSoC contributors'), x, h * 0.6, w * 0.42, s * 6.6, { family: 'serif', size: s * 5.6, color: BONE }, 2);
  text(ctx, 'SO THAT A COHORT LEARNS', x, h * 0.74, { family: 'mono', size: s * 2.6, color: DIM, tracking: 0.26 });
  paragraph(ctx, fact(info, 'Goal'), x, h * 0.82, w * 0.42, s * 5.6, { family: 'serif', size: s * 4.6, color: BONE }, 3);
};

export const WALLS = { headStart, codex, code, masterclass, prodigy, codher, techTalks, patternx, openSource };
export { clamp01 };
