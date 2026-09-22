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

  const close = () => {
    set({ textVersionOpen: false });
    if (window.location.hash === '#archive') history.replaceState(null, '', window.location.pathname);
  };

  return (
    <div className="archive-controls">
      <span className="kicker">Text version</span>
      <button ref={ref} className="btn archive-close" onClick={close}>
        Back to the journey ✕
      </button>
    </div>
  );
}
