import { useAuth } from '../../context/AuthProvider';
import { IconUsers } from '../../components/icons';
import { formatDate } from '../../lib/format';
import { roleLabel } from '../../lib/roles';
import { SettingsShell } from './SettingsShell';

export default function Profile() {
  const { profile, firstName } = useAuth();
  if (!profile) return null;
  const isAwf = profile.role === 'awf';

  const rows: [string, string][] = [
    ['Name', profile.name || '—'],
    ['Email', profile.email],
    ['Role', roleLabel(profile.role)],
    ['Status', profile.status],
    ['Job title', profile.jobTitle || '—'],
    ['Department', profile.department || '—'],
    ['Member since', formatDate(profile.createdAt)],
  ];

  return (
    <SettingsShell title="Profile" subtitle="How you appear across the pipeline">
      <div className="surface divide-y divide-slate-200/70 overflow-hidden dark:divide-slate-800/80">
        <div className="flex items-center gap-4 p-5">
          <div className={`flex h-14 w-14 items-center justify-center rounded-lg text-xl font-bold text-white ${
            isAwf
              ? 'bg-secondary shadow-[0_10px_24px_rgba(16,153,109,0.22)]'
              : 'bg-primary shadow-[0_10px_24px_rgba(36,84,216,0.22)]'
          }`}>
            {isAwf ? <IconUsers className="h-6 w-6" /> : firstName.charAt(0)}
          </div>
          <div>
            <p className="font-display text-lg font-bold">{profile.name || firstName}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {roleLabel(profile.role)} · <span className="capitalize">{profile.status}</span>
            </p>
          </div>
        </div>
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-5 py-3 text-sm">
            <span className="text-slate-500 dark:text-slate-400">{label}</span>
            <span className="font-medium capitalize">{value}</span>
          </div>
        ))}
      </div>
    </SettingsShell>
  );
}
