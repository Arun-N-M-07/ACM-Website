/** A short critically damped response, stable at 20–144 Hz. The grain field
 * has momentum, but returns to rest in about 0.3 s instead of chasing input. */
export interface PointerField {
  x: number; y: number; active: boolean; vx: number; vy: number;
  fx: number; fy: number; fvx: number; fvy: number; energy: number;
}
export function updatePointerField(p: PointerField, delta: number, reduced: boolean) {
  const dt = Math.min(0.1, Math.max(0, delta));
  const steps = Math.max(1, Math.ceil(dt * 240));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    p.fvx += (((p.active ? p.x : p.fx) - p.fx) * 625 - p.fvx * 50) * h;
    p.fvy += (((p.active ? p.y : p.fy) - p.fy) * 625 - p.fvy * 50) * h;
    p.fx += p.fvx * h;
    p.fy += p.fvy * h;
  }
  const energy = reduced || !p.active ? 0 : Math.min(1, Math.hypot(p.vx, p.vy) * 0.07);
  p.energy += (energy - p.energy) * (1 - Math.exp(-dt * 14));
  if (reduced) { p.fvx = p.fvy = 0; p.fx = p.x; p.fy = p.y; }
}
