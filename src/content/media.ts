/**
 * Media manifest.
 *
 * Every photograph used by the experience mirrors a file on the current
 * ACM-CEG site (https://auceg.acm.org/assets/img/...). To install the real
 * imagery, copy the site's `assets/img/` folder into `public/media/` — paths
 * are kept identical so no config changes are needed. `npm run dev` / `build`
 * re-scans `public/` and the experience picks up whatever exists; anything
 * missing is rendered as a typographic stand-in instead of a broken image.
 */
import generated from './generated/available-assets.json';

export const SITE_ORIGIN = 'https://auceg.acm.org';

export interface MediaAsset {
  id: string;
  /** Local path under /public. */
  src: string;
  /** Where the original lives on the current chapter website. */
  sourceUrl: string;
  alt: string;
  caption?: string;
}

const available = new Set<string>(generated.files);

export function isAvailable(src: string | undefined | null): src is string {
  return !!src && available.has(decodeURI(src));
}

/** Mirror of a file under the current site's `assets/img/` folder. */
export function siteMedia(id: string, path: string, alt: string, caption?: string): MediaAsset {
  return { id, src: encodeURI(`/media/${path}`), sourceUrl: encodeURI(`${SITE_ORIGIN}/assets/img/${path}`), alt, caption };
}
const fromSite = siteMedia;

export const BRAND_LOGO: MediaAsset = {
  id: 'brand.logo',
  src: '/brand/acm-ceg-logo-white.png',
  sourceUrl: `${SITE_ORIGIN}/assets/img/LOGO_white.png`,
  alt: 'ACM-CEG Student Chapter logo',
};

export const MEDIA = {
  about: fromSite('about', 'about/about1.jpg', 'ACM-CEG Student Chapter members at an event'),

  eventProdigy: fromSite('event.prodigy', 'events/prodigy.jpg', 'Prodigy event'),
  eventCodher: fromSite('event.codher', 'events/codher.jpeg', 'CodHer hackathon'),
  eventCode: fromSite('event.code', 'events/code.jpeg', 'C.O.D.E programme'),
  eventCodex: fromSite('event.codex', 'events/codex.jpeg', 'CodeX contest series'),
  eventHeadfirst: fromSite('event.headfirst', 'events/headfirst.png', 'Head First programme'),
  eventOffcamp: fromSite('event.offcamp', 'events/offcamp.png', 'OffCamp opportunities programme'),
  eventSchrodinger: fromSite('event.schrodinger', 'events/schrodinger.png', 'Schr0ding3r5 cybersecurity wing'),
  eventMl: fromSite('event.ml', 'events/ml.jpeg', 'Machine Learning 101 sessions'),
  eventMasterclass: fromSite('event.masterclass', 'events/masterclass.png', 'MasterClass sessions'),
  eventBellLabs: fromSite('event.belllabs', 'events/bell_labs.png', 'Bell Labs sessions'),
} as const satisfies Record<string, MediaAsset>;

export type MediaId = keyof typeof MEDIA;
