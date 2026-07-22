import type { UserRole } from '../types';

export type TutorialId =
  | 'application'
  | 'create-job'
  | 'work-job'
  | 'edit-job'
  | 'assign-job'
  | 'inventory'
  | 'maintenance'
  | 'reports'
  | 'manage-account';

export interface TutorialStep {
  title: string;
  body: string;
  route?: string;
  target?: string;
}

export interface Tutorial {
  id: TutorialId;
  title: string;
  description: string;
  steps: TutorialStep[];
}

const step = (
  title: string,
  body: string,
  route?: string,
  target?: string,
): TutorialStep => ({ title, body, route, target });

function applicationSteps(role: UserRole): TutorialStep[] {
  const roleIntro: Record<UserRole, string> = {
    staff: 'This quick tour covers the tools you use to create and complete day-to-day work.',
    awf: 'This quick tour focuses on the AWF jobs and production information available to you.',
    manager: 'This quick tour includes planning work, assigning teams, and following shop progress.',
    admin: 'This quick tour includes daily work, team oversight, and account management.',
  };

  const steps: TutorialStep[] = [
    step('Welcome to GENR8 Pipeline', roleIntro[role]),
    step(
      'Your live jobs',
      'Jobs is your main work area. Use it to see what is waiting, in progress, or overdue.',
      '/',
      '[data-tour="nav-jobs"]',
    ),
    step(
      'Find the right work',
      'Filter by job type and sort by deadline or quantity when you need to decide what comes next.',
      '/',
      '[data-tour="job-filters"]',
    ),
    step(
      'Create a job',
      'Add a job when new work enters the shop. Include the customer, due date, and work details.',
      '/',
      '[data-tour="add-job"]',
    ),
    step(
      role === 'manager' || role === 'admin' ? 'Manage the work' : 'Work from each card',
      role === 'manager' || role === 'admin'
        ? 'Open a job card to edit details, choose its team, start work, or record progress.'
        : 'Each card shows the deadline, team, and progress. Use its actions when you start or finish your work.',
      '/',
      '[data-tour="job-board"] > *:first-child',
    ),
  ];

  if (role !== 'awf') {
    steps.push(
      step(
        'Watch materials',
        'Use Inventory before planning work to check stock and spot materials that are running low.',
        '/inventory',
        '[data-tour="inventory-page"] h1',
      ),
      step(
        'Keep machines ready',
        'Use Maintenance to follow checks and record service work so equipment stays ready.',
        '/maintenance',
        '[data-tour="maintenance-page"] h1',
      ),
    );
  }

  steps.push(
    step(
      'See the bigger picture',
      role === 'awf'
        ? 'Summary gives you a quick view of AWF work. Use it to check workload and finished output.'
        : 'Summary brings workload, completed jobs, overdue work, and stock warnings together.',
      '/summary',
      '[data-tour="summary-page"] h1',
    ),
    step(
      'Find completed work',
      'Completed jobs move to Archive. Use it when you need to confirm what was finished or when it shipped.',
      '/archive',
      '[data-tour="archive-page"] h1',
    ),
  );

  if (role === 'admin') {
    steps.push(
      step(
        'Manage access',
        'Use User management to approve, disable, restore, or remove accounts when team access changes.',
        '/settings/users',
        '[data-tour="user-management"] h1',
      ),
    );
  }

  steps.push(
    step(
      'Help is always visible',
      'Choose Help whenever you need an answer. You can restart this tour or open a shorter walkthrough at any time.',
      '/',
      '[data-tour="help-button"]',
    ),
  );

  return steps;
}

