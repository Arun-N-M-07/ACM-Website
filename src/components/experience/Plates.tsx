'use client';
/**
 * Every content plate along the journey, in order: the chapter on the drone
 * flight, the facility, one per event room, and the door. (The team's plates
 * live in TeamHud; the finale is its own overlay.)
 */
import { useMemo } from 'react';
import { SEGMENTS, type SegmentId } from '@/config/timeline';
import { CORRIDOR } from '@/config/world';
import { CHAPTER, yearsActive } from '@/content/chapter';
import { EVENTS, FLAGSHIPS } from '@/content/events';
import { useExperience } from '@/store/experience';
import { roomDwellRange } from '@/systems/camera/shots';
import { Plate, PlateFacts } from './Plate';

const at = (seg: SegmentId, t: number) => SEGMENTS[seg].start + (SEGMENTS[seg].end - SEGMENTS[seg].start) * t;
const pad2 = (n: number) => String(n).padStart(2, '0');

export function Plates() {
  const set = useExperience((s) => s.set);
  const phase = useExperience((s) => s.phase);
  const ranges = useMemo(
    () => ({
      about: [at('ascent', 0.12), at('ascent', 0.9)] as [number, number],
      join: [at('campus', 0.1), at('campus', 0.95)] as [number, number],
      mission: [at('topdown', 0.1), at('descent', 0.05)] as [number, number],
      facility: [at('facility', 0.04), at('facility', 0.19)] as [number, number],
      legacy: [at('facility', 0.73), at('facility', 0.87)] as [number, number],
      door: [at('door', 0.12), at('door', 0.7)] as [number, number],
      rooms: CORRIDOR.rooms.map((r) => {
        const [a, b] = roomDwellRange(r.index);
        const len = b - a;
        return [a + len * 0.05, b - len * 0.12] as [number, number];
      }),
    }),
    [],
  );

  return (
    <div className="plates" data-phase={phase}>
      <Plate id="about" side="left" anchor="tower" pin="THE CLOCK TOWER" range={ranges.about}>
        <p className="plate-kicker">Since {CHAPTER.established} · The chapter</p>
        <h2 className="plate-title">To instill an unwavering enthusiasm for computer science.</h2>
        <p className="plate-body">{CHAPTER.about}</p>
      </Plate>

      <Plate id="join" side="right" anchor="porch" pin="COLLEGE OF ENGINEERING GUINDY" range={ranges.join}>
        <p className="plate-kicker">Open to everyone</p>
        <h2 className="plate-title">Anyone, from any department.</h2>
        <PlateFacts
          facts={[
            { label: 'Membership fee', value: CHAPTER.membership.fee.replace(/\.$/, '') },
            { label: 'How to join', value: CHAPTER.membership.howToJoin },
            { label: 'Find us', value: CHAPTER.contact.officeNote.replace(/\.$/, '') },
          ]}
        />
      </Plate>

      <Plate id="mission" side="left" anchor="well" pin="THE WAY IN" range={ranges.mission}>
        <p className="plate-kicker">Mission</p>
        <blockquote className="plate-quote">{CHAPTER.mission}</blockquote>
      </Plate>

      <Plate id="facility" side="right" anchor="board" pin="DEPARTURES" range={ranges.facility}>
        <p className="plate-kicker">05 · The facility</p>
        <h2 className="plate-title">Where the work happens.</h2>
        <p className="plate-body">
          {EVENTS.length - FLAGSHIPS.length} programmes and {FLAGSHIPS.length} flagships, one room each — every one of them is on the board. Keep scrolling to walk the corridor.
        </p>
      </Plate>

      <Plate id="legacy" side="left" anchor="plaque" pin={`EST. ${CHAPTER.established}`} range={ranges.legacy}>
        <p className="plate-kicker">The legacy · {yearsActive()} years</p>
        <h2 className="plate-title">Where they go next.</h2>
        <p className="plate-body">{CHAPTER.legacy.text}</p>
        <PlateFacts
          facts={[
            ...CHAPTER.legacy.stats.map((s) => ({ label: s.label, value: s.value })),
            ...CHAPTER.alsoRuns.map((a) => ({ label: a.name, value: a.text.replace(/\.$/, '') })),
          ]}
        />
      </Plate>

      {CORRIDOR.rooms.map((r, i) => {
        const e = r.event;
        return (
          <Plate
            key={e.slug}
            id={`room-${e.slug}`}
            side={r.side === -1 ? 'right' : 'left'}
            anchor={`room:${e.slug}`}
            accent={e.accent}
            pin={`ROOM ${pad2(r.index + 1)}`}
            range={ranges.rooms[i]}
          >
            <p className="plate-kicker">
              Room {pad2(r.index + 1)} / {pad2(CORRIDOR.rooms.length)} · {e.kind} · {e.cadence}
              {e.flagship ? ' · Flagship' : ''}
            </p>
            <h2 className="plate-title">{e.title}</h2>
            <p className="plate-body">{e.summary}</p>
            {e.facts.length > 0 && <PlateFacts facts={e.facts.slice(0, 3).map((f) => ({ label: f.label, value: f.value }))} />}
            <div className="plate-actions">
              <button className="plate-btn" onClick={() => set({ dossier: e.slug })}>
                Full dossier →
              </button>
              {e.links.slice(0, 1).map((l) => (
                <a key={l.href} className="plate-btn ghost" href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.label} ↗
                </a>
              ))}
            </div>
          </Plate>
        );
      })}

      <Plate id="door" side="left" anchor="door" pin="BEYOND THE EVENTS" range={ranges.door}>
        <p className="plate-kicker">07 · End of the corridor</p>
        <h2 className="plate-title">Beyond the events: the people.</h2>
        <p className="plate-body">Keep scrolling and step through. Every domain of the team is inside — you’ll meet them one by one.</p>
      </Plate>
    </div>
  );
}
