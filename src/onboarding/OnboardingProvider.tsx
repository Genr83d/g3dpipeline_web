import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { IconBack, IconCheck, IconClose } from '../components/icons';
import { placeTooltip, type Box, type Size } from './placement';
import { tutorialsForRole, type Tutorial, type TutorialId, type TutorialStep } from './tours';

interface SavedProgress {
  step: number;
  complete: boolean;
}

interface OnboardingValue {
  tutorials: Tutorial[];
  startTutorial: (id?: TutorialId) => void;
}

const OnboardingContext = createContext<OnboardingValue | null>(null);
const STORAGE_VERSION = 'v1';

/** How often the tour looks at the page while a step is open. The page
 *  changes under it (a form opens, a card loads), and polling a few
 *  selectors is cheaper and simpler than observing every mutation. */
const TOUR_POLL_MS = 150;

/** One of the app's own dialogs: Modal and the side panels. The tour tooltip
 *  is a dialog too, but not a modal one. */
const MODAL_DIALOG = '[role="dialog"][aria-modal="true"]';

function progressKey(uid: string, role: string, tutorialId: TutorialId): string {
  return `g3d-onboarding:${STORAGE_VERSION}:${uid}:${role}:${tutorialId}`;
}

function readProgress(key: string): SavedProgress | null {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as SavedProgress : null;
  } catch {
    return null;
  }
}

function writeProgress(key: string, progress: SavedProgress) {
  try {
    localStorage.setItem(key, JSON.stringify(progress));
  } catch {
    // A private browser may block storage. The tour still works for this session.
  }
}

function sameRoute(pathname: string, route: string): boolean {
  return route === '/' ? pathname === '/' : pathname.startsWith(route);
}

/** The first match that is actually on screen, since a selector can also
 *  match a copy hidden at this screen size. With nothing laid out at all (as
 *  in jsdom) the first match stands. */
function findVisible(selector: string): HTMLElement | null {
  const matches = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return matches.find((element) => element.getClientRects().length > 0) ?? matches[0] ?? null;
}

