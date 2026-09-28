import { useEffect, useMemo, type DependencyList } from 'react';

interface Disposable {
  dispose: () => void;
}

/**
 * useMemo for GPU resources: whatever the factory returns (a geometry,
 * material, texture — or an object/array of them) is disposed when the
 * component unmounts or the deps change. This is what lets chapters stream
 * in and out without leaking GPU memory.
 */
export function useDisposable<T>(factory: () => T, deps: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(factory, deps);
  useEffect(() => () => disposeDeep(value), [value]);
  return value;
}

export function disposeDeep(value: unknown, seen = new Set<unknown>()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (typeof (value as Disposable).dispose === 'function' && !('isObject3D' in (value as object))) {
    // A material's textures go with it — its map slots and its shader uniforms (a texture made for
    // a material and handed only to it would otherwise outlive it on the GPU each time its scene
    // streams out and back in). A texture still used elsewhere is simply uploaded again when next
    // drawn, so this is always safe.
    if ((value as { isMaterial?: boolean }).isMaterial) disposeMaterialTextures(value as Record<string, unknown>, seen);
    (value as Disposable).dispose();
    return;
  }
  if (Array.isArray(value)) value.forEach((v) => disposeDeep(v, seen));
  else Object.values(value as Record<string, unknown>).forEach((v) => disposeDeep(v, seen));
}

function disposeTexture(v: unknown, seen: Set<unknown>) {
  if (!v || typeof v !== 'object' || seen.has(v) || !(v as { isTexture?: boolean }).isTexture) return;
  // (A render target's texture can't be uploaded again: it goes with its render target.)
  if ((v as { isRenderTargetTexture?: boolean }).isRenderTargetTexture) return;
  seen.add(v);
  (v as Disposable).dispose();
}

function disposeMaterialTextures(material: Record<string, unknown>, seen: Set<unknown>) {
  for (const v of Object.values(material)) disposeTexture(v, seen);
  const uniforms = material.uniforms as Record<string, { value?: unknown }> | undefined;
  if (uniforms) for (const u of Object.values(uniforms)) disposeTexture(u?.value, seen);
}
