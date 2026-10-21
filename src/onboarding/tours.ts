import type { UserRole } from '../types';

export type TutorialId =
  | 'application'
  | 'create-job'
  | 'work-job'
  | 'edit-job'
  | 'assign-job'
  | 'inventory'
  | 'maintenance'
  | 'hazards'
  | 'reports'
  | 'operations-report'
  | 'manage-account';

export interface TutorialStep {
  title: string;
  body: string;
  route?: string;
  target?: string;
  /** The step asks the user to do something, such as open a form, and moves
   *  on by itself once `selector` appears. Until then `hint` stands in for
   *  the Next button. */
  waitFor?: { selector: string; hint: string };
  /** The step explains something inside `selector`, such as a form. If that
   *  closes, the tour goes `back` to the step that opened it, or on to the
   *  `next` step (used once the form has done its job). With a `hint`, the
   *  step waits for that instead of offering Next. */
  within?: { selector: string; ifClosed: 'back' | 'next'; hint?: string };
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
  extra: Pick<TutorialStep, 'waitFor' | 'within'> = {},
): TutorialStep => ({ title, body, route, target, ...extra });

const isManagement = (role: UserRole) => role === 'manager' || role === 'admin';

/** The Add job form. Its parts are scoped to it, so the Edit panel, which
 *  reuses the same form, is never mistaken for it. */
const JOB_FORM = '[data-tour="job-form"]';
const inJobForm = (part: string) => `${JOB_FORM} [data-tour="${part}"]`;

