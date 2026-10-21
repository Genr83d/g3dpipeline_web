import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useHazardsOutlet } from '../routes/Workspace';
import { AssignUserModal } from '../components/AssignUserModal';
import { EmptyState } from '../components/EmptyState';
import { FloatingAddButton } from '../components/FloatingAddButton';
import { FormError } from '../components/FormError';
import { HazardForm, hazardSeverityTone } from '../components/HazardForm';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { Skeleton } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { DimRule, Led, signalText, type SignalTone } from '../components/Drafting';
import {
  IconAlert,
  IconCheck,
  IconCloudOff,
  IconEdit,
  IconMapPin,
  IconPlay,
  IconPlus,
  IconRestore,
  IconShield,
  IconTrash,
  IconUserPlus,
} from '../components/icons';
import { errorMessage, formatDate } from '../lib/format';
import {
  HAZARD_TEXT_MAX,
  canAssignHazard,
  canDeleteHazard,
  canEditHazard,
  canReopenHazard,
  canWorkHazard,
  compareHazards,
  hazardSeverityLabel,
  hazardStatusLabel,
  validateResolutionNote,
  type HazardInput,
} from '../lib/hazards';
import {
  assignHazard,
  deleteHazard,
  reopenHazard,
  reportHazard,
  resolveHazard,
  startHazard,
  updateHazardDetails,
  userDisplayName,
  type HazardActor,
} from '../services/hazardService';
import type { AppUser, Hazard, HazardStatus } from '../types';

const statusTone: Readonly<Record<HazardStatus, SignalTone>> = {
  open: 'danger',
  inProgress: 'amber',
  resolved: 'secondary',
};

const ticks: Readonly<Record<SignalTone, string>> = {
  danger: '[--tick:var(--color-danger)] dark:[--tick:var(--color-red-400)]',
  amber: '[--tick:var(--color-amber-500)] dark:[--tick:var(--color-amber-400)]',
  secondary: '[--tick:var(--color-secondary)] dark:[--tick:var(--color-emerald-400)]',
  primary: '',
  idle: '',
};

function stamped(name: string, at: Date | null): string {
  const who = name.trim() || 'Unknown';
  return at ? `${who} · ${formatDate(at)}` : who;
}

