/**
 * Resolves a team member's avatar appearance: neutral placeholder defaults,
 * then domain-coloured professional clothing, then the member's own overrides
 * (which should be matched to their reference photo — docs/ASSETS.md).
 *
 * Placeholders never guess identity traits from names: hair, skin, glasses and
 * facial hair stay neutral until explicitly set in content/team.ts.
 */
import { type AvatarAppearance, NEUTRAL_APPEARANCE, type TopStyle } from '@/content/avatar';
import { domainById } from '@/content/domains';
import type { TeamMember } from '@/content/team';
import { hashString, pick, rng } from '@/lib/random';
import { Color } from 'three';

const PROFESSIONAL_TOPS: TopStyle[] = ['shirt', 'shirt', 'tshirt', 'blazer', 'hoodie'];
const BOTTOMS = ['#23262c', '#2e3138', '#3a3d44', '#1f2a3a', '#4a4540'];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function resolveAppearance(member: TeamMember): AvatarAppearance {
  const r = rng(hashString(member.id));
  const accent = new Color(domainById(member.domain).accent);
  // Muted, wearable version of the domain accent.
  const hsl = { h: 0, s: 0, l: 0 };
  accent.getHSL(hsl);
  const top = new Color().setHSL(hsl.h, Math.min(0.35, hsl.s * 0.55), 0.3 + r() * 0.25);
  const isOffice = member.domain === 'office';

  const placeholder: AvatarAppearance = {
    ...NEUTRAL_APPEARANCE,
    top: isOffice ? (r() < 0.5 ? 'blazer' : 'shirt') : pick(r, PROFESSIONAL_TOPS),
    topColor: `#${top.getHexString()}`,
    bottomColor: pick(r, BOTTOMS),
  };
  const merged = { ...placeholder, ...member.appearance };
  merged.height = clamp(merged.height, 1.5, 1.9);
  merged.build = clamp(merged.build, 0.92, 1.08);
  return merged;
}
