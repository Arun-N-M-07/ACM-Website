'use client';
/** Keep keyboard navigation inside an open overlay and restore its trigger on close. */
import { useEffect, type RefObject } from 'react';

export function useModalFocus(active: boolean, root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!active || !el) return;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () => [...el.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]')].filter((n) => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden');
    controls()[0]?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = controls();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) { e.preventDefault(); return; }
      if (!el.contains(document.activeElement) || (e.shiftKey && document.activeElement === first)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('keydown', onKey);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [active, root]);
}
