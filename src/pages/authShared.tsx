import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useAppearance } from '../context/AppearanceProvider';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { motionReduced } = useAppearance();
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <motion.div
        initial={motionReduced ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="surface w-full max-w-sm p-6 sm:p-8"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary font-display text-lg font-black text-white">
            G8
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">{title}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
