import { SettingsShell } from './SettingsShell';
import { useAuth } from '../../context/AuthProvider';
import { useOnboarding } from '../../onboarding/OnboardingProvider';
import { IconHelp, IconPlay } from '../../components/icons';
import { roleLabel } from '../../lib/roles';

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
  const { profile } = useAuth();
  const { tutorials, startTutorial } = useOnboarding();

  return (
    <SettingsShell title="Help" subtitle="Quick answers and guided walkthroughs">
      <section className="surface-strong space-y-4 p-5" aria-labelledby="walkthrough-heading">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary dark:bg-primary/20 dark:text-indigo-300">
            <IconHelp className="h-5 w-5" />
          </span>
          <div>
            <h2 id="walkthrough-heading" className="font-display text-lg font-bold">Application walkthrough</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Choose a short guide and follow it in the real app. {profile ? `These guides match your ${roleLabel(profile.role)} access.` : ''}
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {tutorials.map((tutorial) => (
            <button
              key={tutorial.id}
              type="button"
              className="surface surface-hover flex cursor-pointer items-start gap-3 p-4 text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              onClick={() => startTutorial(tutorial.id)}
            >
              <IconPlay className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-indigo-300" />
              <span>
                <span className="block text-sm font-bold">{tutorial.id === 'application' ? 'Restart application walkthrough' : tutorial.title}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{tutorial.description}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
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
