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
    (value as Disposable).dispose();
    // Materials own their textures only when we created them together; textures
    // are disposed explicitly by listing them in the factory result.
    return;
  }
  if (Array.isArray(value)) value.forEach((v) => disposeDeep(v, seen));
  else Object.values(value as Record<string, unknown>).forEach((v) => disposeDeep(v, seen));
}
