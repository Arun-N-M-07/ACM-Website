/**
 * Screen artwork for the team sets, drawn with Canvas 2D. Each takes a time
 * value so it can animate (code scrolling, a video playing, builds running).
 */
import { EVENTS } from '@/content/events';
import { SET_COPY } from '@/content/meetings';
import { PALETTE } from '@/config/palette';
import { paragraph, text } from '@/systems/textures/typeset';

const SYN = ['#7fb0ff', '#e8c07a', '#9fd3a8', '#d6d3cc', '#c49bdd', '#f08d7e'];

const CODE = [
  'int lo = 0, hi = 1e9;',
  'while (lo < hi) {',
  '  int mid = lo + (hi - lo) / 2;',
  '  if (ok(mid)) hi = mid;',
  '  else lo = mid + 1;',
  '}',
  'return lo;',
  '',
  'bool ok(long long x) {',
  '  long long need = 0;',
  '  for (auto v : a) need += (v + x - 1) / x;',
  '  return need <= k;',
  '}',
];

const WEB_CODE = [
  "export default function Page() {",
  "  const events = useEvents();",
  "  return (",
  "    <main className='journey'>",
  "      <Canvas dpr={[1, 2]}>",
  "        <World events={events} />",
  "      </Canvas>",
  "    </main>",
  "  );",
  "}",
  "",
  "const useEvents = () =>",
  "  useSWR('/api/events', fetcher);",
];

function codeBlock(ctx: CanvasRenderingContext2D, w: number, h: number, lines: string[], t: number, x0: number, y0: number, lh: number, size: number, scroll = true) {
  const offset = scroll ? Math.floor(t * 2.2) % lines.length : 0;
  const visible = Math.floor((h - y0) / lh);
  for (let i = 0; i < visible; i++) {
    const line = lines[(i + offset) % lines.length];
    text(ctx, String(((i + offset) % lines.length) + 1).padStart(2, ' '), x0, y0 + i * lh, { family: 'mono', size, color: 'rgba(239,233,223,0.28)' });
    let x = x0 + size * 2.4;
    for (const [k, tok] of line.split(/(\s+)/).entries()) {
      if (!tok.trim()) {
        x += size * 0.6 * tok.length;
        continue;
      }
      text(ctx, tok, x, y0 + i * lh, { family: 'mono', size, color: SYN[(k + i) % SYN.length] });
      ctx.font = `${size}px monospace`;
      x += ctx.measureText(tok).width + size * 0.05;
    }
  }
  // Cursor.
  if (Math.floor(t * 2) % 2 === 0) {
    ctx.fillStyle = '#efe9df';
    ctx.fillRect(x0 + size * 2.4, y0 + (visible - 1) * lh - size * 0.8, size * 0.55, size);
  }
}

export function drawCode(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, web = false) {
  ctx.fillStyle = '#0d1016';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#161b24';
  ctx.fillRect(0, 0, w, h * 0.1);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(h * 0.05 + i * h * 0.06, h * 0.05, h * 0.018, 0, Math.PI * 2);
    ctx.fill();
  });
  text(ctx, web ? 'app/page.tsx' : 'solution.cpp', w * 0.5, h * 0.066, { family: 'mono', size: h * 0.045, color: 'rgba(239,233,223,0.6)', align: 'center' });
  codeBlock(ctx, w, h, web ? WEB_CODE : CODE, t, w * 0.04, h * 0.2, h * 0.075, h * 0.05);
}

export function drawTerminal(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, kind: 'build' | 'push') {
  ctx.fillStyle = '#07090c';
  ctx.fillRect(0, 0, w, h);
  const lines =
    kind === 'build'
      ? ['$ npm run build', '  ▲ Next.js', '  Creating an optimized production build …', '  ✓ Compiled successfully', '  ✓ Linting and checking validity of types', '  ✓ Generating static pages (19/19)', '  ○ /            176 kB', '  ● /events/[slug]', '  Done in 21.4s']
      : ['$ git add -A', '$ git commit -m "events: codher room"', '[main 4f2c9e1] events: codher room', '$ git push origin main', 'Enumerating objects: 23, done.', 'Writing objects: 100% (12/12)', 'To github.com:acm-ceg/site.git', '   a91d3b2..4f2c9e1  main -> main'];
  const shown = Math.min(lines.length, 1 + Math.floor((t * 1.6) % (lines.length + 4)));
  lines.slice(0, shown).forEach((l, i) =>
    text(ctx, l, w * 0.05, h * (0.14 + i * 0.095), { family: 'mono', size: h * 0.058, color: l.includes('✓') ? '#7fd39a' : l.startsWith('$') ? '#efe9df' : 'rgba(239,233,223,0.62)' }),
  );
}

