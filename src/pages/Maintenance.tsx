import { useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useMachinesOutlet } from '../routes/Workspace';
import { MachineForm } from '../components/MachineForm';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/PageHeader';
import { FloatingAddButton } from '../components/FloatingAddButton';
import { MachineCardSkeleton, Skeleton } from '../components/Skeleton';
import { DimRule, Led } from '../components/Drafting';
import { AssignUserModal, useActiveUsers } from '../components/AssignUserModal';
import { MachineDownPill, MarkRepairedModal, ReportDownModal } from '../components/MachineStatus';
import {
  InlineSpinner,
  MachinePanel,
  ProcedureAddForm,
  sinceLabel,
  type MachinePanelState,
  type MachinePanelTab,
} from '../components/MachinePanel';
import {
  IconCheck,
  IconClose,
  IconAlert,
  IconCloudOff,
  IconEdit,
  IconHistory,
  IconMapPin,
  IconNote,
  IconPlus,
  IconUserPlus,
  IconSearch,
  IconTrash,
  IconWrench,
} from '../components/icons';
import { errorMessage, formatDate } from '../lib/format';
import {
  canAssignMachineRepair,
  canMarkMachineRepaired,
  canReportMachineDown,
  compareMachines,
  hasRepairAssignee,
  isMachineDown,
  isRepairAssignedTo,
  type MachineViewer,
} from '../lib/machineStatus';
import {
  addMachine,
  addProcedure,
  assignMachineRepair,
  deleteMachine,
  editMachine,
  filterMachines,
  logCheckedMaintenance,
  markMachineRepaired,
  removeProcedure,
  reportMachineDown,
  setProcedureDone,
  type MachineInput,
} from '../services/machineService';
import { actorDisplayName, userDisplayName } from '../lib/userName';
import { maintenanceAttribution, type MaintenanceWorker } from '../lib/maintenanceLog';
import type { AppUser, Machine, MaintenanceProcedure } from '../types';

/** The "Who did the maintenance?" choice for someone outside the team. Account
 *  uids never contain a colon. */
const SOMEONE_ELSE = ':someone-else';

function checkedProcedures(machine: Machine): MaintenanceProcedure[] {
  return machine.procedures.filter((procedure) => procedure.isDone);
}

function lastMaintained(machine: Machine): Date | null {
  return machine.maintenanceHistory[0]?.completedAt ?? null;
}

