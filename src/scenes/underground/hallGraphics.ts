/**
 * Canvas artwork for the facility hall: the monument wall and the events-wing
 * sign. Display type only — the reading happens on the plates.
 */
import { CHAPTER } from '@/content/chapter';
import { PALETTE } from '@/config/palette';
import { fitSize, text } from '@/systems/textures/typeset';

const BONE = PALETTE.bone;
const DIM = 'rgba(239,233,223,0.55)';

/**
 * The east wall: a monument, not a document — the founding year at building
 * scale and the two numbers the chapter is proud of. (The words behind them
 * are on the plate that lifts off this wall.)
 */
export function drawMonument(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const u = h / 100;
  ctx.fillStyle = '#0d0e10';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = PALETTE.cegRed;
  ctx.fillRect(0, 0, u * 1.2, h);
  const x = w * 0.05;
  text(ctx, `${CHAPTER.name.toUpperCase()}  ·  ESTABLISHED`, x, u * 12, { family: 'mono', size: u * 3.6, color: DIM, tracking: 0.3 });
  const yearSize = fitSize(ctx, String(CHAPTER.established), w * 0.5, { family: 'serif', size: u * 70 }, u * 70);
  text(ctx, String(CHAPTER.established), x - u, u * 72, { family: 'serif', size: yearSize, color: BONE });
  text(ctx, `${new Date().getFullYear() - CHAPTER.established} years under the red building`, x, u * 88, { family: 'serif', italic: true, size: u * 6, color: 'rgba(239,233,223,0.72)' });

  // Two stats, stacked on the right.
  const rx = w * 0.62;
  ctx.fillStyle = 'rgba(239,233,223,0.14)';
  ctx.fillRect(rx - w * 0.03, u * 10, Math.max(1, u * 0.15), u * 80);
  CHAPTER.legacy.stats.slice(0, 2).forEach((st, i) => {
    const y = u * (40 + i * 40);
    const size = fitSize(ctx, st.value, w * 0.3, { family: 'sans', weight: 700, size: u * 30, stretch: 'expanded' }, u * 30);
    text(ctx, st.value, rx, y, { family: 'sans', weight: 700, size, color: i === 0 ? BONE : 'rgba(239,233,223,0.92)', stretch: 'expanded' });
    text(ctx, st.label.toUpperCase(), rx + u * 0.6, y + u * 8, { family: 'mono', size: u * 3.6, color: 'rgba(143,182,255,0.95)', tracking: 0.28 });
  });
}

export function drawEventsSign(ctx: CanvasRenderingContext2D, w: number, h: number, rooms: number, flagships: number) {
  const size = fitSize(ctx, 'EVENTS', w * 0.9, { family: 'sans', weight: 700, size: h, stretch: 'expanded', tracking: 0.12 }, h * 0.62);
  text(ctx, 'EVENTS', w / 2, h * 0.64, { family: 'sans', weight: 700, size, color: BONE, align: 'center', stretch: 'expanded', tracking: 0.12 });
  text(ctx, `${rooms} PROGRAMMES  ·  ${flagships} FLAGSHIPS  ·  ROOMS 01–${String(rooms).padStart(2, '0')}`, w / 2, h * 0.92, {
    family: 'mono',
    size: h * 0.075,
    color: 'rgba(239,233,223,0.6)',
    align: 'center',
    tracking: 0.3,
  });
}
