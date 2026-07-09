import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/AuthProvider';
import { signOut } from '../services/authService';
import { useAppearance } from '../context/AppearanceProvider';
import {
  IconUser, IconShield, IconMoon, IconUsers, IconHelp, IconInfo, IconLogout, IconMail,
} from './icons';

export function AccountMenu() {
  const { profile, firstName, isAdmin } = useAuth();
  const { motionReduced } = useAppearance();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = [
    { to: '/settings/profile', icon: <IconUser className="h-4 w-4" />, label: 'Profile' },
    { to: '/settings/personal', icon: <IconMail className="h-4 w-4" />, label: 'Personal information' },
    { to: '/settings/security', icon: <IconShield className="h-4 w-4" />, label: 'Security' },
    { to: '/settings/appearance', icon: <IconMoon className="h-4 w-4" />, label: 'Appearance' },
    ...(isAdmin
      ? [{ to: '/settings/users', icon: <IconUsers className="h-4 w-4" />, label: 'User management' }]
      : []),
    { to: '/settings/help', icon: <IconHelp className="h-4 w-4" />, label: 'Help' },
    { to: '/settings/about', icon: <IconInfo className="h-4 w-4" />, label: 'About & privacy' },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-primary/20 bg-primary text-sm font-bold text-white shadow-[0_10px_24px_rgba(36,84,216,0.22)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(36,84,216,0.28)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95 dark:focus-visible:ring-offset-slate-950"
      >
        {firstName.charAt(0) || '?'}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={motionReduced ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="surface-strong absolute right-0 z-30 mt-2 w-72 overflow-hidden p-1.5"
          >
            <div className="border-b border-slate-200/70 px-3 py-3 dark:border-slate-800/80">
              <p className="truncate text-sm font-semibold">{profile?.name || firstName}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{profile?.email}</p>
              <p className="mt-1 text-xs font-semibold text-primary capitalize dark:text-indigo-300">
                {profile?.role}
              </p>
            </div>
            <nav className="py-1">
              {items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-white/70 focus-visible:bg-white/70 focus-visible:outline-none dark:hover:bg-slate-800/80 dark:focus-visible:bg-slate-800/80"
                >
                  <span className="text-slate-500 dark:text-slate-400">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <button
              role="menuitem"
              onClick={() => void signOut()}
              className="flex w-full cursor-pointer items-center gap-3 rounded-md border-t border-slate-200/70 px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger-soft focus-visible:bg-danger-soft focus-visible:outline-none dark:border-slate-800/80 dark:text-red-300 dark:hover:bg-red-950/80"
            >
              <IconLogout className="h-4 w-4" />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