function HazardCard({
  hazard,
  viewer,
  busy,
  onEdit,
  onAssign,
  onStart,
  onResolve,
  onReopen,
  onDelete,
}: {
  hazard: Hazard;
  viewer: HazardActor;
  busy: boolean;
  onEdit: (hazard: Hazard) => void;
  onAssign: (hazard: Hazard) => void;
  onStart: (hazard: Hazard) => void;
  onResolve: (hazard: Hazard) => void;
  onReopen: (hazard: Hazard) => void;
  onDelete: (hazard: Hazard) => void;
}) {
  const severityTone = hazardSeverityTone[hazard.severity];
  const resolved = hazard.status === 'resolved';
  const canWork = canWorkHazard(hazard, viewer);
  const assignedToMe = hazard.assignedToUid !== '' && hazard.assignedToUid === viewer.uid;

  return (
    <article
      data-testid={`hazard-card-${hazard.id}`}
      aria-label={hazard.title}
      className={`surface surface-hover drafting-frame relative flex flex-col gap-3 p-4 ${
        ticks[resolved ? 'secondary' : severityTone]
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--rule)] pb-2.5">
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-sm border border-current/35 px-1.5 py-0.5 text-[0.7rem] font-bold ${signalText[severityTone]}`}
        >
          <IconAlert className="h-3.5 w-3.5" />
          {hazardSeverityLabel(hazard.severity)}
        </span>
        <span
          className={`inline-flex min-w-0 items-center gap-1.5 rounded-sm border border-current/25 bg-white/60 px-2 py-0.5 font-mono text-[0.68rem] font-semibold tracking-[0.08em] uppercase dark:bg-slate-950/40 ${signalText[statusTone[hazard.status]]}`}
        >
          <Led tone={statusTone[hazard.status]} live={hazard.status === 'inProgress'} />
          <span className="truncate">{hazardStatusLabel(hazard.status)}</span>
        </span>
      </div>

      <div className="min-w-0 space-y-1">
        <h3 className="font-display text-lg leading-6 font-bold tracking-tight break-words text-ink dark:text-slate-50">
          {hazard.title}
        </h3>
        {hazard.location && (
          <p className="inline-flex min-w-0 items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <IconMapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{hazard.location}</span>
          </p>
        )}
      </div>

      {hazard.description && (
        <p className="text-sm leading-6 break-words whitespace-pre-line text-slate-700 dark:text-slate-200">
          {hazard.description}
        </p>
      )}

      <dl className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <dt className="shrink-0">Reported by</dt>
          <dd className="min-w-0 truncate text-right font-semibold text-ink dark:text-slate-100">
            {stamped(hazard.reportedByName, hazard.createdAt)}
          </dd>
        </div>
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <dt className="shrink-0">Assigned to</dt>
          <dd
            className={`min-w-0 truncate text-right font-semibold ${
              hazard.assignedToUid || resolved
                ? 'text-ink dark:text-slate-100'
                : 'text-amber-700 dark:text-amber-300'
            }`}
          >
            {hazard.assignedToUid ? (assignedToMe ? 'You' : hazard.assignedToName) : 'Unassigned'}
          </dd>
        </div>
        {resolved && (
          <div className="flex min-w-0 items-baseline justify-between gap-3">
            <dt className="shrink-0">Resolved by</dt>
            <dd className="min-w-0 truncate text-right font-semibold text-secondary dark:text-emerald-300">
              {stamped(hazard.resolvedByName, hazard.resolvedAt)}
            </dd>
          </div>
        )}
      </dl>

      {resolved && hazard.resolutionNote && (
        <p
          data-testid={`hazard-resolution-${hazard.id}`}
          className="rounded border border-secondary/25 bg-secondary-soft/50 px-3 py-2 text-sm break-words whitespace-pre-line text-slate-700 dark:border-emerald-400/25 dark:bg-emerald-950/30 dark:text-slate-200"
        >
          {hazard.resolutionNote}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--rule)] pt-3">
        {canAssignHazard(hazard, viewer) && (
          <button className="btn-secondary" disabled={busy} onClick={() => onAssign(hazard)}>
            <IconUserPlus className="h-4 w-4" /> {hazard.assignedToUid ? 'Reassign' : 'Assign'}
          </button>
        )}
        {canWork && hazard.status === 'open' && (
          <button className="btn-secondary" disabled={busy} onClick={() => onStart(hazard)}>
            <IconPlay className="h-4 w-4" /> Start
          </button>
        )}
        {canWork && (
          <button className="btn-primary" disabled={busy} onClick={() => onResolve(hazard)}>
            <IconCheck className="h-4 w-4" /> Resolve
          </button>
        )}
        {canReopenHazard(hazard, viewer) && (
          <button className="btn-secondary" disabled={busy} onClick={() => onReopen(hazard)}>
            <IconRestore className="h-4 w-4" /> Reopen
          </button>
        )}
        {canEditHazard(hazard, viewer) && (
          <button
            className="btn-ghost px-2.5"
            disabled={busy}
            aria-label="Edit hazard report"
            title="Edit hazard report"
            onClick={() => onEdit(hazard)}
          >
            <IconEdit className="h-4 w-4" />
          </button>
        )}
        {canDeleteHazard(viewer) && (
          <button
            className="btn-danger px-2.5"
            disabled={busy}
            aria-label="Delete hazard report"
            title="Delete hazard report"
            onClick={() => onDelete(hazard)}
          >
            <IconTrash className="h-4 w-4" />
          </button>
        )}
      </div>
    </article>
  );
}

function AssignHazardModal({
  hazard,
  busy,
  onAssign,
  onClose,
}: {
  hazard: Hazard | null;
  busy: boolean;
  onAssign: (assignee: AppUser | null) => void;
  onClose: () => void;
}) {
  return (
    <AssignUserModal
      open={hazard !== null}
      title="Who will sort this out?"
      subtitle={hazard?.title ?? ''}
      assignedToUid={hazard?.assignedToUid ?? ''}
      assignedToName={hazard?.assignedToName ?? ''}
      busy={busy}
      onAssign={onAssign}
      onClose={onClose}
    />
  );
}

