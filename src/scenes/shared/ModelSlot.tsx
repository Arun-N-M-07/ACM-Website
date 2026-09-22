'use client';
/**
 * Renders the GLB for a model slot when it exists, otherwise the procedural
 * stand-in. Loading is lazy (only when the slot mounts) and failures fall back
 * silently, so a missing or broken model never breaks the journey.
 */
import { useGLTF } from '@react-three/drei';
import { Suspense, useMemo, type ReactNode } from 'react';
import type { Mesh, Object3D } from 'three';
import { MODEL_SLOTS, type ModelSlotId } from '@/config/assets';
import { isAvailable } from '@/content/media';
import { SafeBoundary } from './SafeBoundary';

function Loaded({ id }: { id: ModelSlotId }) {
  const def = MODEL_SLOTS[id];
  const { scene } = useGLTF(def.path);
  const object = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.castShadow = !!def.castShadow;
        m.receiveShadow = true;
      }
    });
    return clone;
  }, [scene, def.castShadow]);
  return <primitive object={object} position={def.position ?? [0, 0, 0]} rotation={def.rotation ?? [0, 0, 0]} scale={def.scale ?? 1} />;
}

export function ModelSlot({ id, children }: { id: ModelSlotId; children: ReactNode }) {
  if (!isAvailable(MODEL_SLOTS[id].path)) return <>{children}</>;
  return (
    <SafeBoundary name={`model:${id}`} fallback={children}>
      <Suspense fallback={children}>
        <Loaded id={id} />
      </Suspense>
    </SafeBoundary>
  );
}
