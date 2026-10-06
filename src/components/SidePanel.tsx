import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppearance } from '../context/AppearanceProvider';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { IconClose } from './icons';

function useWideViewport(): boolean {
  const query = '(min-width: 640px)';
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : true,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(query);
    const onChange = () => setWide(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return wide;
}

/** A slide-over work surface for one record: a job, a machine.
 *
 *  It keeps Modal's contract — role="dialog", aria-modal, the shared
 *  `modal-title` label, Escape and backdrop to close, a pinned header and a
 *  scrolling body — and adds a tab strip and a pinned footer. Docked right on
 *  wide screens; a near-full-height bottom sheet on phones.
 *
 *  Closing goes through `onClose` every time, so the owner can refuse it (for
 *  example while a form has unsaved edits). */
export function SidePanel({
  open,
  title,
  meta,
  tabs,
  footer,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  meta?: ReactNode;
  tabs?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const { motionReduced } = useAppearance();
  const wide = useWideViewport();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(panelRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const offscreen = wide ? { x: '100%' } : { y: '100%' };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: motionReduced ? 0 : 0.2 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            tabIndex={-1}
            className="surface-strong drafting-frame fixed inset-x-0 bottom-0 flex max-h-[calc(100dvh-1rem)] flex-col rounded-b-none outline-none sm:inset-y-0 sm:right-0 sm:left-auto sm:h-dvh sm:max-h-dvh sm:w-full sm:max-w-xl sm:rounded-none sm:border-y-0 sm:border-r-0"
            initial={motionReduced ? false : offscreen}
            animate={{ x: 0, y: 0 }}
            exit={motionReduced ? { opacity: 0 } : offscreen}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5 pb-3">
              <div className="min-w-0">
                <h2
                  id="modal-title"
                  className="line-clamp-2 font-display text-xl font-bold tracking-tight text-ink dark:text-slate-50"
                >
                  {title}
                </h2>
                {meta && <div className="mt-1.5">{meta}</div>}
              </div>
              <button
                type="button"
                aria-label="Close dialog"
                title="Close"
                className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                onClick={onClose}
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>
            {tabs && <div className="shrink-0 px-5">{tabs}</div>}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
            {footer && (
              <div className="shrink-0 border-t border-[var(--surface-border)] bg-[var(--surface-bg-strong)] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface PanelTab<T extends string> {
  id: T;
  label: string;
  /** A small count or value shown after the label, e.g. a history count. */
  badge?: ReactNode;
}

/** The panel's tab strip. Arrow keys move between tabs (roving tabindex), and
 *  the active marker slides between them. */
export function PanelTabs<T extends string>({
  tabs,
  active,
  onChange,
  idPrefix,
}: {
  tabs: PanelTab<T>[];
  active: T;
  onChange: (tab: T) => void;
  idPrefix: string;
}) {
  const { motionReduced } = useAppearance();

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((t) => t.id === active);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    onChange(tabs[next].id);
    document.getElementById(`${idPrefix}-tab-${tabs[next].id}`)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className="flex gap-1 overflow-x-auto border-b border-[var(--rule)]"
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            id={`${idPrefix}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-tabpanel`}
            tabIndex={selected ? 0 : -1}
            className={`relative inline-flex shrink-0 items-center gap-1.5 px-3 pt-1.5 pb-2.5 font-mono text-xs font-semibold tracking-[0.08em] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              selected
                ? 'text-ink dark:text-slate-50'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className="readout rounded-sm bg-slate-200/70 px-1 text-[0.65rem] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {tab.badge}
              </span>
            )}
            {selected && (
              <motion.span
                layoutId={motionReduced ? undefined : `${idPrefix}-tab-marker`}
                className="absolute inset-x-2 -bottom-px h-0.5 bg-primary dark:bg-indigo-300"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
