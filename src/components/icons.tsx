interface IconProps {
  className?: string;
}

function base(path: React.ReactNode, { className = 'h-5 w-5' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {path}
    </svg>
  );
}

export const IconPlus = (p: IconProps = {}) => base(<path d="M12 5v14M5 12h14" />, p);
export const IconPlay = (p: IconProps = {}) => base(<path d="M7 4.5v15l12-7.5z" />, p);
export const IconCheck = (p: IconProps = {}) => base(<path d="M4 12.5l5 5L20 6.5" />, p);
export const IconTrash = (p: IconProps = {}) =>
  base(<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" />, p);
export const IconEdit = (p: IconProps = {}) =>
  base(<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />, p);
export const IconRestore = (p: IconProps = {}) =>
  base(<path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />, p);
export const IconBox = (p: IconProps = {}) =>
  base(<path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" />, p);
export const IconCalendar = (p: IconProps = {}) =>
  base(<path d="M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />, p);
export const IconUser = (p: IconProps = {}) =>
  base(<path d="M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />, p);
export const IconUserPlus = (p: IconProps = {}) =>
  base(<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M16 11h6" />, p);
export const IconUsers = (p: IconProps = {}) =>
  base(<path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />, p);
export const IconClock = (p: IconProps = {}) =>
  base(<path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2" />, p);
export const IconAlert = (p: IconProps = {}) =>
  base(<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />, p);
export const IconShield = (p: IconProps = {}) =>
  base(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />, p);
export const IconMoon = (p: IconProps = {}) =>
  base(<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />, p);
export const IconLogout = (p: IconProps = {}) =>
  base(<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />, p);
export const IconInfo = (p: IconProps = {}) =>
  base(<path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01" />, p);
export const IconHelp = (p: IconProps = {}) =>
  base(<path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />, p);
export const IconChevron = (p: IconProps = {}) => base(<path d="M9 18l6-6-6-6" />, p);
export const IconBack = (p: IconProps = {}) => base(<path d="M19 12H5M12 19l-7-7 7-7" />, p);
export const IconSearch = (p: IconProps = {}) =>
  base(<path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" />, p);
export const IconClose = (p: IconProps = {}) => base(<path d="M18 6L6 18M6 6l12 12" />, p);
export const IconLayers = (p: IconProps = {}) =>
  base(<path d="M12 2L2 7l10 5 10-5-10-5zM2 12l10 5 10-5M2 17l10 5 10-5" />, p);
export const IconMail =(p: IconProps = {}) =>
  base(<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6" />, p);
