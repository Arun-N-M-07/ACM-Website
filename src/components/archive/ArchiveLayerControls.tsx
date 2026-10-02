'use client';
import { useEffect, useRef } from 'react';
import { useExperience } from '@/store/experience';

/** Close control for the in-experience text version (hidden in WebGL-fallback mode). */
export function ArchiveLayerControls() {
  const open = useExperience((s) => s.textVersionOpen);
  const set = useExperience((s) => s.set);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    if (document.pointerLockElement) document.exitPointerLock();
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Inside the journey the document's own contents links move within the
  // layer, never through the address bar: the journey reads its hash as a
  // deep link (#team, an event, a domain…), so a section anchor left there
  // would send the next load somewhere the visitor never asked to go.
  useEffect(() => {
    const layer = ref.current?.closest('.archive-layer');
    if (!layer) return;
    const onClick = (e: Event) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
      if (!a || !layer.contains(a)) return;
      const target = document.getElementById((a.getAttribute('href') ?? '').slice(1));
      if (!target || !layer.contains(target)) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: useExperience.getState().reducedMotion ? 'auto' : 'smooth', block: 'start' });
    };
    layer.addEventListener('click', onClick);
    return () => layer.removeEventListener('click', onClick);
  }, []);

  const close = () => {
    set({ textVersionOpen: false });
    if (window.location.hash === '#archive') history.replaceState(null, '', window.location.pathname);
  };

  return (
    <div className="archive-controls">
      <span className="kicker">ACM-CEG · The chapter</span>
      <button ref={ref} className="btn archive-close" onClick={close}>
        Back to the journey ✕
      </button>
    </div>
  );
}