export function drawGitGraph(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = '#0b0d12';
  ctx.fillRect(0, 0, w, h);
  text(ctx, 'main', w * 0.06, h * 0.12, { family: 'mono', size: h * 0.06, color: '#7fb0ff' });
  const n = 9;
  const shift = (t * 0.6) % 1;
  for (let i = 0; i < n; i++) {
    const y = h * (0.2 + (i + shift) * 0.085);
    const branch = i % 3 === 1;
    ctx.fillStyle = branch ? '#c49bdd' : '#7fb0ff';
    ctx.beginPath();
    ctx.arc(w * (branch ? 0.2 : 0.1), y, h * 0.022, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, ['fix: mobile rail', 'feat: team tour', 'chore: deps', 'feat: prodigy wall', 'perf: instancing', 'fix: loader', 'feat: studio flash', 'docs: assets', 'feat: core'][i], w * 0.28, y + h * 0.02, {
      family: 'mono',
      size: h * 0.05,
      color: 'rgba(239,233,223,0.7)',
    });
  }
  ctx.strokeStyle = '#7fb0ff';
  ctx.lineWidth = h * 0.008;
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h * 0.18);
  ctx.lineTo(w * 0.1, h * 0.98);
  ctx.stroke();
}

export function drawPhoneApp(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = '#0a0a0b';
  ctx.fillRect(0, 0, w, h);
  // Phone body, centred.
  const pw = h * 0.46;
  const ph = h * 0.9;
  const px = (w - pw) / 2;
  const py = h * 0.05;
  ctx.fillStyle = '#1c1c1f';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, pw * 0.12);
  ctx.fill();
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath();
  ctx.roundRect(px + pw * 0.05, py + ph * 0.03, pw * 0.9, ph * 0.94, pw * 0.09);
  ctx.fill();
  text(ctx, 'ACM · CEG', px + pw * 0.12, py + ph * 0.12, { family: 'mono', size: pw * 0.07, color: '#141416', tracking: 0.2 });
  const scroll = (t * 0.25) % 1;
  EVENTS.slice(0, 6).forEach((e, i) => {
    const y = py + ph * (0.18 + i * 0.13 - scroll * 0.13);
    if (y < py + ph * 0.15 || y > py + ph * 0.9) return;
    ctx.fillStyle = e.accent;
    ctx.fillRect(px + pw * 0.12, y, pw * 0.76, ph * 0.1);
    text(ctx, e.title, px + pw * 0.16, y + ph * 0.065, { family: 'sans', weight: 700, size: pw * 0.075, color: '#ffffff' });
  });
}

export function drawBrowser(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#0b0b0c';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1d1d20';
  ctx.fillRect(0, 0, w, h * 0.1);
  ctx.fillStyle = '#2a2a2e';
  ctx.fillRect(w * 0.2, h * 0.025, w * 0.6, h * 0.05);
  text(ctx, 'auceg.acm.org', w * 0.5, h * 0.063, { family: 'mono', size: h * 0.036, color: 'rgba(239,233,223,0.7)', align: 'center' });
  text(ctx, 'ACM', w * 0.08, h * 0.45, { family: 'serif', size: h * 0.28, color: PALETTE.bone });
  text(ctx, 'CEG', w * 0.2, h * 0.72, { family: 'serif', size: h * 0.28, color: PALETTE.bone });
  ctx.fillStyle = PALETTE.cegRed;
  ctx.fillRect(w * 0.62, h * 0.25, w * 0.3, h * 0.55);
}