function IconButton({
  label,
  title,
  children,
  onClick,
  disabled = false,
  danger = false,
}: {
  label: string;
  title: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      disabled={disabled}
      className={`rounded border p-2 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? 'border-danger/15 bg-danger-soft/45 text-danger hover:bg-danger-soft dark:border-red-400/15 dark:bg-danger/10 dark:text-red-300 dark:hover:bg-danger/20'
          : 'border-slate-200/70 bg-white/45 text-slate-500 hover:bg-white/80 hover:text-slate-800 dark:border-slate-800/80 dark:bg-slate-950/20 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MachineCard({
  machine,
  busyKey,
  isAdmin,
  viewer,
  onEdit,
  onDelete,
  onAddProcedure,
  onToggleProcedure,
  onLog,
  onOpenPanel,
  onReportDown,
  onAssignRepair,
  onMarkRepaired,
}: {
  machine: Machine;
  busyKey: string | null;
  isAdmin: boolean;
  viewer: MachineViewer;
  onEdit: (machine: Machine) => void;
  onDelete: (machine: Machine) => void;
  onAddProcedure: (machine: Machine, title: string) => Promise<boolean>;
  onToggleProcedure: (machine: Machine, procedure: MaintenanceProcedure, isDone: boolean) => void;
  onLog: (machine: Machine) => void;
  onOpenPanel: (machine: Machine, tab: MachinePanelTab) => void;
  onReportDown: (machine: Machine) => void;
  onAssignRepair: (machine: Machine) => void;
  onMarkRepaired: (machine: Machine) => void;
}) {
  const down = isMachineDown(machine);
  const assignedToMe = isRepairAssignedTo(machine, viewer.uid);
  const statusBusy = busyKey === `machine-status:${machine.id}`;
  const checked = checkedProcedures(machine);
  const logBusy = busyKey === `maintenance-log:${machine.id}`;
  const maintainedAt = lastMaintained(machine);
  const [latest] = machine.maintenanceHistory;
  const historyCount = machine.maintenanceHistory.length;

  return (
    <article
      data-tour="machine-card"
      className={`surface surface-hover drafting-frame relative flex flex-col gap-4 p-4 ${
        down
          ? '[--tick:var(--color-danger)] dark:[--tick:var(--color-red-400)]'
          : checked.length > 0
            ? '[--tick:var(--color-secondary)] dark:[--tick:var(--color-emerald-400)]'
            : ''
      }`}
    >
      {/* Title block */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h2 className="line-clamp-2 font-display text-xl leading-7 font-bold tracking-tight text-ink dark:text-slate-50">
            {machine.name}
          </h2>
          <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <IconMapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{machine.location}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Led tone={maintainedAt ? 'secondary' : 'idle'} />
              <span className="readout">
                {maintainedAt ? (
                  <>
                    Last maintained: {formatDate(maintainedAt)}
                    <span className="text-slate-400 dark:text-slate-500"> · {sinceLabel(maintainedAt)}</span>
                  </>
                ) : (
                  'Not maintained yet'
                )}
              </span>
            </span>
          </p>
          {down && (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <MachineDownPill machine={machine} />
              {assignedToMe && (
                <span className="inline-flex items-center gap-1 rounded-sm border border-current/35 px-1.5 py-0.5 text-[0.7rem] font-bold text-amber-700 dark:text-amber-300">
                  <IconWrench className="h-3.5 w-3.5" />
                  Assigned to you
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* A working machine stays compact: reporting it down is an icon. */}
          {!down && canReportMachineDown(viewer) && (
            <IconButton
              label="Report down"
              title="Report machine down"
              disabled={statusBusy}
              onClick={() => onReportDown(machine)}
            >
              <IconAlert className="h-4 w-4" />
            </IconButton>
          )}
          <IconButton label="Edit machine" title="Edit machine" onClick={() => onEdit(machine)}>
            <IconEdit className="h-4 w-4" />
          </IconButton>
          {isAdmin && (
            <IconButton
              label="Delete machine"
              title="Delete machine"
              danger
              onClick={() => onDelete(machine)}
            >
              <IconTrash className="h-4 w-4" />
            </IconButton>
          )}
        </div>
      </div>

      {down && (
        <dl className="-mt-1" data-testid="machine-down-details">
          {machine.downSince && (
            <div className="flex items-baseline gap-2 py-1 text-sm">
              <dt className="shrink-0 text-slate-500 dark:text-slate-400">Down since</dt>
              <dd className="readout min-w-0 text-danger dark:text-red-300">{formatDate(machine.downSince)}</dd>
            </div>
          )}
          {machine.downReason && (
            <div className="flex items-baseline gap-2 py-1 text-sm">
              <dt className="shrink-0 text-slate-500 dark:text-slate-400">Fault</dt>
              <dd className="min-w-0 font-semibold break-words text-slate-700 dark:text-slate-200">
                {machine.downReason}
              </dd>
            </div>
          )}
          {hasRepairAssignee(machine) && (
            <div className="flex items-baseline gap-2 py-1 text-sm">
              <dt className="shrink-0 text-slate-500 dark:text-slate-400">Repair by</dt>
              <dd className="min-w-0 font-semibold text-slate-700 dark:text-slate-200">
                {machine.repairAssignedToName}
              </dd>
            </div>
          )}
        </dl>
      )}

      {down && (canAssignMachineRepair(viewer) || canMarkMachineRepaired(viewer)) && (
        <div className="flex flex-wrap gap-2">
          {canAssignMachineRepair(viewer) && (
            <button
              type="button"
              className="btn-ghost py-2"
              disabled={statusBusy}
              onClick={() => onAssignRepair(machine)}
            >
              <IconUserPlus className="h-4 w-4" />{' '}
              {hasRepairAssignee(machine) ? 'Reassign repair' : 'Assign repair'}
            </button>
          )}
          {canMarkMachineRepaired(viewer) && (
            <button
              type="button"
              className="btn-secondary py-2"
              disabled={statusBusy}
              onClick={() => onMarkRepaired(machine)}
            >
              {statusBusy ? <InlineSpinner /> : <IconCheck className="h-4 w-4" />} Mark repaired
            </button>
          )}
        </div>
      )}

      {machine.notes && (
        <button
          type="button"
          className="-mt-1 line-clamp-2 rounded text-left text-sm text-slate-600 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none dark:text-slate-300 dark:hover:text-slate-100"
          title="Show full notes"
          onClick={() => onOpenPanel(machine, 'details')}
        >
          {machine.notes}
        </button>
      )}

      <section className="space-y-2.5">
        <DimRule
          label={<h3 className="m-0">Procedures</h3>}
          value={
            <span
              className={checked.length > 0 ? 'text-secondary dark:text-emerald-300' : undefined}
            >
              {checked.length} ready
            </span>
          }
        />

        {machine.procedures.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No procedures yet.</p>
        ) : (
          <ul className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
            {machine.procedures.map((procedure) => {
              const toggleBusy = busyKey === `procedure-toggle:${machine.id}:${procedure.id}`;
              const removeBusy = busyKey === `procedure-remove:${machine.id}:${procedure.id}`;
              return (
                <li key={procedure.id} className="min-w-0">
                  <label
                    htmlFor={`${machine.id}-${procedure.id}`}
                    className="flex min-h-8 cursor-pointer items-center gap-2.5 rounded px-1 py-1 text-sm transition-colors hover:bg-slate-500/5 has-[:disabled]:cursor-wait"
                  >
                    <input
                      id={`${machine.id}-${procedure.id}`}
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded-sm accent-secondary dark:accent-emerald-400"
                      checked={procedure.isDone}
                      disabled={toggleBusy || removeBusy}
                      onChange={(e) => onToggleProcedure(machine, procedure, e.target.checked)}
                    />
                    <span
                      className={`min-w-0 transition-colors ${
                        procedure.isDone
                          ? 'font-medium text-secondary dark:text-emerald-300'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {procedure.title}
                    </span>
                    {toggleBusy && <InlineSpinner />}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <ProcedureAddForm
          machine={machine}
          idPrefix="add-procedure"
          busy={busyKey === `procedure-add:${machine.id}`}
          onAdd={onAddProcedure}
        />

        <button
          type="button"
          className="btn-primary w-full"
          disabled={checked.length === 0 || logBusy}
          onClick={() => onLog(machine)}
        >
          {logBusy ? <InlineSpinner /> : <IconCheck className="h-4 w-4" />}
          {logBusy ? 'Logging...' : 'Log Checked Maintenance'}
        </button>
      </section>

      <section className="space-y-2.5">
        <DimRule
          label={
            <span className="inline-flex items-center gap-1.5">
              <IconHistory className="h-3.5 w-3.5" /> Last log
            </span>
          }
          value={latest ? formatDate(latest.completedAt) : undefined}
        />
        {latest ? (
          <div className="space-y-1 text-sm">
            {maintenanceAttribution(latest) && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {maintenanceAttribution(latest)}
              </p>
            )}
            <p className="text-slate-600 dark:text-slate-300">{latest.procedureTitles.join(', ')}</p>
            {latest.notes && (
              <p className="flex items-start gap-1.5 text-slate-600 dark:text-slate-300">
                <IconNote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span className="line-clamp-3 min-w-0">{latest.notes}</span>
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">No history yet.</p>
        )}
      </section>

      <div className="mt-auto flex items-center gap-2 border-t border-[var(--rule)] pt-3">
        <button
          type="button"
          className="btn-ghost shrink-0 py-2 whitespace-nowrap"
          onClick={() => onOpenPanel(machine, 'history')}
        >
          <IconHistory className="h-4 w-4" /> History
          <span className="readout text-xs text-slate-400">{historyCount}</span>
        </button>
        <button
          type="button"
          className="btn-ghost min-w-0 flex-1 py-2 whitespace-nowrap"
          onClick={() => onOpenPanel(machine, 'procedures')}
        >
          <IconWrench className="h-4 w-4" /> Manage procedures
        </button>
      </div>
    </article>
  );
}

export default function Maintenance() {
  const { actor, profile, isAdmin } = useAuth();
  const { machines, loading, error, retry } = useMachinesOutlet();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [deleting, setDeleting] = useState<Machine | null>(null);
  const [confirming, setConfirming] = useState<Machine | null>(null);
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  // Nobody is picked up front, so the logger is never credited by default.
  const [doneByChoice, setDoneByChoice] = useState('');
  const [doneByOther, setDoneByOther] = useState('');
  const team = useActiveUsers(confirming !== null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [panel, setPanel] = useState<MachinePanelState | null>(null);
  const [reporting, setReporting] = useState<Machine | null>(null);
  const [assigning, setAssigning] = useState<Machine | null>(null);
  const [repairing, setRepairing] = useState<Machine | null>(null);

  // Machines that are down come first.
  const visible = useMemo(
    () => [...filterMachines(machines, search)].sort(compareMachines),
    [machines, search],
  );
  const downCount = useMemo(() => machines.filter(isMachineDown).length, [machines]);
  const totalProcedures = useMemo(
    () => machines.reduce((sum, machine) => sum + machine.procedures.length, 0),
    [machines],
  );
  const readyProcedures = useMemo(
    () => machines.reduce((sum, machine) => sum + checkedProcedures(machine).length, 0),
    [machines],
  );
  const searching = search.trim().length > 0;

  if (!actor) return null;
  // `actor` is only set for an active account, so the role is always known.
  const role = profile?.role ?? 'staff';
  const viewer: MachineViewer = { uid: actor.uid, role };
  const statusActor = { ...actor, role };

  async function runAction(
    key: string,
    action: () => Promise<unknown>,
    success?: string,
  ): Promise<boolean> {
    setBusyKey(key);
    try {
      await action();
      if (success) toast(success, 'success');
      return true;
    } catch (err) {
      toast(errorMessage(err), 'error');
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAddMachine(values: MachineInput) {
    const saved = await runAction(
      'machine-add',
      () => addMachine(actor!, values),
      'Machine added.',
    );
    if (saved) setAdding(false);
  }

  async function handleEditMachine(values: MachineInput) {
    if (!editing) return;
    const saved = await runAction(
      `machine-edit:${editing.id}`,
      () => editMachine(actor!, editing.id, values),
      'Machine updated.',
    );
    if (saved) setEditing(null);
  }

  function handleAddProcedure(machine: Machine, title: string) {
    return runAction(
      `procedure-add:${machine.id}`,
      () => addProcedure(actor!, machine.id, title),
      'Procedure added.',
    );
  }

  function handleRemoveProcedure(machine: Machine, procedure: MaintenanceProcedure) {
    void runAction(
      `procedure-remove:${machine.id}:${procedure.id}`,
      () => removeProcedure(actor!, machine.id, procedure.id),
      'Procedure removed.',
    );
  }

  function handleToggleProcedure(
    machine: Machine,
    procedure: MaintenanceProcedure,
    isDone: boolean,
  ) {
    void runAction(
      `procedure-toggle:${machine.id}:${procedure.id}`,
      () => setProcedureDone(actor!, machine.id, procedure.id, isDone),
    );
  }

  function openConfirmLog(machine: Machine) {
    setMaintenanceNotes('');
    setDoneByChoice('');
    setDoneByOther('');
    setConfirming(machine);
  }

  function closeConfirmLog() {
    setConfirming(null);
    setMaintenanceNotes('');
    setDoneByChoice('');
    setDoneByOther('');
  }

  // The logger first, as "Me", then everyone else who is active.
  const me: MaintenanceWorker = { uid: actor.uid, name: actorDisplayName(actor) };
  const teammates = team.users.filter((person) => person.uid !== actor.uid);

  function chosenWorker(): MaintenanceWorker | null {
    if (doneByChoice === SOMEONE_ELSE) {
      const name = doneByOther.trim();
      return name ? { uid: '', name } : null;
    }
    if (doneByChoice === me.uid) return me;
    const person = teammates.find((p) => p.uid === doneByChoice);
    return person ? { uid: person.uid, name: userDisplayName(person) } : null;
  }
  const doneBy = chosenWorker();

  async function handleConfirmLog() {
    if (!confirming || !doneBy) return;
    const saved = await runAction(
      `maintenance-log:${confirming.id}`,
      () => logCheckedMaintenance(actor!, confirming.id, doneBy, maintenanceNotes.trim()),
      `Maintenance logged for ${confirming.name}.`,
    );
    if (saved) closeConfirmLog();
  }

  // Live record, so the dialogs follow a status change made elsewhere.
  const live = (machine: Machine | null) =>
    machine ? (machines.find((m) => m.id === machine.id) ?? null) : null;

  async function handleReportDown(machine: Machine, reason: string) {
    const saved = await runAction(
      `machine-status:${machine.id}`,
      () => reportMachineDown(statusActor, machine, reason),
      `${machine.name} reported down.`,
    );
    if (saved) setReporting(null);
  }

  async function handleAssignRepair(machine: Machine, assignee: AppUser | null) {
    const saved = await runAction(
      `machine-status:${machine.id}`,
      () => assignMachineRepair(statusActor, machine, assignee),
      assignee ? `Repair assigned to ${userDisplayName(assignee)}.` : 'Repair unassigned.',
    );
    if (saved) setAssigning(null);
  }

  async function handleMarkRepaired(machine: Machine) {
    const saved = await runAction(
      `machine-status:${machine.id}`,
      () => markMachineRepaired(statusActor, machine),
      `${machine.name} is back in service.`,
    );
    if (saved) setRepairing(null);
  }

  const addButton = (
    <button className="btn-primary" onClick={() => setAdding(true)} data-tour="add-machine">
      <IconPlus className="h-4 w-4" /> Add machine
    </button>
  );

  return (
    <div className="space-y-6" data-tour="maintenance-page">
      <PageHeader
        title="Maintenance"
        eyebrow="Machine readiness"
        subtitle={
          loading
            ? 'Connecting to maintenance records...'
            : `${machines.length} machine${machines.length === 1 ? '' : 's'} tracked`
        }
        actions={addButton}
      />

      {loading ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-11" />
          <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
            <MachineCardSkeleton />
            <MachineCardSkeleton />
          </div>
        </>
      ) : error ? (
        <EmptyState
          icon={<IconCloudOff className="h-7 w-7" />}
          title="Unable to Load Machines"
          subtitle="Check your internet connection and Firestore permissions."
          action={
            <button className="btn-secondary" onClick={retry}>
              Retry
            </button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="surface px-4 py-3">
              <p className="technical-label">Machines</p>
              <p className="readout text-2xl font-bold">{machines.length}</p>
            </div>
            <div className="surface px-4 py-3">
              <p className="technical-label">Down</p>
              <p
                className={`readout text-2xl font-bold ${downCount > 0 ? 'text-danger dark:text-red-300' : ''}`}
              >
                {downCount}
              </p>
            </div>
            <div className="surface px-4 py-3">
              <p className="technical-label">Procedures</p>
              <p className="readout text-2xl font-bold">{totalProcedures}</p>
            </div>
            <div className="surface px-4 py-3">
              <p className="technical-label">Ready to log</p>
              <p className="readout text-2xl font-bold text-secondary dark:text-emerald-300">{readyProcedures}</p>
            </div>
          </div>

          <div className="surface relative p-2">
            <IconSearch className="pointer-events-none absolute top-1/2 left-5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <label htmlFor="machine-search" className="sr-only">
              Search machines
            </label>
            <input
              id="machine-search"
              type="search"
              className="field border-transparent py-2.5 pr-10 pl-9"
              placeholder="Search machines, locations, or procedures"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {searching && (
              <button
                type="button"
                aria-label="Clear search"
                title="Clear search"
                className="absolute top-1/2 right-4 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none dark:hover:bg-slate-800 dark:hover:text-slate-200"
                onClick={() => setSearch('')}
              >
                <IconClose className="h-4 w-4" />
              </button>
            )}
          </div>

          {machines.length === 0 ? (
            <EmptyState
              icon={<IconWrench className="h-7 w-7" />}
              title="No Machines Yet"
              subtitle="Add the first machine to start tracking maintenance."
              action={addButton}
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<IconSearch className="h-7 w-7" />}
              title="No Matching Machines"
              subtitle="Try searching by machine, location, or procedure."
              action={
                <button className="btn-ghost" onClick={() => setSearch('')}>
                  Clear search
                </button>
              }
            />
          ) : (
            // items-start: a machine with a long checklist no longer stretches
            // its neighbour to match.
            <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {visible.map((machine) => (
                <MachineCard
                  key={machine.id}
                  machine={machine}
                  busyKey={busyKey}
                  isAdmin={isAdmin}
                  viewer={viewer}
                  onReportDown={setReporting}
                  onAssignRepair={setAssigning}
                  onMarkRepaired={setRepairing}
                  onEdit={setEditing}
                  onDelete={setDeleting}
                  onAddProcedure={handleAddProcedure}
                  onToggleProcedure={handleToggleProcedure}
                  onLog={openConfirmLog}
                  onOpenPanel={(m, tab) => setPanel({ machineId: m.id, tab })}
                />
              ))}
            </div>
          )}
        </>
      )}

      <FloatingAddButton label="Add machine" onClick={() => setAdding(true)}>
        <IconPlus className="h-4 w-4" /> Add machine
      </FloatingAddButton>

      <MachinePanel
        state={panel}
        machines={machines}
        busyKey={busyKey}
        onTabChange={(tab) => setPanel((current) => (current ? { ...current, tab } : current))}
        onClose={() => setPanel(null)}
        onEdit={(machine) => {
          setPanel(null);
          setEditing(machine);
        }}
        onAddProcedure={handleAddProcedure}
        onRemoveProcedure={handleRemoveProcedure}
      />

      <ReportDownModal
        machine={live(reporting)}
        busy={reporting !== null && busyKey === `machine-status:${reporting.id}`}
        onReport={(machine, reason) => void handleReportDown(machine, reason)}
        onClose={() => setReporting(null)}
      />

      <AssignUserModal
        open={live(assigning) !== null}
        title="Who will repair it?"
        subtitle={live(assigning)?.name ?? ''}
        assignedToUid={live(assigning)?.repairAssignedToUid ?? ''}
        assignedToName={live(assigning)?.repairAssignedToName ?? ''}
        busy={assigning !== null && busyKey === `machine-status:${assigning.id}`}
        onAssign={(assignee) => {
          const machine = live(assigning);
          if (machine) void handleAssignRepair(machine, assignee);
        }}
        onClose={() => setAssigning(null)}
      />

      <MarkRepairedModal
        machine={live(repairing)}
        busy={repairing !== null && busyKey === `machine-status:${repairing.id}`}
        onConfirm={(machine) => void handleMarkRepaired(machine)}
        onClose={() => setRepairing(null)}
      />

      <Modal open={adding} title="Add machine" onClose={() => setAdding(false)}>
        <MachineForm onSubmit={handleAddMachine} onCancel={() => setAdding(false)} />
      </Modal>

      <Modal open={editing !== null} title="Edit machine" onClose={() => setEditing(null)}>
        {editing && (
          <MachineForm
            initial={editing}
            onSubmit={handleEditMachine}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <Modal open={deleting !== null} title="Delete machine?" onClose={() => setDeleting(null)}>
        {deleting && (
          <div className="space-y-4">
            <p className="text-sm">
              Permanently delete <strong>{deleting.name}</strong>? This can't be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button
                className="btn-danger"
                disabled={busyKey === `machine-delete:${deleting.id}`}
                onClick={async () => {
                  const deleted = await runAction(
                    `machine-delete:${deleting.id}`,
                    () => deleteMachine(deleting.id),
                    'Machine deleted.',
                  );
                  if (deleted) setDeleting(null);
                }}
              >
                {busyKey === `machine-delete:${deleting.id}` && <InlineSpinner />}
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={confirming !== null} title="Confirm Maintenance" onClose={closeConfirmLog}>
        {confirming && (
          <div className="space-y-4">
            <p className="text-sm">
              Log the checked maintenance for <strong>{confirming.name}</strong>?
            </p>
            <div className="rounded border border-slate-200/70 bg-white/45 px-3 py-2 text-sm dark:border-slate-800/80 dark:bg-slate-950/25">
              {checkedProcedures(confirming).map((procedure) => procedure.title).join(', ')}
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor={`maintenance-done-by-${confirming.id}`}
                className="text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                Who did the maintenance?
              </label>
              <select
                id={`maintenance-done-by-${confirming.id}`}
                className="field"
                value={doneByChoice}
                onChange={(e) => setDoneByChoice(e.target.value)}
              >
                <option value="" disabled>
                  Choose who did the work
                </option>
                <option value={me.uid}>Me ({me.name})</option>
                {teammates.map((person) => (
                  <option key={person.uid} value={person.uid}>
                    {userDisplayName(person)}
                  </option>
                ))}
                <option value={SOMEONE_ELSE}>Someone else</option>
              </select>
              {team.error && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Unable to load the team. Check your connection.
                </p>
              )}
            </div>
            {doneByChoice === SOMEONE_ELSE && (
              <div className="space-y-1.5">
                <label
                  htmlFor={`maintenance-done-by-name-${confirming.id}`}
                  className="text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  Their name
                </label>
                <input
                  id={`maintenance-done-by-name-${confirming.id}`}
                  className="field"
                  autoFocus
                  autoCapitalize="words"
                  placeholder="For example, an outside technician"
                  value={doneByOther}
                  onChange={(e) => setDoneByOther(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label
                htmlFor={`maintenance-notes-${confirming.id}`}
                className="text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                Maintenance notes
              </label>
              <textarea
                id={`maintenance-notes-${confirming.id}`}
                className="field min-h-20 resize-y"
                rows={3}
                autoCapitalize="sentences"
                placeholder="Add notes about this maintenance"
                value={maintenanceNotes}
                onChange={(e) => setMaintenanceNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={closeConfirmLog}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={!doneBy || busyKey === `maintenance-log:${confirming.id}`}
                onClick={() => void handleConfirmLog()}
              >
                {busyKey === `maintenance-log:${confirming.id}` && <InlineSpinner />}
                Confirm
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
