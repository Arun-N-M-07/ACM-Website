import portraits from './generated/crew-portraits.json';
import { TEAM_DOMAINS } from './teams';

/** One identity per person, in chapter order; repeated assignments share a portrait. */
const photos = portraits.members as Record<string, { src: string; source: { file: string }; face: { cx: number; cy: number } }>;
export const CREW_PEOPLE = Array.from(new Set(TEAM_DOMAINS.flatMap((d) => [...d.members]))).map((name) => {
  const photo = photos[name];
  if (!photo) throw new Error(`No verified ACM photograph for ${name}`);
  return {
    id: photo.src.split('/').pop()!.replace('.webp', ''),
    name,
    src: `/media/crew/originals/${encodeURIComponent(photo.source.file)}`,
    source: photo.source.file,
    face: photo.face,
  };
});
