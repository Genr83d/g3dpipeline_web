import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { IconBack, IconCheck, IconClose } from '../components/icons';
import { tutorialsForRole, type Tutorial, type TutorialId } from './tours';

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
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
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

  useEffect(() => {
    if (!activeStep?.target) {
      setTargetRect(null);
      return;
    }

    let element: HTMLElement | null = null;
    let frame = 0;
    let attempts = 0;
    let observer: ResizeObserver | null = null;

    const update = () => {
      if (element?.isConnected) setTargetRect(element.getBoundingClientRect());
    };
    const find = () => {
      element = document.querySelector<HTMLElement>(activeStep.target!);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        update();
        observer = new ResizeObserver(update);
        observer.observe(element);
      } else if (attempts++ < 20) {
        frame = window.setTimeout(find, 100);
      } else {
        setTargetRect(null);
      }
    };

    setTargetRect(null);
    frame = window.setTimeout(find, 80);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearTimeout(frame);
      observer?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [activeStep, location.pathname]);

  const exit = useCallback(() => {
    if (activeTutorial) save(activeTutorial.id, stepIndex, false);
    setActiveId(null);
  }, [activeTutorial, save, stepIndex]);

  const skip = useCallback(() => {
    if (activeTutorial) save(activeTutorial.id, activeTutorial.steps.length - 1, true);
    setActiveId(null);
  }, [activeTutorial, save]);

  const next = useCallback(() => {
    if (!activeTutorial) return;
    if (stepIndex >= activeTutorial.steps.length - 1) {
      save(activeTutorial.id, stepIndex, true);
      setActiveId(null);
      return;
    }
    const nextStep = stepIndex + 1;
    setStepIndex(nextStep);
    save(activeTutorial.id, nextStep, false);
  }, [activeTutorial, save, stepIndex]);

  const back = useCallback(() => {
    if (!activeTutorial || stepIndex === 0) return;
    const previousStep = stepIndex - 1;
    setStepIndex(previousStep);
    save(activeTutorial.id, previousStep, false);
  }, [activeTutorial, save, stepIndex]);

  useEffect(() => {
    if (!activeTutorial) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') exit();
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
        <Walkthrough
          tutorial={activeTutorial}
          stepIndex={stepIndex}
          targetRect={targetRect}
          onBack={back}
          onNext={next}
          onExit={exit}
          onSkip={skip}
        />
      )}
    </OnboardingContext.Provider>
  );
}

function Walkthrough({
  tutorial,
  stepIndex,
  targetRect,
  onBack,
  onNext,
  onExit,
  onSkip,
}: {
  tutorial: Tutorial;
  stepIndex: number;
  targetRect: DOMRect | null;
  onBack: () => void;
  onNext: () => void;
  onExit: () => void;
  onSkip: () => void;
}) {
  const current = tutorial.steps[stepIndex];
  const last = stepIndex === tutorial.steps.length - 1;
  const panelHeight = 320;
  const tooltipStyle: CSSProperties = targetRect
    ? {
        top: targetRect.bottom + 14 + panelHeight <= window.innerHeight
          ? targetRect.bottom + 14
          : Math.max(12, targetRect.top - panelHeight - 14),
        left: Math.min(
          Math.max(16, targetRect.left + targetRect.width / 2 - 180),
          Math.max(16, window.innerWidth - 376),
        ),
      }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className="pointer-events-none fixed inset-0 z-40" aria-live="polite">
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
        />
      ) : (
        <div className="fixed inset-0 bg-slate-950/50" aria-hidden />
      )}

      <section
        role="dialog"
        aria-label={`${tutorial.title}: ${current.title}`}
        className="surface-strong pointer-events-auto fixed z-50 w-[min(360px,calc(100vw-24px))] p-4 shadow-2xl max-sm:inset-x-3 max-sm:top-auto! max-sm:bottom-3! max-sm:translate-none!"
        style={tooltipStyle}
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
            <button type="button" className="btn-primary px-3 py-2 text-xs" onClick={onNext}>
              {last ? <><IconCheck className="h-3.5 w-3.5" /> Finish</> : 'Next'}
            </button>
          </div>
        </div>
        {targetRect && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">You can use the highlighted control while this guide is open.</p>}
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
