import { SettingsShell } from './SettingsShell';

const faqs = [
  {
    q: 'How do jobs work?',
    a: 'A job moves pending → in progress → completed. Anyone can add a job. A collaborator can start an assigned job, and collaborators, managers, or admins can complete work in progress. Managers and admins can edit jobs and restore completed ones from the Archive.',
  },
  {
    q: 'Why can two people not start the same job?',
    a: 'Starting a job is a transaction: the first person to tap Start claims it, and anyone else gets a friendly error instead of a duplicate claim.',
  },
  {
    q: 'Do I need to refresh?',
    a: 'Never. Everything streams live — changes made on any device appear on all others within a second or two.',
  },
  {
    q: 'What does “Overdue” mean?',
    a: 'The due date has passed and the job is not completed yet. Overdue jobs are flagged in red on the board and counted on the Summary tab.',
  },
  {
    q: 'How do I get a bigger role?',
    a: 'Roles (Staff, AWF Staff, Manager, and Admin) are assigned directly in the Firebase Console — ask your admin.',
  },
];

export default function Help() {
  return (
    <SettingsShell title="Help" subtitle="Quick answers about the pipeline">
      <div className="space-y-3">
        {faqs.map((f) => (
          <details key={f.q} className="surface surface-hover group p-4">
            <summary className="cursor-pointer font-semibold select-none marker:text-primary">{f.q}</summary>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{f.a}</p>
          </details>
        ))}
      </div>
    </SettingsShell>
  );
}
