import { useEffect, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Floating UI that belongs with whatever dialog is open, such as the guided
 *  tour's tooltip. Tab reaches it after the dialog's own controls. */
const COMPANION = '[data-dialog-companion]';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[inert]') && el.getClientRects().length > 0,
  );
}

function cycle(root: HTMLElement): HTMLElement[] {
  const companions = Array.from(document.querySelectorAll<HTMLElement>(COMPANION));
  return [...focusables(root), ...companions.flatMap(focusables)];
}

/** Keeps keyboard focus inside an open dialog and hands it back on close.
 *
 *  On open it leaves an `autoFocus` field alone; only when nothing inside the
 *  dialog has focus does it move focus to the first control. Tab and
 *  Shift+Tab wrap at the ends, taking in any companion such as the tour
 *  tooltip. On close, focus returns to whatever opened the
 *  dialog, so a keyboard user lands back on the card they were working on. */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;

    const frame = requestAnimationFrame(() => {
      const root = ref.current;
      if (!root || root.contains(document.activeElement)) return;
      (focusables(root)[0] ?? root).focus();
    });

    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const root = ref.current;
      if (!root) return;
      const items = cycle(root);
      if (items.length === 0) return;
      // Moved by hand: a companion is elsewhere in the page, so the browser's
      // own order would leave the dialog to reach it.
      event.preventDefault();
      const at = items.indexOf(document.activeElement as HTMLElement);
      const step = event.shiftKey ? -1 : 1;
      const nextIndex = at === -1 ? (event.shiftKey ? items.length - 1 : 0) : at + step;
      items[(nextIndex + items.length) % items.length].focus();
    }

    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open, ref]);
}