function sameBox(a: Box | null, b: Box | null): boolean {
  return (
    a === b ||
    (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height)
  );
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Where a closed form sends the tour back to: the step that asked for it to
 *  be opened. */
function openingStep(steps: TutorialStep[], from: number, selector: string): number {
  for (let index = from - 1; index >= 0; index -= 1) {
    if (steps[index].waitFor?.selector === selector) return index;
  }
  return Math.max(0, from - 1);
}

/** What the tour sees on the page for the open step. */
interface StepView {
  rect: Box | null;
  /** A dialog the step is not about is open, so the tour steps aside. */
  paused: boolean;
  /** A waitFor step whose element is already there, so Next is offered. */
  ready: boolean;
}

const EMPTY_VIEW: StepView = { rect: null, paused: false, ready: false };

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const tutorials = useMemo(
    () => tutorialsForRole(profile?.role ?? 'staff'),
    [profile?.role],
  );
  const [activeId, setActiveId] = useState<TutorialId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [view, setView] = useState<StepView>(EMPTY_VIEW);
  const autoChecked = useRef(false);
  const activeTutorial = tutorials.find((tutorial) => tutorial.id === activeId) ?? null;
  const activeStep = activeTutorial?.steps[stepIndex] ?? null;

  const save = useCallback((tutorialId: TutorialId, step: number, complete: boolean) => {
    if (!profile) return;
    writeProgress(progressKey(profile.uid, profile.role, tutorialId), { step, complete });
  }, [profile]);

  const startTutorial = useCallback((id: TutorialId = 'application') => {
    const tutorial = tutorials.find((item) => item.id === id);
    if (!tutorial) return;
    setActiveId(id);
    setStepIndex(0);
    save(id, 0, false);
  }, [save, tutorials]);

  useEffect(() => {
    if (!profile || autoChecked.current) return;
    autoChecked.current = true;
    const key = progressKey(profile.uid, profile.role, 'application');
    const progress = readProgress(key);
    if (progress?.complete) return;
    const application = tutorials.find((item) => item.id === 'application');
    const resumeAt = Math.min(progress?.step ?? 0, (application?.steps.length ?? 1) - 1);
    const timer = window.setTimeout(() => {
      setActiveId('application');
      setStepIndex(Math.max(0, resumeAt));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [profile, tutorials]);

  useEffect(() => {
    if (!activeStep?.route || sameRoute(location.pathname, activeStep.route)) return;
    navigate(activeStep.route);
  }, [activeStep, location.pathname, navigate]);

  const goTo = useCallback((index: number) => {
    if (!activeTutorial) return;
    if (index >= activeTutorial.steps.length) {
      save(activeTutorial.id, activeTutorial.steps.length - 1, true);
      setActiveId(null);
      return;
    }
    const step = Math.max(0, index);
    setStepIndex(step);
    save(activeTutorial.id, step, false);
  }, [activeTutorial, save]);

  // Watches the page for the open step: where its target is, whether the
  // user has done what it asked, and whether a form it explains has closed.
  useEffect(() => {
    if (!activeTutorial || !activeStep) {
      setView(EMPTY_VIEW);
      return;
    }
    const { target, waitFor, within } = activeStep;
    let scrolled = false;
    // Checked now, not at the first look, so a quick click on Add job still
    // counts as opening the form rather than finding it open.
    let waitedThing = !!waitFor && !findVisible(waitFor.selector);
    let missingFor = 0;
    let moved = false;

    const look = () => {
      if (moved) return;

      if (within) {
        // Two looks in a row, so a form mid-animation is not taken as closed.
        missingFor = findVisible(within.selector) ? 0 : missingFor + 1;
        if (missingFor >= 2) {
          moved = true;
          goTo(
            within.ifClosed === 'next'
              ? stepIndex + 1
              : openingStep(activeTutorial.steps, stepIndex, within.selector),
          );
          return;
        }
      }

      let ready = false;
      let waitedFor: HTMLElement | null = null;
      if (waitFor) {
        waitedFor = findVisible(waitFor.selector);
        const present = !!waitedFor;
        // Only an appearance moves the tour on. Arriving with the form
        // already open, say by going Back, offers Next instead.
        if (present && waitedThing) {
          moved = true;
          goTo(stepIndex + 1);
          return;
        }
        if (!present) waitedThing = true;
        ready = present;
      }

      const element = target ? findVisible(target) : null;
      if (element && !scrolled) {
        scrolled = true;
        // Instant, not smooth: the tooltip follows its target, and a tooltip
        // gliding with a smooth scroll moves its buttons out from under the
        // pointer.
        element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      }
      const modal = document.querySelector(MODAL_DIALOG);
      // Never paused by the dialog the step explains or asked to be opened.
      const paused =
        !!modal &&
        !(element && modal.contains(element)) &&
        !(waitedFor && modal.contains(waitedFor));
      const box = element?.getBoundingClientRect() ?? null;
      // A hidden element has no box to point at; the tooltip centres instead.
      const rect =
        box && box.width + box.height > 0
          ? { top: box.top, left: box.left, width: box.width, height: box.height }
          : null;

      setView((current) =>
        current.paused === paused && current.ready === ready && sameBox(current.rect, rect)
          ? current
          : { rect, paused, ready },
      );
    };

    setView(EMPTY_VIEW);
    const first = window.setTimeout(look, 80);
    const timer = window.setInterval(look, TOUR_POLL_MS);
    window.addEventListener('resize', look);
    window.addEventListener('scroll', look, true);
    return () => {
      moved = true;
      window.clearTimeout(first);
      window.clearInterval(timer);
      window.removeEventListener('resize', look);
      window.removeEventListener('scroll', look, true);
    };
  }, [activeStep, activeTutorial, goTo, location.pathname, stepIndex]);

  const exit = useCallback(() => {
    if (activeTutorial) save(activeTutorial.id, stepIndex, false);
    setActiveId(null);
  }, [activeTutorial, save, stepIndex]);

  const skip = useCallback(() => {
    if (activeTutorial) save(activeTutorial.id, activeTutorial.steps.length - 1, true);
    setActiveId(null);
  }, [activeTutorial, save]);

  // What the user must do before this step moves on, if anything.
  const waitingHint =
    activeStep?.waitFor && !view.ready
      ? activeStep.waitFor.hint
      : (activeStep?.within?.hint ?? null);
  const waiting = waitingHint !== null;

  const next = useCallback(() => {
    if (waiting) return;
    goTo(stepIndex + 1);
  }, [goTo, stepIndex, waiting]);

  const back = useCallback(() => {
    if (stepIndex === 0) return;
    goTo(stepIndex - 1);
  }, [goTo, stepIndex]);

  useEffect(() => {
    if (!activeTutorial) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // While a dialog is open its keys are its own: Escape closes it, and
      // arrows move through its fields rather than the tour.
      if (event.defaultPrevented || document.querySelector(MODAL_DIALOG)) return;
      if (event.key === 'Escape') exit();
      if (isTyping(event.target)) return;
      if (event.key === 'ArrowLeft') back();
      if (event.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTutorial, back, exit, next]);

  const value = useMemo(() => ({ tutorials, startTutorial }), [startTutorial, tutorials]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {activeTutorial && activeStep && (
        view.paused ? (
          <PausedTour tutorial={activeTutorial} onExit={exit} />
        ) : (
          <Walkthrough
            tutorial={activeTutorial}
            stepIndex={stepIndex}
            targetRect={view.rect}
            waitingHint={waitingHint}
            onBack={back}
            onNext={next}
            onExit={exit}
            onSkip={skip}
          />
        )
      )}
    </OnboardingContext.Provider>
  );
}

/** Shown in place of the tour while a dialog the step is not about is open,
 *  so the dialog can be used without the tour's shade over it. */
function PausedTour({ tutorial, onExit }: { tutorial: Tutorial; onExit: () => void }) {
  return (
    <section
      role="status"
      data-dialog-companion
      data-testid="onboarding-paused"
      className="surface-strong fixed bottom-3 left-3 z-[61] flex max-w-[calc(100vw-24px)] items-center gap-3 px-3 py-2 shadow-xl"
    >
      <p className="text-xs text-slate-600 dark:text-slate-300">
        <span className="font-semibold">{tutorial.title}</span> is paused while this window is
        open.
      </p>
      <button
        type="button"
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        onClick={onExit}
        aria-label="Exit tutorial"
        title="Exit tutorial"
      >
        <IconClose className="h-4 w-4" />
      </button>
    </section>
  );
}

function Walkthrough({
  tutorial,
  stepIndex,
  targetRect,
  waitingHint,
  onBack,
  onNext,
  onExit,
  onSkip,
}: {
  tutorial: Tutorial;
  stepIndex: number;
  targetRect: Box | null;
  /** Set while the step waits for the user to do something. */
  waitingHint: string | null;
  onBack: () => void;
  onNext: () => void;
  onExit: () => void;
  onSkip: () => void;
}) {
  const current = tutorial.steps[stepIndex];
  const last = stepIndex === tutorial.steps.length - 1;
  const tooltipRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState<Size>({ width: 360, height: 260 });

  useLayoutEffect(() => {
    const element = tooltipRef.current;
    if (!element) return;
    const measured = { width: element.offsetWidth, height: element.offsetHeight };
    if (measured.width !== size.width || measured.height !== size.height) setSize(measured);
  });

  const position = placeTooltip(targetRect, size, {
    width: window.innerWidth,
    height: window.innerHeight,
  });

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-live="polite">
      {targetRect ? (
        <div
          className="fixed rounded-xl ring-4 ring-primary/70 ring-offset-4 ring-offset-white/80 transition-all dark:ring-indigo-300 dark:ring-offset-slate-950/80"
          style={{
            top: targetRect.top - 5,
            left: targetRect.left - 5,
            width: targetRect.width + 10,
            height: targetRect.height + 10,
            boxShadow: '0 0 0 9999px rgba(7, 15, 30, 0.48)',
          }}
          aria-hidden
          data-testid="onboarding-highlight"
        />
      ) : (
        <div className="fixed inset-0 bg-slate-950/50" aria-hidden />
      )}

      <section
        ref={tooltipRef}
        role="dialog"
        aria-label={`${tutorial.title}: ${current.title}`}
        // Reachable by Tab even while an open dialog holds focus.
        data-dialog-companion
        className="surface-strong pointer-events-auto fixed z-[61] w-[min(360px,calc(100vw-24px))] p-4 shadow-2xl"
        style={position}
        data-testid="onboarding-tooltip"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="technical-label text-primary dark:text-indigo-300">{tutorial.title}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Step {stepIndex + 1} of {tutorial.steps.length}
            </p>
          </div>
          <button type="button" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onExit} aria-label="Exit tutorial" title="Exit tutorial">
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuemin={1} aria-valuemax={tutorial.steps.length} aria-valuenow={stepIndex + 1}>
          <div className="h-full rounded-full bg-primary transition-[width] dark:bg-indigo-400" style={{ width: `${((stepIndex + 1) / tutorial.steps.length) * 100}%` }} />
        </div>

        <h2 className="font-display text-lg font-bold text-ink dark:text-slate-50">{current.title}</h2>
        <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">{current.body}</p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={onSkip}>Skip tutorial</button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={onBack}>
                <IconBack className="h-3.5 w-3.5" /> Back
              </button>
            )}
            {waitingHint ? (
              <p
                className="rounded-md bg-primary-soft px-3 py-2 text-xs font-semibold text-primary dark:bg-primary/20 dark:text-indigo-200"
                data-testid="onboarding-waiting"
              >
                {waitingHint}
              </p>
            ) : (
              <button type="button" className="btn-primary px-3 py-2 text-xs" onClick={onNext}>
                {last ? <><IconCheck className="h-3.5 w-3.5" /> Finish</> : 'Next'}
              </button>
            )}
          </div>
        </div>
        {targetRect && !waitingHint && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">You can use the highlighted control while this guide is open.</p>}
      </section>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOnboarding(): OnboardingValue {
  const value = useContext(OnboardingContext);
  if (!value) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return value;
}
