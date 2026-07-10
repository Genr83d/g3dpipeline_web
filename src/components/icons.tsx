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
export const IconTag = (p: IconProps = {}) =>
  base(<path d="M20 13l-7 7-10-10V3h7l10 10zM7.5 7.5h.01" />, p);
export const IconGear = (p: IconProps = {}) =>
  base(<><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 8.96 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.09A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3h4v.09A1.7 1.7 0 0 0 15.04 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.26.62.87 1.03 1.56 1.03H21v4h-.09A1.7 1.7 0 0 0 19.4 15z" /></>, p);
export const IconPalette = (p: IconProps = {}) =>
  base(<><path d="M12 3a9 9 0 1 0 0 18h1.5a1.5 1.5 0 0 0 0-3H12a2 2 0 0 1 0-4h2a7 7 0 0 0-2-11z" /><path d="M7.5 10h.01M9.5 6.5h.01M14 6.5h.01M17 9.5h.01" /></>, p);
export const IconCode = (p: IconProps = {}) =>
  base(<path d="M8 9l-4 3 4 3M16 9l4 3-4 3M14 5l-4 14" />, p);
export const IconFilter = (p: IconProps = {}) =>
  base(<path d="M4 5h16l-6 7v5l-4 2v-7z" />, p);
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
export const IconCloudOff = (p: IconProps = {}) =>
  base(<path d="M22.6 16.7A5 5 0 0 0 18 10h-1.3A8 8 0 0 0 5.6 5.6M3.5 7.4A8 8 0 0 0 3 10a5 5 0 0 0-.6 9.9L18 20M2 2l20 20" />, p);
export const IconMail =(p: IconProps = {}) =>
  base(<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6" />, p);
export const IconWrench = (p: IconProps = {}) =>
  base(<path d="M14.7 6.3a4 4 0 0 0 4.9 4.9l-8.4 8.4a2.1 2.1 0 0 1-3 0l-3.8-3.8a2.1 2.1 0 0 1 0-3l8.4-8.4a4 4 0 0 0 1.9 1.9zM7 17l-2 2" />, p);
export const IconMapPin = (p: IconProps = {}) =>
  base(<path d="M12 22s7-4.9 7-12a7 7 0 1 0-14 0c0 7.1 7 12 7 12zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />, p);
export const IconHistory = (p: IconProps = {}) =>
  base(<path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2" />, p);
