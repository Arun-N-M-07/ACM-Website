'use client';
/** The last anchored plate leaves the reconstructed journey in full view. */
import { CHAPTER } from '@/content/chapter';
import { useExperience } from '@/store/experience';
import { TOUR_STOPS, tourProgress } from '@/systems/camera/tour';
import { backToJourney } from './navigation';
import { Plate } from './Plate';

const RANGE: [number, number] = [tourProgress(TOUR_STOPS.length - 1, 0.62), 1.1];

export function FinaleOverlay() {
  const phase = useExperience((s) => s.phase);
  const set = useExperience((s) => s.set);
  if (phase !== 'cinematic') return null;
  return (
    <Plate id="finale" side="left" anchor="core" pin="THE JOURNEY, CONNECTED" accent="#ffb86b" range={RANGE} ramp={0.002} className="finale-plate">
      <p className="plate-kicker">09 / The core · Since {CHAPTER.established}</p>
      <h2 className="finale-heading">Made of<br /><em>many minds.</em></h2>
      <p className="plate-body">A campus. A community. A place for your curiosity.</p>
      <p className="finale-membership">{CHAPTER.membership.openTo} {CHAPTER.membership.fee}</p>
      <div className="finale-route" aria-label="The connected journey"><span>Place</span><i /><span>Programmes</span><i /><span>People</span></div>
      <div className="plate-actions">
        <a className="plate-btn" href={`mailto:${CHAPTER.contact.email}`}>Find your place ↗</a>
        <button className="plate-btn ghost" onClick={() => set({ textVersionOpen: true })}>Read the chapter</button>
      </div>
      <div className="finale-socials">{CHAPTER.socials.map((s) => <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer">{s.label} ↗</a>)}</div>
      <button className="finale-replay" onClick={() => backToJourney(0)}><span aria-hidden="true">↶</span> Back to the red building</button>
    </Plate>
  );
}
