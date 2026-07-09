import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useMachines } from '../hooks/useMachines';
import { MachineForm } from '../components/MachineForm';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/PageHeader';
import { MachineCardSkeleton, Skeleton } from '../components/Skeleton';
import {
  IconCheck,
  IconClock,
  IconClose,
  IconCloudOff,
  IconEdit,
  IconHistory,
  IconMapPin,
  IconPlus,
  IconSearch,
  IconTrash,
  IconWrench,
} from '../components/icons';
import { errorMessage, formatDate } from '../lib/format';
import {
  addMachine,
  addProcedure,
  deleteMachine,
  editMachine,
  filterMachines,
  logCheckedMaintenance,
  removeProcedure,
  setProcedureDone,
  type MachineInput,
} from '../services/machineService';
import type { Machine, MaintenanceProcedure } from '../types';

function checkedProcedures(machine: Machine): MaintenanceProcedure[] {
  return machine.procedures.filter((procedure) => procedure.isDone);
}

function lastMaintained(machine: Machine): Date | null {
  return machine.maintenanceHistory[0]?.completedAt ?? null;
}

function InlineSpinner() {
  return (
    <span
      aria-hidden
      className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
    />
  );
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
      className={`rounded-md border p-2 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
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
  onEdit,
  onDelete,
  onAddProcedure,
  onRemoveProcedure,
  onToggleProcedure,
  onLog,
}: {
  machine: Machine;
  busyKey: string | null;
  isAdmin: boolean;
  onEdit: (machine: Machine) => void;
  onDelete: (machine: Machine) => void;
  onAddProcedure: (machine: Machine, title: string) => Promise<boolean>;
  onRemoveProcedure: (machine: Machine, procedure: MaintenanceProcedure) => void;
  onToggleProcedure: (machine: Machine, procedure: MaintenanceProcedure, isDone: boolean) => void;
  onLog: (machine: Machine) => void;
}) {
  const [procedureTitle, setProcedureTitle] = useState('');
  const checked = checkedProcedures(machine);
  const addBusy = busyKey === `procedure-add:${machine.id}`;
  const logBusy = busyKey === `maintenance-log:${machine.id}`;
  const maintainedAt = lastMaintained(machine);

  async function handleAddProcedure(e: FormEvent) {
    e.preventDefault();
    const title = procedureTitle.trim();
    if (!title || addBusy) return;
    const saved = await onAddProcedure(machine, title);
    if (saved) setProcedureTitle('');
  }

  return (
    <article className="surface surface-hover flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="technical-label">Machine</p>
          <h2 className="line-clamp-2 font-display text-xl font-bold text-ink dark:text-slate-50">{machine.name}</h2>
          <p className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
            <IconMapPin className="h-4 w-4" />
            <span className="truncate">{machine.location}</span>
          </p>
          <p className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
            <IconClock className="h-4 w-4" />
            Last maintained: {formatDate(maintainedAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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

      {machine.notes && (
        <p className="rounded-md border border-slate-200/70 bg-white/45 px-3 py-2 text-sm text-slate-600 dark:border-slate-800/80 dark:bg-slate-950/25 dark:text-slate-300">
          {machine.notes}
        </p>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="technical-label">
            Procedures
          </h3>
          <span
            className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
              checked.length > 0
                ? 'border-secondary/20 bg-secondary-soft text-secondary dark:border-emerald-400/20 dark:bg-secondary/15 dark:text-emerald-300'
                : 'border-slate-200/70 bg-white/45 text-slate-500 dark:border-slate-800/80 dark:bg-slate-950/25 dark:text-slate-400'
            }`}
          >
            {checked.length} ready
          </span>
        </div>

        {machine.procedures.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No procedures yet.</p>
        ) : (
          <div className="space-y-2">
            {machine.procedures.map((procedure) => {
              const toggleBusy = busyKey === `procedure-toggle:${machine.id}:${procedure.id}`;
              const removeBusy = busyKey === `procedure-remove:${machine.id}:${procedure.id}`;
              return (
                <div
                  key={procedure.id}
                  className="flex items-center gap-2 rounded-md border border-slate-200/70 bg-white/35 px-3 py-2 dark:border-slate-800/80 dark:bg-slate-950/20"
                >
                  <input
                    id={`${machine.id}-${procedure.id}`}
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-700"
                    checked={procedure.isDone}
                    disabled={toggleBusy || removeBusy}
                    onChange={(e) => onToggleProcedure(machine, procedure, e.target.checked)}
                  />
                  <label
                    htmlFor={`${machine.id}-${procedure.id}`}
                    className={`min-w-0 flex-1 text-sm ${
                      procedure.isDone
                        ? 'font-medium text-secondary dark:text-emerald-300'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {procedure.title}
                  </label>
                  <button
                    type="button"
                    aria-label={`Remove ${procedure.title}`}
                    title="Remove procedure"
                    disabled={toggleBusy || removeBusy}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-danger-soft hover:text-danger focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-danger/15 dark:hover:text-red-300"
                    onClick={() => onRemoveProcedure(machine, procedure)}
                  >
                    {removeBusy ? <InlineSpinner /> : <IconTrash className="h-4 w-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <form className="flex gap-2" onSubmit={handleAddProcedure}>
          <label htmlFor={`add-procedure-${machine.id}`} className="sr-only">
            Add procedure
          </label>
          <input
            id={`add-procedure-${machine.id}`}
            className="field py-2"
            value={procedureTitle}
            onChange={(e) => setProcedureTitle(e.target.value)}
            placeholder="New procedure"
          />
          <button
            type="submit"
            className="btn-secondary shrink-0 px-3"
            disabled={addBusy || procedureTitle.trim().length === 0}
          >
            {addBusy ? <InlineSpinner /> : <IconPlus className="h-4 w-4" />}
            Add
          </button>
        </form>

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

      <section className="border-t border-slate-200/70 pt-4 dark:border-slate-800/80">
        <div className="technical-label mb-3 flex items-center gap-2">
          <IconHistory className="h-4 w-4" />
          Maintenance History
        </div>
        {machine.maintenanceHistory.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No history yet.</p>
        ) : (
          <ol className="space-y-3">
            {machine.maintenanceHistory.map((record, index) => (
              <li key={`${record.completedAt?.toISOString() ?? 'unknown'}-${index}`} className="border-l-2 border-primary/35 pl-3">
                <p className="text-sm font-semibold">{formatDate(record.completedAt)}</p>
                {record.completedByName && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Completed by {record.completedByName}
                  </p>
                )}
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {record.procedureTitles.join(', ')}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}

export default function Maintenance() {
  const { actor, isActive, isAdmin } = useAuth();
  const { machines, loading, error, retry } = useMachines(isActive);
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [deleting, setDeleting] = useState<Machine | null>(null);
  const [confirming, setConfirming] = useState<Machine | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const visible = useMemo(() => filterMachines(machines, search), [machines, search]);
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

  async function handleConfirmLog() {
    if (!confirming) return;
    const saved = await runAction(
      `maintenance-log:${confirming.id}`,
      () => logCheckedMaintenance(actor!, confirming.id),
      `Maintenance logged for ${confirming.name}.`,
    );
    if (saved) setConfirming(null);
  }

  const addButton = (
    <button className="btn-primary" onClick={() => setAdding(true)}>
      <IconPlus className="h-4 w-4" /> Add machine
    </button>
  );

  return (
    <div className="space-y-6">
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
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-11" />
          <div className="grid gap-4 xl:grid-cols-2">
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
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="surface px-4 py-3">
              <p className="technical-label">Machines</p>
              <p className="font-display text-2xl font-bold">{machines.length}</p>
            </div>
            <div className="surface px-4 py-3">
              <p className="technical-label">Procedures</p>
              <p className="font-display text-2xl font-bold">{totalProcedures}</p>
            </div>
            <div className="surface px-4 py-3">
              <p className="technical-label">Ready to log</p>
              <p className="font-display text-2xl font-bold text-secondary tabular-nums dark:text-emerald-300">{readyProcedures}</p>
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
            <div className="grid gap-4 xl:grid-cols-2">
              {visible.map((machine) => (
                <MachineCard
                  key={machine.id}
                  machine={machine}
                  busyKey={busyKey}
                  isAdmin={isAdmin}
                  onEdit={setEditing}
                  onDelete={setDeleting}
                  onAddProcedure={handleAddProcedure}
                  onRemoveProcedure={handleRemoveProcedure}
                  onToggleProcedure={handleToggleProcedure}
                  onLog={setConfirming}
                />
              ))}
            </div>
          )}
        </>
      )}

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

      <Modal open={confirming !== null} title="Confirm Maintenance" onClose={() => setConfirming(null)}>
        {confirming && (
          <div className="space-y-4">
            <p className="text-sm">
              Log the checked maintenance for <strong>{confirming.name}</strong>?
            </p>
            <div className="rounded-md border border-slate-200/70 bg-white/45 px-3 py-2 text-sm dark:border-slate-800/80 dark:bg-slate-950/25">
              {checkedProcedures(confirming).map((procedure) => procedure.title).join(', ')}
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setConfirming(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={busyKey === `maintenance-log:${confirming.id}`}
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
