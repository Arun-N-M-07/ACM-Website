'use client';
/**
 * Shared material kit for everything below ground (shaft, hall, corridor,
 * rooms, team workspace). One provider, one set of materials, so the whole
 * facility compiles to a few shader programs and reads as one architecture:
 * board-formed concrete, dark polished floors, blackened steel, low-iron glass,
 * cool linear light and warm task light.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { PALETTE } from '@/config/palette';
import { QUALITY } from '@/config/quality';
import { useExperience } from '@/store/experience';
import { useDisposable } from '@/systems/performance/useDisposable';
import { concreteTexture, floorTexture } from '@/systems/textures/surfaces';

function createKit(textureScale: number) {
  const concrete = concreteTexture(textureScale, 118);
  concrete.texture.repeat.set(1 / concrete.tile, 1 / concrete.tile);
  const floor = floorTexture(textureScale, 34);
  floor.texture.repeat.set(1 / floor.tile, 1 / floor.tile);
  return {
    textures: [concrete.texture, floor.texture],
    concrete: new MeshStandardMaterial({ map: concrete.texture, roughness: 0.88, color: '#d6d2cb' }),
    concreteDark: new MeshStandardMaterial({ map: concrete.texture, roughness: 0.9, color: '#6e6b66' }),
    floor: new MeshStandardMaterial({ map: floor.texture, roughness: 0.32, metalness: 0.08 }),
    ceiling: new MeshStandardMaterial({ color: '#1c1d20', roughness: 0.95, side: DoubleSide }),
    steel: new MeshStandardMaterial({ color: '#25282c', roughness: 0.36, metalness: 0.85 }),
    steelLight: new MeshStandardMaterial({ color: PALETTE.steel, roughness: 0.3, metalness: 0.8 }),
    glass: new MeshStandardMaterial({
      color: PALETTE.glass,
      roughness: 0.04,
      metalness: 0.25,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      side: DoubleSide,
    }),
    wood: new MeshStandardMaterial({ color: '#7b5b3f', roughness: 0.66 }),
    oak: new MeshStandardMaterial({ color: '#b08a60', roughness: 0.6 }),
    fabric: new MeshStandardMaterial({ color: '#2c2f35', roughness: 0.95 }),
    cork: new MeshStandardMaterial({ color: '#a8845a', roughness: 1 }),
    paper: new MeshStandardMaterial({ color: '#ece6da', roughness: 0.9 }),
    screenOff: new MeshStandardMaterial({ color: '#0b0d10', roughness: 0.25, metalness: 0.3 }),
    lightCool: new MeshBasicMaterial({ color: new Color('#e3ecff').multiplyScalar(1.6) }),
    lightWarm: new MeshBasicMaterial({ color: new Color('#ffd4a0').multiplyScalar(1.5) }),
    acmLine: new MeshBasicMaterial({ color: new Color(PALETTE.acm).multiplyScalar(1.3) }),
    redLine: new MeshBasicMaterial({ color: new Color(PALETTE.cegRed).multiplyScalar(1.2) }),
    black: new MeshStandardMaterial({ color: '#0d0d0e', roughness: 0.7 }),
  };
}

export type Kit = ReturnType<typeof createKit>;

const KitContext = createContext<Kit | null>(null);

export function UndergroundKit({ children }: { children: ReactNode }) {
  const quality = useExperience((s) => s.quality);
  const kit = useDisposable(() => createKit(QUALITY[quality].textureScale), [quality]);
  return <KitContext.Provider value={kit}>{children}</KitContext.Provider>;
}

export function useKit(): Kit {
  const kit = useContext(KitContext);
  if (!kit) throw new Error('useKit() must be used inside <UndergroundKit>');
  return kit;
}