export function tutorialsForRole(role: UserRole): Tutorial[] {
  const tutorials: Tutorial[] = [
    {
      id: 'application',
      title: 'Application walkthrough',
      description: 'Tour the main areas available to you.',
      steps: applicationSteps(role),
    },
    {
      id: 'create-job',
      title: 'Create a job',
      description: 'Learn when and how to add new work.',
      steps: [
        step('Open Jobs', 'New work starts on the Jobs page.', '/', '[data-tour="nav-jobs"]'),
        step('Choose Add job', 'Use this when a confirmed piece of work needs to enter the pipeline.', '/', '[data-tour="add-job"]'),
        step('Add the details', 'Enter clear work details and a realistic due date so everyone knows what is needed.', '/', '[data-tour="add-job"]'),
      ],
    },
    {
      id: 'work-job',
      title: 'Start and complete work',
      description: 'Follow a job from waiting to finished.',
      steps: [
        step('Choose a job', 'Check the due date and team before starting. This helps avoid taking the wrong work.', '/', '[data-tour="job-board"] > *:first-child'),
        step('Start the work', 'Choose Start when production actually begins. The job will move to in progress.', '/', '[data-tour="job-card"]'),
        step('Record progress', 'Update the completed quantity during longer jobs so the team can see what remains.', '/', '[data-tour="job-card"]'),
        step('Complete the job', 'Choose Complete only when the work is finished. The job will move to Archive.', '/', '[data-tour="job-card"]'),
      ],
    },
    {
      id: 'reports',
      title: 'View reports',
      description: 'Read workload and progress at a glance.',
      steps: [
        step('Open Summary', 'Use Summary when you need a quick status update without opening every job.', '/summary', '[data-tour="nav-summary"]'),
        step('Read the overview', 'Compare waiting, active, completed, and overdue work to find areas that need attention.', '/summary', '[data-tour="summary-page"] h1'),
      ],
    },
    {
      id: 'manage-account',
      title: 'Manage your account',
      description: 'Find profile, security, and display settings.',
      steps: [
        step('Open your account menu', 'Your profile and settings live here.', '/', '[data-tour="account-menu"]'),
        step('Update your profile', 'Keep your contact and work information current so teammates know who you are.', '/settings/profile', '[data-tour="settings-page"] h1'),
      ],
    },
  ];

  if (role === 'manager' || role === 'admin') {
    tutorials.splice(2, 0,
      {
        id: 'edit-job',
        title: 'Edit job information',
        description: 'Correct details while keeping the team informed.',
        steps: [
          step('Find the job', 'Open the job that needs a correction or updated deadline.', '/', '[data-tour="job-board"] > *:first-child'),
          step('Choose Edit', 'Use Edit when requirements change. Add a reason when changing a deadline.', '/', '[data-tour="job-card"]'),
        ],
      },
      {
        id: 'assign-job',
        title: 'Assign a team',
        description: 'Put the right people on a job.',
        steps: [
          step('Choose the work', 'Check the job type and deadline before choosing collaborators.', '/', '[data-tour="job-board"] > *:first-child'),
          step('Open Team', 'Use Team to add or change collaborators. Assign people before work begins when possible.', '/', '[data-tour="job-card"]'),
        ],
      },
    );
  }

  if (role !== 'awf') {
    tutorials.push(
      {
        id: 'inventory',
        title: 'Manage inventory',
        description: 'Track materials and low-stock warnings.',
        steps: [
          step('Check stock', 'Visit Inventory before scheduling material-heavy work.', '/inventory', '[data-tour="inventory-page"] h1'),
          step('Add a material', 'Record a material when the shop starts keeping it in stock.', '/inventory', '[data-tour="add-material"]'),
        ],
      },
      {
        id: 'maintenance',
        title: 'Record maintenance',
        description: 'Keep machine checks and service history current.',
        steps: [
          step('Check machine readiness', 'Visit Maintenance before using equipment or planning service.', '/maintenance', '[data-tour="maintenance-page"] h1'),
          step('Add a machine', 'Add equipment that needs regular procedures or a shared service record.', '/maintenance', '[data-tour="add-machine"]'),
        ],
      },
    );
  }

  return tutorials;
}