export function drawLighthouse(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = '#0b0d10';
  ctx.fillRect(0, 0, w, h);
  const labels = ['Performance', 'Accessibility', 'Best Practices', 'SEO'];
  labels.forEach((l, i) => {
    const cx = w * (0.14 + i * 0.24);
    const cy = h * 0.48;
    const r = h * 0.2;
    const v = Math.min(1, (t * 0.6 + i * 0.2) % 1.6);
    ctx.lineWidth = h * 0.04;
    ctx.strokeStyle = 'rgba(12,206,107,0.2)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#0cce6b';
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v);
    ctx.stroke();
    text(ctx, String(Math.round(v * 100)), cx, cy + h * 0.06, { family: 'sans', weight: 700, size: h * 0.15, color: '#0cce6b', align: 'center' });
    text(ctx, l, cx, h * 0.86, { family: 'sans', size: h * 0.06, color: 'rgba(239,233,223,0.7)', align: 'center' });
  });
}

export function drawDeploy(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = '#08090b';
  ctx.fillRect(0, 0, w, h);
  const steps = ['Build', 'Test', 'Deploy', 'Live'];
  const k = Math.floor((t * 0.8) % (steps.length + 2));
  steps.forEach((s, i) => {
    const x = w * (0.1 + i * 0.22);
    const done = i < k;
    ctx.fillStyle = done ? '#0cce6b' : 'rgba(239,233,223,0.15)';
    ctx.beginPath();
    ctx.arc(x, h * 0.45, h * 0.08, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, done ? '✓' : String(i + 1), x, h * 0.48, { family: 'sans', weight: 700, size: h * 0.09, color: done ? '#07120b' : 'rgba(239,233,223,0.6)', align: 'center' });
    text(ctx, s.toUpperCase(), x, h * 0.72, { family: 'mono', size: h * 0.055, color: 'rgba(239,233,223,0.7)', align: 'center', tracking: 0.14 });
  });
  text(ctx, k >= steps.length ? '● LIVE' : 'DEPLOYING…', w * 0.06, h * 0.16, { family: 'mono', size: h * 0.065, color: k >= steps.length ? '#0cce6b' : '#e8c07a', tracking: 0.16 });
}

