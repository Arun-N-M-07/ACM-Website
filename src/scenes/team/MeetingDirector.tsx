'use client';
/**
 * Subtitles for the meetings: shows whichever line (content/meetings.ts) is
 * live at this point of the tour. Pure function of scroll — scrub back and the
 * line comes back.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { meetingFor, type Line } from '@/content/meetings';
import { DIRECTORS } from '@/content/team';
import { experience } from '@/store/experience';
import { TOUR_STOPS } from '@/systems/camera/tour';
import { tour } from '@/systems/characters/cues';

export function MeetingDirector() {
  const last = useRef('');
  useFrame(() => {
    let line: Line | null = null;
    let key = '';
    if (tour.inTeam && tour.walk >= 1) {
      const stop = TOUR_STOPS[tour.index];
      const meeting = stop.id === 'core' ? undefined : meetingFor(stop.id);
      for (const l of meeting?.lines ?? []) {
        if (tour.meet >= l.at && tour.meet < l.at + (l.dur ?? 0.2)) {
          line = l;
          key = `${stop.id}:${l.at}`;
        }
      }
    }
    if (key === last.current) return;
    last.current = key;
    const st = experience();
    if (!line) {
      if (st.speech) st.set({ speech: null });
      return;
    }
    const who = DIRECTORS.find((m) => m.id === line.who);
    st.set({ speech: { memberId: line.who, name: who?.name ?? '', role: who?.role ?? '', text: line.text, until: Number.POSITIVE_INFINITY } });
  });
  return null;
}