function ResolveHazardModal({
  hazard,
  busy,
  onResolve,
  onClose,
}: {
  hazard: Hazard | null;
  busy: boolean;
  onResolve: (note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setNote('');
    setError('');
  }, [hazard]);

  return (
    <Modal open={hazard !== null} title="Resolve hazard" onClose={onClose}>
      {hazard && (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const message = validateResolutionNote(note);
            if (message) return setError(message);
            onResolve(note.trim());
          }}
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">{hazard.title}</p>
          <div className="space-y-1.5">
            <label htmlFor="hazard-resolution" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              What was done to make it safe?
            </label>
            <textarea
              id="hazard-resolution"
              className="field min-h-24 resize-y"
              value={note}
              maxLength={HAZARD_TEXT_MAX}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'hazard-resolution-error' : undefined}
              placeholder="e.g. Cleaned the spill and fitted a drip tray"
              autoFocus
              onChange={(e) => {
                setNote(e.target.value);
                if (error) setError('');
              }}
            />
          </div>
          <FormError id="hazard-resolution-error" message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              <IconCheck className="h-4 w-4" /> Mark resolved
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

type Filter = 'active' | 'resolved';

export default function Hazards() {
  const { actor, profile } = useAuth();
  const { hazards, loading, error, retry } = useHazardsOutlet();
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>('active');
  const [reporting, setReporting] = useState(false);
  const [editing, setEditing] = useState<Hazard | null>(null);
  const [assigning, setAssigning] = useState<Hazard | null>(null);
  const [resolving, setResolving] = useState<Hazard | null>(null);
  const [deleting, setDeleting] = useState<Hazard | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = useMemo(() => [...hazards].sort(compareHazards), [hazards]);
  const active = sorted.filter((hazard) => hazard.status !== 'resolved');
  const resolved = sorted.filter((hazard) => hazard.status === 'resolved');
  const visible = filter === 'active' ? active : resolved;
  const open = active.filter((hazard) => hazard.status === 'open').length;
  const inProgress = active.length - open;
  const unassigned = active.filter((hazard) => !hazard.assignedToUid).length;

  if (!actor || !profile) return null;
  const viewer: HazardActor = { ...actor, role: profile.role };

  async function run(id: string, action: () => Promise<void>, success?: string): Promise<boolean> {
    setBusyId(id);
    try {
      await action();
      if (success) toast(success, 'success');
      return true;
    } catch (err) {
      toast(errorMessage(err), 'error');
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function handleReport(values: HazardInput) {
    const saved = await run('new', () => reportHazard(viewer, values), 'Hazard reported. Thank you.');
    if (saved) setReporting(false);
  }

  async function handleEdit(values: HazardInput) {
    if (!editing) return;
    const saved = await run(editing.id, () => updateHazardDetails(viewer, editing, values), 'Report updated.');
    if (saved) setEditing(null);
  }

  const reportButton = (
    <button className="btn-primary" onClick={() => setReporting(true)} data-tour="report-hazard">
      <IconPlus className="h-4 w-4" /> Report hazard
    </button>
  );

  const filterButton = (value: Filter, label: string, count: number) => (
    <button
      type="button"
      aria-pressed={filter === value}
      className={`rounded-sm px-3 py-1.5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
        filter === value
          ? 'bg-white/85 text-primary shadow-sm dark:bg-slate-800 dark:text-indigo-300'
          : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
      }`}
      onClick={() => setFilter(value)}
    >
      {label} ({count})
    </button>
  );

  return (
    <div className="space-y-6" data-tour="hazards-page">
      <PageHeader
        title="Hazards"
        eyebrow="Shop floor safety"
        subtitle="Spotted something unsafe? Report it so the right person can sort it out."
        actions={reportButton}
      />

      {loading ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </>
      ) : error ? (
        <EmptyState
          tone="danger"
          icon={<IconCloudOff className="h-7 w-7" />}
          title="Unable to Load Hazards"
          subtitle="Check your internet connection and Firestore permissions."
          action={
            <button className="btn-secondary" onClick={retry}>
              Retry
            </button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="surface px-4 py-3">
              <p className="technical-label">Open</p>
              <p className={`readout text-2xl font-bold ${open > 0 ? signalText.danger : ''}`} data-testid="hazards-open-count">
                {open}
              </p>
            </div>
            <div className="surface px-4 py-3">
              <p className="technical-label">In progress</p>
              <p className={`readout text-2xl font-bold ${inProgress > 0 ? signalText.amber : ''}`}>{inProgress}</p>
            </div>
            <div className="surface px-4 py-3">
              <p className="technical-label">Unassigned</p>
              <p className={`readout text-2xl font-bold ${unassigned > 0 ? signalText.amber : ''}`}>{unassigned}</p>
            </div>
          </div>

          <div
            role="group"
            aria-label="Show hazards"
            className="inline-flex gap-1 rounded border border-slate-200/70 bg-white/45 p-1 dark:border-slate-800/80 dark:bg-slate-900/55"
          >
            {filterButton('active', 'Active', active.length)}
            {filterButton('resolved', 'Resolved', resolved.length)}
          </div>

          <DimRule
            label={filter === 'active' ? 'Active hazards' : 'Resolved hazards'}
            value={visible.length}
          />

          {visible.length === 0 ? (
            filter === 'active' ? (
              <EmptyState
                icon={<IconShield className="h-7 w-7" />}
                title="No Open Hazards"
                subtitle="Nothing unsafe has been reported. If you spot something, report it."
                action={reportButton}
              />
            ) : (
              <EmptyState
                icon={<IconShield className="h-7 w-7" />}
                title="Nothing Resolved Yet"
                subtitle="Hazards appear here once they are made safe."
              />
            )
          ) : (
            <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {visible.map((hazard) => (
                <HazardCard
                  key={hazard.id}
                  hazard={hazard}
                  viewer={viewer}
                  busy={busyId === hazard.id}
                  onEdit={setEditing}
                  onAssign={setAssigning}
                  onStart={(h) => void run(h.id, () => startHazard(viewer, h), 'Marked in progress.')}
                  onResolve={setResolving}
                  onReopen={(h) => void run(h.id, () => reopenHazard(viewer, h), 'Hazard reopened.')}
                  onDelete={setDeleting}
                />
              ))}
            </div>
          )}
        </>
      )}

      <FloatingAddButton label="Report hazard" onClick={() => setReporting(true)}>
        <IconPlus className="h-4 w-4" /> Report hazard
      </FloatingAddButton>

      <Modal open={reporting} title="Report a hazard" onClose={() => setReporting(false)}>
        <HazardForm onSubmit={handleReport} onCancel={() => setReporting(false)} />
      </Modal>

      <Modal open={editing !== null} title="Edit hazard report" onClose={() => setEditing(null)}>
        {editing && <HazardForm initial={editing} onSubmit={handleEdit} onCancel={() => setEditing(null)} />}
      </Modal>

      <AssignHazardModal
        hazard={assigning}
        busy={assigning !== null && busyId === assigning.id}
        onClose={() => setAssigning(null)}
        onAssign={async (assignee) => {
          if (!assigning) return;
          const target = assigning;
          const saved = await run(
            target.id,
            () => assignHazard(viewer, target, assignee),
            assignee ? `Assigned to ${userDisplayName(assignee)}.` : 'Assignment cleared.',
          );
          if (saved) setAssigning(null);
        }}
      />

      <ResolveHazardModal
        hazard={resolving}
        busy={resolving !== null && busyId === resolving.id}
        onClose={() => setResolving(null)}
        onResolve={async (note) => {
          if (!resolving) return;
          const target = resolving;
          const saved = await run(target.id, () => resolveHazard(viewer, target, note), 'Hazard resolved.');
          if (saved) setResolving(null);
        }}
      />

      <Modal open={deleting !== null} title="Delete hazard report?" onClose={() => setDeleting(null)}>
        {deleting && (
          <div className="space-y-4">
            <p className="text-sm">
              Permanently delete <strong>{deleting.title}</strong> and its history? Resolve it instead if it has
              been made safe.
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button
                className="btn-danger"
                disabled={busyId === deleting.id}
                onClick={async () => {
                  const target = deleting;
                  const removed = await run(target.id, () => deleteHazard(viewer, target), 'Hazard report deleted.');
                  if (removed) setDeleting(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
