import { useAuth } from '../../context/AuthProvider';
import { formatDate } from '../../lib/format';
import { SettingsShell } from './SettingsShell';

export default function Profile() {
  const { profile, firstName } = useAuth();
  if (!profile) return null;

  const rows: [string, string][] = [
    ['Name', profile.name || '—'],
    ['Email', profile.email],
    ['Role', profile.role],
    ['Status', profile.status],
    ['Job title', profile.jobTitle || '—'],
    ['Department', profile.department || '—'],
    ['Member since', formatDate(profile.createdAt)],
  ];

  return (
    <SettingsShell title="Profile" subtitle="How you appear across the pipeline">
      <div className="surface divide-y divide-slate-200/70 overflow-hidden dark:divide-slate-800/80">
        <div className="flex items-center gap-4 p-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-xl font-bold text-white shadow-[0_10px_24px_rgba(36,84,216,0.22)]">
            {firstName.charAt(0)}
          </div>
          <div>
            <p className="font-display text-lg font-bold">{profile.name || firstName}</p>
            <p className="text-sm text-slate-500 capitalize dark:text-slate-400">
              {profile.role} · {profile.status}
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
