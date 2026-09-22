/**
 * An event poster, generated from the event record: the photograph when one
 * is installed, otherwise a typographic poster. Used on the team's poster wall.
 */
import type { EventRecord } from '@/content/events';
import { isAvailable } from '@/content/media';
import { PALETTE } from '@/config/palette';
import { drawCover, fitSize, loadImage, text } from '@/systems/textures/typeset';

const BONE = PALETTE.bone;
const DIM = 'rgba(239,233,223,0.56)';

const pad2 = (n: number) => String(n).padStart(2, '0');

export async function drawPoster(ctx: CanvasRenderingContext2D, w: number, h: number, ev: EventRecord, index: number) {
  const u = w / 100;
  ctx.fillStyle = '#0e0e10';
  ctx.fillRect(0, 0, w, h);
  const photoH = h * 0.66;
  let photo = false;
  if (ev.image && isAvailable(ev.image.src)) {
    const img = await loadImage(ev.image.src);
    if (img) {
      ctx.save();
      ctx.filter = 'saturate(0.9) contrast(1.04)';
      drawCover(ctx, img, 0, 0, w, photoH);
      ctx.restore();
      photo = true;
    }
  }
  if (!photo) {
    // Typographic poster: accent field, construction lines, oversized numeral.
    const g = ctx.createLinearGradient(0, 0, 0, photoH);
    g.addColorStop(0, ev.accent);
    g.addColorStop(1, '#141416');
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, photoH);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = Math.max(1, u * 0.2);
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (photoH * i) / 8);
      ctx.lineTo(w, (photoH * i) / 8);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(w * 0.62, photoH * 0.42, w * 0.34, 0, Math.PI * 2);
    ctx.stroke();
    text(ctx, pad2(index + 1), u * 6, photoH - u * 6, { family: 'serif', size: u * 58, color: 'rgba(239,233,223,0.92)', italic: true });
  }
  text(ctx, 'ACM-CEG PRESENTS', u * 6, photoH + u * 9, { family: 'mono', size: u * 3, color: DIM, tracking: 0.24 });
  const titleSize = fitSize(ctx, ev.title, w * 0.88, { family: 'serif', size: u * 18 }, u * 18, u * 8);
  text(ctx, ev.title, u * 5.4, photoH + u * 25, { family: 'serif', size: titleSize, color: BONE });
  text(ctx, `${ev.kind} — ${ev.cadence}`.toUpperCase(), u * 6, photoH + u * 34, { family: 'mono', size: u * 3, color: ev.accent, tracking: 0.2 });
  text(ctx, 'COLLEGE OF ENGINEERING GUINDY · CHENNAI', u * 6, h - u * 6, { family: 'mono', size: u * 2.6, color: DIM, tracking: 0.18 });
}
