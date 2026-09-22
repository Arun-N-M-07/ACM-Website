/**
 * Colour language. Near-black and warm off-white carry the typography; CEG red
 * is reserved for the building and the chapter's flagship moments; ACM blue is
 * used for cool light and wayfinding only. Mirrored as CSS custom properties in
 * app/globals.css — keep both in sync.
 */
export const PALETTE = {
  ink: '#0b0b0c',
  ink2: '#141416',
  bone: '#efe9df',
  boneDim: '#b9b2a6',
  acm: '#2b74d9',
  acmDeep: '#10335f',
  cegRed: '#a8412f',
  cegRedDeep: '#6a2419',
  brickMortar: '#d8c7b0',
  trim: '#efe3cf',
  warm: '#ffb86b',
  warmDim: '#c7864a',
  steel: '#8b939c',
  concrete: '#77736e',
  concreteDark: '#3b3a38',
  glass: '#9fb6c8',
  lawn: '#3f5a2c',
  canopy: '#2f4a26',
  road: '#4a4744',
  sand: '#cdbb9c',

  skyZenith: '#1a2440',
  skyMid: '#5d5f7d',
  skyHorizon: '#e8a46e',
  sun: '#ffc58a',

  underground: '#07080a',
  undergroundFog: '#0a0c10',
} as const;
