/**
 * Avatar schema shared by the content layer and the character system.
 *
 * Avatars are stylised, normally-proportioned, professionally dressed figures.
 * Per-person appearance should be matched to that person's photo on the team
 * page (see docs/ASSETS.md → "Matching avatars to reference photos"), or be
 * replaced by a GLB model via `TeamMember.model`.
 */
export type HairStyle = 'short' | 'medium' | 'long' | 'ponytail' | 'bun' | 'buzz' | 'curly' | 'covered';
export type TopStyle = 'shirt' | 'tshirt' | 'hoodie' | 'blazer' | 'kurta';
export type FacialHair = 'none' | 'stubble' | 'beard' | 'moustache';

export interface AvatarAppearance {
  /** Standing height in metres (normal adult range 1.50–1.90). */
  height: number;
  /** Shoulder/torso width multiplier, clamped to 0.92–1.08 so proportions stay natural. */
  build: number;
  skin: string;
  hair: HairStyle;
  hairColor: string;
  facialHair: FacialHair;
  glasses: boolean;
  top: TopStyle;
  topColor: string;
  bottomColor: string;
  shoeColor: string;
  /** Colour of the head covering when `hair` is 'covered'. */
  coveringColor?: string;
}

export type Activity =
  | 'typing'
  | 'writing'
  | 'thinking'
  | 'sketching'
  | 'reviewing'
  | 'pointing'
  | 'phone'
  | 'clipboard'
  | 'pinning'
  | 'presenting'
  | 'watching'
  | 'boardwork';

/** Neutral placeholder used until an appearance is matched to a reference photo. */
export const NEUTRAL_APPEARANCE: AvatarAppearance = {
  height: 1.7,
  build: 1,
  skin: '#8d5a3b',
  hair: 'medium',
  hairColor: '#1b1512',
  facialHair: 'none',
  glasses: false,
  top: 'shirt',
  topColor: '#d9d4ca',
  bottomColor: '#2b2d33',
  shoeColor: '#1a1a1c',
};
