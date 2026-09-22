import type { QualityTier } from '@/config/quality';

export interface DeviceProfile {
  tier: QualityTier;
  isTouch: boolean;
  /** Small touch screens get the guided (non-WASD) team tour. */
  guided: boolean;
}

/** Best-effort device classification. `?quality=low|medium|high` overrides. */
export function detectDevice(): DeviceProfile {
  if (typeof window === 'undefined') return { tier: 'medium', isTouch: false, guided: false };
  const isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const memory = nav.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  const shortSide = Math.min(window.screen.width, window.screen.height);
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches;

  let tier: QualityTier = 'high';
  if (isTouch && shortSide < 820) tier = 'low';
  else if (isTouch || memory <= 4 || cores <= 4) tier = 'medium';

  const override = new URLSearchParams(window.location.search).get('quality');
  if (override === 'low' || override === 'medium' || override === 'high') tier = override;

  return { tier, isTouch, guided: isTouch && !hasFinePointer };
}

export function detectWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const ok = !!gl;
    (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
