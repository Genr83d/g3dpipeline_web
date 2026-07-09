import { SettingsShell } from './SettingsShell';
import { BrandMark } from '../../components/BrandMark';

export default function About() {
  return (
    <SettingsShell title="About & privacy">
      <div className="surface space-y-3 p-5">
        <div className="flex items-center gap-3">
          <BrandMark className="h-14 w-14" alt="" />
          <div>
            <p className="font-display text-lg font-bold">GENR8 Pipeline</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Web client · v0.1.0</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Production job-tracking for the GENR8 3D print shop. One live pipeline shared across
          every device, in real time.
        </p>
      </div>
      <div className="surface space-y-2 p-5">
        <h2 className="font-display font-bold">Privacy</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Your account (name, email, role, status) and the jobs you create or work on are stored
          in the shop's Firebase project and are visible to other signed-in staff. Appearance
          preferences stay on this device. No analytics or third-party tracking.
        </p>
      </div>
    </SettingsShell>
  );
}
