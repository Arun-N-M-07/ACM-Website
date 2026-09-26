'use client';
/** Global shortcuts: N / P step between framed stops, M opens the index, T the text version. */
import { useEffect } from 'react';
import { useExperience } from '@/store/experience';
import { teams } from '@/teams/state';
import { stepStop } from './navigation';

export function KeyboardNav() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable))) return;
      const st = useExperience.getState();
      if (st.phase === 'loading' || st.phase === 'ready' || st.dossier || st.textVersionOpen) return;
      const k = e.key.toLowerCase();
      if (k === 'm') st.set({ menuOpen: !st.menuOpen });
      else if (k === 't') st.set({ textVersionOpen: true });
      else if (st.phase === 'cinematic' && !st.menuOpen && (k === 'n' || k === 'p')) {
        // With a domain open, the arrow keys move between domains instead.
        const ts = teams().state;
        if (ts === 'cardFocused' || ts === 'domainDetail') return;
        stepStop(k === 'n' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}