/** A lecture on a video player — progress runs with `t`, playback at 2×. */
export function drawVideo(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = '#0f0f10';
  ctx.fillRect(0, 0, w, h);
  const vh = h * 0.78;
  // The lecture frame: a dark IDE with the snippet being explained, and a hand-drawn diagram.
  ctx.fillStyle = '#1b1d22';
  ctx.fillRect(0, 0, w, vh);
  codeBlock(ctx, w * 0.55, vh, CODE, t * 0.6, w * 0.03, vh * 0.14, vh * 0.085, vh * 0.055, false);
  ctx.strokeStyle = '#ffd24a';
  ctx.lineWidth = h * 0.006;
  const lo = w * 0.62;
  const hi = w * 0.95;
  const mid = lo + (hi - lo) * (0.5 + 0.25 * Math.sin(t * 1.3));
  ctx.beginPath();
  ctx.moveTo(lo, vh * 0.5);
  ctx.lineTo(hi, vh * 0.5);
  ctx.stroke();
  for (const [x, l] of [
    [lo, 'lo'],
    [mid, 'mid'],
    [hi, 'hi'],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x, vh * 0.44);
    ctx.lineTo(x, vh * 0.56);
    ctx.stroke();
    text(ctx, l, x, vh * 0.66, { family: 'mono', size: vh * 0.07, color: '#ffd24a', align: 'center' });
  }
  // Player chrome.
  const prog = (t * 0.02) % 1;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(w * 0.03, vh - h * 0.03, w * 0.94, h * 0.008);
  ctx.fillStyle = '#ff0033';
  ctx.fillRect(w * 0.03, vh - h * 0.03, w * 0.94 * prog, h * 0.008);
  ctx.beginPath();
  ctx.arc(w * 0.03 + w * 0.94 * prog, vh - h * 0.026, h * 0.014, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(w * 0.86, vh * 0.05, w * 0.1, vh * 0.1);
  text(ctx, '2×', w * 0.91, vh * 0.125, { family: 'sans', weight: 700, size: vh * 0.07, color: '#ffffff', align: 'center' });
  // Title bar under the video.
  text(ctx, SET_COPY.cpVideo.title, w * 0.03, vh + h * 0.09, { family: 'sans', weight: 600, size: h * 0.055, color: '#f1f1f1' });
  ctx.fillStyle = '#ff0033';
  ctx.beginPath();
  ctx.arc(w * 0.045, vh + h * 0.165, h * 0.022, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, SET_COPY.cpVideo.channel, w * 0.075, vh + h * 0.18, { family: 'sans', size: h * 0.045, color: 'rgba(241,241,241,0.7)' });
}

export function drawStandings(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = '#0c0e13';
  ctx.fillRect(0, 0, w, h);
  text(ctx, 'CODEX · ROUND 7', w * 0.05, h * 0.12, { family: 'mono', size: h * 0.06, color: PALETTE.acm, tracking: 0.16 });
  const cols = ['A', 'B', 'C', 'D', 'E', 'F'];
  cols.forEach((c, i) => text(ctx, c, w * (0.42 + i * 0.09), h * 0.24, { family: 'mono', size: h * 0.05, color: 'rgba(239,233,223,0.6)', align: 'center' }));
  for (let r = 0; r < 6; r++) {
    const y = h * (0.34 + r * 0.11);
    text(ctx, `#${r + 1}`, w * 0.05, y, { family: 'mono', size: h * 0.05, color: 'rgba(239,233,223,0.8)' });
    ctx.fillStyle = 'rgba(239,233,223,0.12)';
    ctx.fillRect(w * 0.14, y - h * 0.04, w * 0.2, h * 0.05);
    cols.forEach((_, i) => {
      const solved = (r * 7 + i * 3 + Math.floor(t * 0.5)) % 5 < 3 - r * 0.3;
      text(ctx, solved ? '+' : '·', w * (0.42 + i * 0.09), y, { family: 'mono', weight: 700, size: h * 0.06, color: solved ? '#7fd39a' : 'rgba(239,233,223,0.25)', align: 'center' });
    });
  }
}

/** The CP whiteboard: formulas in marker, a boxed topic, a doodled graph. */
export function drawWhiteboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#f5f5f1';
  ctx.fillRect(0, 0, w, h);
  const u = h / 100;
  const ink = ['#1f3f8f', '#141414', '#b02a2a', '#1f6f3f'];
  text(ctx, SET_COPY.cpBoard.heading, w * 0.03, u * 11, { family: 'serif', italic: true, size: u * 8, color: ink[2] });
  ctx.strokeStyle = ink[2];
  ctx.lineWidth = u * 0.5;
  ctx.strokeRect(w * 0.02, u * 3, w * 0.52, u * 11);
  const f = SET_COPY.cpBoard.formulas;
  f.forEach((line, i) => {
    const col = i < 4 ? 0 : 1;
    const row = i < 4 ? i : i - 4;
    text(ctx, line, w * (0.035 + col * 0.36), u * (26 + row * 11.5), { family: 'serif', italic: true, size: u * 5.4, color: ink[(i + 1) % ink.length] });
  });
  // A small graph with Dijkstra distances.
  const gx = w * 0.8;
  const gy = u * 55;
  const nodes: [number, number, string][] = [
    [gx - w * 0.08, gy - u * 22, '0'],
    [gx + w * 0.07, gy - u * 26, '4'],
    [gx - w * 0.1, gy + u * 14, '2'],
    [gx + w * 0.09, gy + u * 10, '5'],
    [gx, gy - u * 2, '3'],
  ];
  const edges = [
    [0, 1],
    [0, 2],
    [2, 4],
    [4, 1],
    [4, 3],
    [1, 3],
  ];
  ctx.strokeStyle = ink[1];
  ctx.lineWidth = u * 0.45;
  for (const [a, b] of edges) {
    ctx.beginPath();
    ctx.moveTo(nodes[a][0], nodes[a][1]);
    ctx.lineTo(nodes[b][0], nodes[b][1]);
    ctx.stroke();
  }
  for (const [x, y, l] of nodes) {
    ctx.fillStyle = '#f5f5f1';
    ctx.beginPath();
    ctx.arc(x, y, u * 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    text(ctx, l, x, y + u * 2, { family: 'serif', italic: true, size: u * 5, color: ink[0], align: 'center' });
  }
  paragraph(ctx, 'O(n log n) — don’t TLE', w * 0.7, u * 92, w * 0.28, u * 5, { family: 'serif', italic: true, size: u * 4.2, color: ink[2] });
}
