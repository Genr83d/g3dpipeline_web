import type { ReactNode } from 'react';

/**
 * Bottom clearance for floating add actions: 112px for the application
 * bottom navigation plus the device safe-area inset, so the button body,
 * border, and shadow never render behind either.
 */
export const FLOATING_ADD_CLEARANCE = 'calc(112px + env(safe-area-inset-bottom, 0px))';

/** Floating add action shown on small viewports; larger layouts use the header button. */
export function FloatingAddButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="btn-primary fixed right-4 z-10 shadow-[0_13px_30px_rgba(36,84,216,0.32)] sm:hidden"
      style={{ bottom: FLOATING_ADD_CLEARANCE }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