function applicationSteps(role: UserRole): TutorialStep[] {
  const roleIntro: Record<UserRole, string> = {
    staff: 'This quick tour covers the tools you use to create and complete day-to-day work.',
    awf: 'This quick tour focuses on the AWF jobs and production information available to you.',
    manager: 'This quick tour includes planning work, assigning teams, and following shop progress.',
    admin: 'This quick tour includes daily work, team oversight, and account management.',
  };

  // The tour reads top to bottom the way the app is used: where the work
  // lives, how to read one job, how to find the right one, how to add work,
  // then how to act on it.
  const steps: TutorialStep[] = [
    step('Welcome to GENR8 Pipeline', roleIntro[role]),
    step(
      'Your live jobs',
      'Jobs is your main work area. Use it to see what is waiting, in progress, or overdue.',
      '/',
      '[data-tour="nav-jobs"]',
    ),
    step(
      'Every job has an order number',
      'Each card starts with its job order number, such as G3D-ABC123XY. Quote it when you discuss a job with the team: it never changes and reads the same on every device.',
      '/',
      '[data-tour="job-board"] > *:first-child',
    ),
    step(
      'Find the right work',
      'Filter by job type and sort by deadline or quantity when you need to decide what comes next.',
      '/',
      '[data-tour="job-filters"]',
    ),
    step(
      'Create a job',
      'Add job opens the form for new work. The Create a job guide in Help walks through it field by field.',
      '/',
      '[data-tour="add-job"]',
    ),
    step(
      isManagement(role) ? 'Manage the work' : 'Work from each card',
      isManagement(role)
        ? 'Open a job card to edit details, choose its team, start work, or record progress. Every job is split into sections, such as Design or Welding, and each tracks its own percentage.'
        : 'Each card shows the deadline, team, and progress. Use its actions when you start work, record progress, or finish. Every job is split into sections that each track their own percentage.',
      '/',
      '[data-tour="job-card"]',
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
        'Use Maintenance to tick off checks, log who did the work, and report a machine that is down.',
        '/maintenance',
        '[data-tour="maintenance-page"] h1',
      ),
    );
  }

  steps.push(
    step(
      'Report hazards',
      'Spotted something unsafe on the floor? Report it on Hazards so the right person can sort it out. Urgent ones show a count on the tab.',
      '/hazards',
      '[data-tour="hazards-page"] h1',
    ),
    step(
      'See the bigger picture',
      role === 'awf'
        ? 'Summary gives you a quick view of AWF work. Use it to check workload, the closest deadlines, and finished output.'
        : 'Summary brings workload, completed jobs, the most urgent deadlines, and stock warnings together.',
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

  if (isManagement(role)) {
    steps.push(
      step(
        'Download reports',
        'Reports, in your account menu, turns any month, quarter, year, or date range into a PDF covering jobs, stock, maintenance, and hazards.',
        '/reports',
        '[data-tour="reports-page"] h1',
      ),
    );
  }

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

/** Follows the user through the real Add job form: it waits for them to open
 *  it, points at each part while they fill it in, and moves on when they save
 *  or cancel. */
function createJobSteps(role: UserRole): TutorialStep[] {
  return [
    step('Open Jobs', 'New work starts on the Jobs page.', '/', '[data-tour="nav-jobs"]'),
    step(
      'Choose Add job',
      'Use this when a confirmed piece of work needs to enter the pipeline. Click Add job now and this guide follows you into the form.',
      '/',
      '[data-tour="add-job"]',
      { waitFor: { selector: JOB_FORM, hint: 'Click Add job to continue' } },
    ),
    step(
      'Describe the job',
      'Give the job a clear name, who it is for, its type, and a realistic deadline. Types that count units, such as Manufacturing, also ask how many.',
      '/',
      inJobForm('job-form-basics'),
      { within: { selector: JOB_FORM, ifClosed: 'back' } },
    ),
    step(
      'Split it into sections',
      'Enter one section per line, such as Design, Routing, or Metalworking. Repair jobs call them processes, such as Cleaning or Welding. Each one tracks its own percentage and can be given an owner later.',
      '/',
      inJobForm('job-form-sections'),
      { within: { selector: JOB_FORM, ifClosed: 'back' } },
    ),
    step(
      'Tag what it uses',
      isManagement(role)
        ? 'Tick a tag when the job uses stock: a Pins job deducts Pin Backs and Lamina from Inventory when it is completed. Tick AWF job to put it in the AWF Staff pipeline.'
        : 'Tick a tag when the job uses stock: a Pins job deducts Pin Backs and Lamina from Inventory when it is completed.',
      '/',
      inJobForm('job-form-tags'),
      { within: { selector: JOB_FORM, ifClosed: 'back' } },
    ),
    step(
      'Save the job',
      'Choose Add job to save it. It gets a permanent order number, such as G3D-ABC123XY, to quote whenever the job comes up. Cancel if you are only practising.',
      '/',
      inJobForm('job-form-actions'),
      {
        within: {
          selector: JOB_FORM,
          ifClosed: 'next',
          hint: 'Save or cancel to continue',
        },
      },
    ),
    step(
      'Find it on the board',
      'A saved job joins the board as waiting, with its order number on the card. The Start and complete work guide picks up from here.',
      '/',
      '[data-tour="job-board"]',
    ),
  ];
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
      description: 'Add new work, following along in the real form.',
      steps: createJobSteps(role),
    },
    {
      id: 'work-job',
      title: 'Start and complete work',
      description: 'Follow a job from waiting to finished.',
      steps: [
        step('Choose a job', 'Check the order number, due date, and team before starting. This helps avoid taking the wrong work.', '/', '[data-tour="job-board"] > *:first-child'),
        step('Start the work', 'Choose Start when production actually begins. The job moves to in progress. If the job has a team, only its collaborators can start it.', '/', '[data-tour="job-card"]'),
        step('Record progress', 'Use Update job progress to record finished units, and Update section progress to move each section’s percentage. The overall figure is their average.', '/', '[data-tour="job-card"]'),
        step('Complete the job', 'Complete unlocks once every unit and section is finished, and the job moves to Archive. Finished work left open is completed automatically once the day ends.', '/', '[data-tour="job-card"]'),
      ],
    },
    {
      id: 'hazards',
      title: 'Report a hazard',
      description: 'Flag something unsafe so it gets sorted out.',
      steps: [
        step('Open Hazards', 'Hazards lists everything unsafe that has been reported, with the most severe first.', '/hazards', '[data-tour="nav-hazards"]'),
        step('Report it', 'Choose Report hazard, describe what you saw and where, and pick how severe it is. High and critical reports show as urgent on the tab.', '/hazards', '[data-tour="report-hazard"]'),
        step(
          'Follow it up',
          isManagement(role)
            ? 'Assign each report to the person who will sort it out. They, or any manager, resolve it with a note of what was done.'
            : 'A manager assigns each report to someone. If it is assigned to you, resolve it with a note of what was done.',
          '/hazards',
          '[data-tour="hazards-page"] h1',
        ),
      ],
    },
    {
      id: 'reports',
      title: 'Read the Summary',
      description: 'See workload and progress at a glance.',
      steps: [
        step('Open Summary', 'Use Summary when you need a quick status update without opening every job.', '/summary', '[data-tour="nav-summary"]'),
        step('Read the overview', 'Compare waiting, active, completed, and overdue work to find areas that need attention.', '/summary', '[data-tour="summary-page"] h1'),
        step('Act on urgent jobs', 'The urgent list shows the closest deadlines with their order numbers, so you can raise the right job with the team.', '/summary', '[data-tour="urgent-jobs"]'),
      ],
    },
    {
      id: 'manage-account',
      title: 'Manage your account',
      description: 'Find profile, security, and display settings.',
      steps: [
        step('Open your account menu', 'Your profile and settings live here.', '/', '[data-tour="account-menu"]'),
        step('Check your profile', 'Profile shows your role, account status, and details as the team sees them.', '/settings/profile', '[data-tour="settings-page"] h1'),
        step('Personal information', 'Keep your name, phone number, job title, and department current so teammates know who you are.', '/settings/personal', '[data-tour="settings-page"] h1'),
        step('Make it comfortable', 'Appearance sets light, dark, or system theme and text size, and can raise contrast or reduce motion.', '/settings/appearance', '[data-tour="settings-page"] h1'),
      ],
    },
  ];

  if (isManagement(role)) {
    tutorials.splice(2, 0,
      {
        id: 'edit-job',
        title: 'Edit job information',
        description: 'Correct details while keeping the team informed.',
        steps: [
          step('Find the job', 'Open the job that needs a correction or updated deadline.', '/', '[data-tour="job-board"] > *:first-child'),
          step('Open the job panel', 'Edit opens one panel for the whole job: Details, Units, Sections and Team, each in its own tab. Add a reason when changing a deadline; the job order number stays the same.', '/', '[data-tour="job-card"]'),
          step('Keep sections current', 'Add or remove sections on the Details tab. Every section you keep holds the percentage it already had, and the panel warns before a change would clear one.', '/', '[data-tour="job-card"]'),
        ],
      },
      {
        id: 'assign-job',
        title: 'Assign a team',
        description: 'Put the right people on a job.',
        steps: [
          step('Choose the work', 'Check the job type and deadline before choosing collaborators.', '/', '[data-tour="job-board"] > *:first-child'),
          step('Open Team', 'Team opens the job panel on its Team tab, where you add collaborators and give each section an owner. Assign people before work begins when possible.', '/', '[data-tour="job-card"]'),
        ],
      },
    );
    tutorials.push({
      id: 'operations-report',
      title: 'Download a report',
      description: 'Turn a month, quarter, or year into a PDF.',
      steps: [
        step('Open Reports', 'Reports lives in your account menu.', '/', '[data-tour="account-menu"]'),
        step('Choose the period', 'Pick a month, quarter, year, or your own date range. The preview below updates to match.', '/reports', '[data-tour="report-period"]'),
        step('Download the PDF', 'The report covers jobs, team output, stock, maintenance, downtime, and hazards for that period, ready to share.', '/reports', '[data-tour="report-download"]'),
      ],
    });
  }

  if (role !== 'awf') {
    tutorials.push(
      {
        id: 'inventory',
        title: 'Manage inventory',
        description: 'Track materials and low-stock warnings.',
        steps: [
          step('Check stock', 'Visit Inventory before scheduling material-heavy work. A material is flagged low once it falls under 30% of its full stock.', '/inventory', '[data-tour="inventory-page"] h1'),
          step('Add a material', 'Record a material when the shop starts keeping it in stock, with its current stock and what a full stock is.', '/inventory', '[data-tour="add-material"]'),
          step('Stock follows the jobs', 'Completing a tagged job, such as Pins, deducts its materials here, and restoring the job from Archive puts them back.', '/inventory', '[data-tour="inventory-page"] h1'),
        ],
      },
      {
        id: 'maintenance',
        title: 'Record maintenance',
        description: 'Keep machine checks and service history current.',
        steps: [
          step('Check machine readiness', 'Visit Maintenance before using equipment. Machines that are down are listed first.', '/maintenance', '[data-tour="maintenance-page"] h1'),
          step('Tick off the checks', 'Each machine card has its own checklist. Tick each procedure as it is done.', '/maintenance', '[data-tour="machine-card"]'),
          step('Log the maintenance', 'Log Checked Maintenance records the ticked procedures and asks who did the work, which need not be you. History on the card opens the full service record.', '/maintenance', '[data-tour="machine-card"]'),
          step('Report a machine down', 'Report down when a machine stops working, saying what is wrong. A manager assigns the repair, and Mark repaired puts it back in service.', '/maintenance', '[data-tour="machine-card"]'),
          step('Add a machine', 'Add equipment that needs regular procedures or a shared service record.', '/maintenance', '[data-tour="add-machine"]'),
        ],
      },
    );
  }

  return tutorials;
}
