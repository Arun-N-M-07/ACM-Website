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
  // …and no higher than the GPU can hold (decided once, here: the tier never changes mid-journey).
  const cap = gpuCap(gpuName());
  if (cap && RANK[cap] < RANK[tier]) tier = cap;

  const override = new URLSearchParams(window.location.search).get('quality');
  if (override === 'low' || override === 'medium' || override === 'high') tier = override;

  return { tier, isTouch, guided: isTouch && !hasFinePointer };
}

const RANK: Record<QualityTier, number> = { low: 0, medium: 1, high: 2 };

/**
 * The GPU's name where the browser gives it — '' where it doesn't (some browsers withhold or
 * generalise it; then the CPU and memory hints alone decide). Firefox gives it as the plain RENDERER
 * (and warns about the debug extension), Chrome and Safari only through the debug extension.
 */
function gpuName(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return '';
    let name = String(gl.getParameter(gl.RENDERER) ?? '');
    if (!name || /^webkit webgl$/i.test(name)) {
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '') : '';
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return '';
  }
}

/**
 * The most a GPU is started at: a software renderer draws on the CPU (low); an older integrated chip
 * (Intel HD / UHD Graphics — not Iris Xe or Arc) can't hold the high tier's frame (medium). Anything
 * else — and anything unknown — keeps the tier the device earns; the frame's own pace (ExperienceCanvas)
 * does the rest.
 */
export function gpuCap(name: string): QualityTier | null {
  if (/swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render/i.test(name)) return 'low';
  if (/intel/i.test(name) && /\bu?hd graphics\b/i.test(name) && !/iris|arc/i.test(name)) return 'medium';
  return null;
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
