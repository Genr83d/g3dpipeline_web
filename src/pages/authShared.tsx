import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useAppearance } from '../context/AppearanceProvider';
import { BrandMark } from '../components/BrandMark';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { motionReduced } = useAppearance();
  return (
    <div className="auth-backdrop relative isolate flex min-h-dvh items-center justify-center overflow-hidden p-4">
      <div
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl dark:bg-primary/15"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-28 -bottom-28 h-80 w-80 rounded-full bg-slate-400/15 blur-3xl dark:bg-white/5"
        aria-hidden="true"
      />
      <motion.div
        initial={motionReduced ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="surface relative w-full max-w-sm p-6 sm:p-8"
      >
        <div className="mb-7 text-center">
          <BrandMark className="mx-auto mb-4 h-16 w-16" alt="" />
          <p className="mb-1 text-[0.68rem] font-bold tracking-[0.22em] text-slate-500 uppercase dark:text-slate-400">
            GENR8 Pipeline
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
