'use client';
/**
 * The facility's departures board: every programme in the corridor on a
 * split-flap display, in the order you'll pass them. The flaps clatter into
 * place as you arrive (driven by scroll, so they un-flip if you go back up),
 * and the clock shows the real time.
 *
 * Big, high-contrast type on purpose: it is the one piece of in-world text
 * meant to be read from across the hall.
 */
import { useRef } from 'react';
import { CORRIDOR } from '@/config/world';
import { SEGMENTS } from '@/config/timeline';
import { PALETTE } from '@/config/palette';
import { progress } from '@/systems/scroll/progress';
import { text } from '@/systems/textures/typeset';
import { CanvasPanel } from '../shared/CanvasPanel';

const COLS = [
  { key: 'no', label: 'NO', chars: 2 },
  { key: 'title', label: 'PROGRAMME', chars: 20 },
  { key: 'kind', label: 'TYPE', chars: 13 },
  { key: 'cadence', label: 'RUNS', chars: 16 },
  { key: 'gate', label: 'GATE', chars: 8 },
] as const;
const GAP = 1;
const TOTAL = COLS.reduce((s, c) => s + c.chars, 0) + GAP * (COLS.length - 1);
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·-+/&';

const ROWS = CORRIDOR.rooms.map((r) => {
  const e = r.event;
  const cells: Record<(typeof COLS)[number]['key'], string> = {
    no: String(r.index + 1).padStart(2, '0'),
    title: e.title.toUpperCase(),
    kind: e.kind.toUpperCase(),
    cadence: e.cadence.toUpperCase(),
    gate: e.flagship ? 'FLAGSHIP' : `ROOM ${String(r.index + 1).padStart(2, '0')}`,
  };
  return { cells, accent: e.accent, flagship: !!e.flagship };
});

/** 0..1 through the facility segment. */
const facilityU = () => {
  const s = SEGMENTS.facility;
  return (progress.value - s.start) / (s.end - s.start);
};

/** When (facility-local 0..1) a character settles: row by row, left to right. */
const settleAt = (row: number, col: number) => 0.1 + row * 0.017 + col * 0.0019;

function drawBoard(ctx: CanvasRenderingContext2D, w: number, h: number, u: number, t: number) {
  ctx.fillStyle = '#0a0a0b';
  ctx.fillRect(0, 0, w, h);
  const m = w * 0.022;
  const headerH = h * 0.2;

  // Header: DEPARTURES, what it is, and the time.
  text(ctx, 'DEPARTURES', m, headerH * 0.62, { family: 'sans', weight: 800, size: headerH * 0.52, color: PALETTE.bone, stretch: 'expanded', tracking: 0.06 });
  text(ctx, `THE EVENTS CORRIDOR  ·  ${CORRIDOR.rooms.length} ROOMS`, m, headerH * 0.9, { family: 'mono', size: headerH * 0.13, color: 'rgba(239,233,223,0.6)', tracking: 0.3 });
  // Chennai time, whatever the visitor's own time zone.
  const hhmm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date());
  text(ctx, hhmm, w - m, headerH * 0.66, { family: 'mono', weight: 500, size: headerH * 0.44, color: '#ffcf6e', align: 'right' });
  text(ctx, 'LOCAL TIME · CHENNAI', w - m, headerH * 0.9, { family: 'mono', size: headerH * 0.11, color: 'rgba(239,233,223,0.5)', align: 'right', tracking: 0.25 });

  // Column labels.
  const tileW = (w - 2 * m) / TOTAL;
  const rowsTop = headerH + h * 0.06;
  const rowH = (h - rowsTop - m * 0.6) / ROWS.length;
  let cx = m;
  for (const c of COLS) {
    text(ctx, c.label, cx + tileW * 0.1, rowsTop - h * 0.018, { family: 'mono', size: h * 0.03, color: 'rgba(239,233,223,0.5)', tracking: 0.2 });
    cx += (c.chars + GAP) * tileW;
  }

  // The flaps.
  const th = rowH * 0.84;
  const size = th * 0.62;
  ROWS.forEach((row, r) => {
    const y = rowsTop + r * rowH;
    let x = m;
    let col = 0;
    for (const c of COLS) {
      const s = row.cells[c.key];
      for (let i = 0; i < c.chars; i++, col++) {
        const tx = x + i * tileW;
        // Tile with a hinge seam.
        ctx.fillStyle = '#17181b';
        ctx.fillRect(tx + tileW * 0.06, y, tileW * 0.88, th);
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        ctx.fillRect(tx + tileW * 0.06, y, tileW * 0.88, th / 2);
        const target = s[i] ?? ' ';
        const settled = u >= settleAt(r, col);
        let ch = target;
        if (!settled && u > settleAt(r, col) - 0.08) ch = GLYPHS[(Math.floor(t * 24) + r * 7 + col * 13) % GLYPHS.length];
        else if (!settled) ch = ' ';
        if (ch !== ' ') {
          const colour = c.key === 'gate' && row.flagship ? '#ffcf6e' : c.key === 'no' ? row.accent : PALETTE.bone;
          text(ctx, ch, tx + tileW / 2, y + th * 0.72, { family: 'mono', weight: 500, size, color: settled ? colour : 'rgba(239,233,223,0.75)', align: 'center' });
        }
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(tx + tileW * 0.06, y + th / 2 - Math.max(1, th * 0.02), tileW * 0.88, Math.max(1, th * 0.04));
      }
      x += (c.chars + GAP) * tileW;
      col += GAP;
    }
  });
}

export function DeparturesBoard({ position, rotation, width, height }: { position: [number, number, number]; rotation: [number, number, number]; width: number; height: number }) {
  const lastKey = useRef('');
  return (
    <CanvasPanel
      width={width}
      height={height}
      pxPerMeter={160}
      position={position}
      rotation={rotation}
      shading="glow"
      glowStrength={1}
      drawKey="departures"
      draw={(ctx, w, h) => drawBoard(ctx, w, h, 1, 0)}
      animate={(ctx, w, h, t) => {
        const u = facilityU();
        // Redraw while any flap is moving, and once a minute for the clock.
        const flipping = u > -0.05 && u < settleAt(ROWS.length - 1, TOTAL) + 0.02;
        const key = flipping ? `${u.toFixed(3)}-${Math.floor(t * 12)}` : `done-${u > 0}-${new Date().getMinutes()}`;
        if (key === lastKey.current) return false;
        lastKey.current = key;
        drawBoard(ctx, w, h, u, t);
        return true;
      }}
      animateEvery={1 / 15}
    />
  );
}
