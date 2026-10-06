import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { Machine, MaintenanceHistoryRecord, MaintenanceProcedure } from '../types';
import { formatDate } from '../lib/format';
import { SidePanel, PanelTabs } from './SidePanel';
import { DimRule } from './Drafting';
import { IconEdit, IconNote, IconPlus, IconTrash } from './icons';

export type MachinePanelTab = 'history' | 'procedures' | 'details';

export interface MachinePanelState {
  machineId: string;
  tab: MachinePanelTab;
}

/** History entries shown before "Show more"; a long-lived machine can carry
 *  years of logs and the panel should open instantly regardless. */
const HISTORY_PAGE = 20;

export function InlineSpinner() {
  return (
    <span
      aria-hidden
      className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
    />
  );
}

/** Whole days since `date`, phrased the way a technician would say it. */
export function sinceLabel(date: Date, now: Date = new Date()): string {
  const days = Math.floor(
    (new Date(now).setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

/** The one-line "add a procedure" form, used on the card and in the panel. */
export function ProcedureAddForm({
  machine,
  busy,
  idPrefix,
  onAdd,
}: {
  machine: Machine;
  busy: boolean;
  idPrefix: string;
  onAdd: (machine: Machine, title: string) => Promise<boolean>;
}) {
  const [title, setTitle] = useState('');
  const id = `${idPrefix}-${machine.id}`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    if (await onAdd(machine, trimmed)) setTitle('');
  }

  return (
    <form className="flex gap-2" onSubmit={handleSubmit}>
      <label htmlFor={id} className="sr-only">
        Add procedure
      </label>
      <input
        id={id}
        className="field py-1.5"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New procedure"
      />
      <button
        type="submit"
        className="btn-ghost shrink-0 px-3 py-1.5"
        disabled={busy || title.trim().length === 0}
      >
        {busy ? <InlineSpinner /> : <IconPlus className="h-4 w-4" />}
        Add
      </button>
    </form>
  );
}

function monthKey(date: Date | null): string {
  return date
    ? date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : 'Undated';
}

function HistoryTimeline({ history }: { history: MaintenanceHistoryRecord[] }) {
  const [shown, setShown] = useState(HISTORY_PAGE);
  const groups = useMemo(() => {
    const out: { month: string; records: MaintenanceHistoryRecord[] }[] = [];
    for (const record of history.slice(0, shown)) {
      const month = monthKey(record.completedAt);
      const last = out[out.length - 1];
      if (last && last.month === month) last.records.push(record);
      else out.push({ month, records: [record] });
    }
    return out;
  }, [history, shown]);

  if (history.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No maintenance has been logged for this machine yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.month} aria-label={group.month}>
          <DimRule label={group.month} value={group.records.length} className="mb-3" />
          <ol className="relative ml-1 space-y-4 before:absolute before:inset-y-1 before:left-[3px] before:w-px before:bg-[var(--rule)]">
            {group.records.map((record, index) => (
              <li
                key={`${record.completedAt?.toISOString() ?? 'unknown'}-${index}`}
                className="relative pl-6"
              >
                <span
                  aria-hidden
                  className="absolute top-1.5 left-0 h-[7px] w-[7px] rounded-full border border-primary bg-[var(--surface-bg-strong)] dark:border-indigo-300"
                />
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="readout text-sm font-semibold text-ink dark:text-slate-100">
                    {formatDate(record.completedAt)}
                  </p>
                  {record.completedByName && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Completed by {record.completedByName}
                    </p>
                  )}
                </div>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {record.procedureTitles.map((title) => (
                    <li
                      key={title}
                      className="rounded-sm border border-[var(--rule)] bg-white/60 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-950/30 dark:text-slate-300"
                    >
                      {title}
                    </li>
                  ))}
                </ul>
                {record.notes && (
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                    <IconNote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 whitespace-pre-line">{record.notes}</span>
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
      {history.length > shown && (
        <button
          type="button"
          className="btn-ghost w-full"
          onClick={() => setShown((n) => n + HISTORY_PAGE)}
        >
          Show {Math.min(HISTORY_PAGE, history.length - shown)} more
          <span className="readout text-xs text-slate-400">
            ({history.length - shown} older)
          </span>
        </button>
      )}
    </div>
  );
}

function SpecLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 py-1.5 text-sm">
      <dt className="shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <span aria-hidden className="min-w-3 flex-1 border-b border-dotted border-[var(--rule)]" />
      <dd className="min-w-0 text-right font-semibold text-slate-700 dark:text-slate-200">{children}</dd>
    </div>
  );
}

/** Everything about one machine that does not fit on its card: the full
 *  maintenance history, procedure management, and the record's details. */
export function MachinePanel({
  state,
  machines,
  busyKey,
  onTabChange,
  onClose,
  onEdit,
  onAddProcedure,
  onRemoveProcedure,
}: {
  state: MachinePanelState | null;
  machines: Machine[];
  busyKey: string | null;
  onTabChange: (tab: MachinePanelTab) => void;
  onClose: () => void;
  onEdit: (machine: Machine) => void;
  onAddProcedure: (machine: Machine, title: string) => Promise<boolean>;
  onRemoveProcedure: (machine: Machine, procedure: MaintenanceProcedure) => void;
}) {
  // Read the live record, so a procedure added here appears here at once.
  const machine = state ? machines.find((m) => m.id === state.machineId) ?? null : null;
  const tab = state?.tab ?? 'history';

  return (
    <SidePanel
      open={machine !== null}
      title={machine?.name ?? ''}
      onClose={onClose}
      meta={
        machine && (
          <p className="readout text-xs text-slate-500 dark:text-slate-400">
            {machine.location || 'No location'} · {machine.maintenanceHistory.length} log
            {machine.maintenanceHistory.length === 1 ? '' : 's'}
          </p>
        )
      }
      tabs={
        machine && (
          <PanelTabs
            idPrefix="machine-panel"
            active={tab}
            onChange={onTabChange}
            tabs={[
              { id: 'history', label: 'History', badge: machine.maintenanceHistory.length },
              { id: 'procedures', label: 'Procedures', badge: machine.procedures.length },
              { id: 'details', label: 'Details' },
            ]}
          />
        )
      }
    >
      {machine && (
        <div id="machine-panel-tabpanel" role="tabpanel" aria-labelledby={`machine-panel-tab-${tab}`}>
          {tab === 'history' && <HistoryTimeline key={machine.id} history={machine.maintenanceHistory} />}

          {tab === 'procedures' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                The reusable checklist for this machine. Tick items on the card, then log them
                together.
              </p>
              {machine.procedures.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No procedures yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
                  {machine.procedures.map((procedure, index) => {
                    const removeBusy =
                      busyKey === `procedure-remove:${machine.id}:${procedure.id}`;
                    return (
                      <li key={procedure.id} className="flex items-center gap-3 py-2">
                        <span className="readout w-6 shrink-0 text-xs text-slate-400">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-200">
                          {procedure.title}
                        </span>
                        {procedure.isDone && (
                          <span className="technical-label text-secondary dark:text-emerald-300">
                            Ready
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label={`Remove ${procedure.title}`}
                          title="Remove procedure"
                          disabled={removeBusy}
                          className="rounded p-1.5 text-slate-400 hover:bg-danger-soft hover:text-danger focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-danger/15 dark:hover:text-red-300"
                          onClick={() => onRemoveProcedure(machine, procedure)}
                        >
                          {removeBusy ? <InlineSpinner /> : <IconTrash className="h-4 w-4" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <ProcedureAddForm
                machine={machine}
                idPrefix="panel-add-procedure"
                busy={busyKey === `procedure-add:${machine.id}`}
                onAdd={onAddProcedure}
              />
            </div>
          )}

          {tab === 'details' && (
            <div className="space-y-5">
              <dl>
                <SpecLine label="Location">{machine.location || '—'}</SpecLine>
                <SpecLine label="Procedures">
                  <span className="readout">{machine.procedures.length}</span>
                </SpecLine>
                <SpecLine label="Logs">
                  <span className="readout">{machine.maintenanceHistory.length}</span>
                </SpecLine>
                <SpecLine label="Added">
                  <span className="readout">{formatDate(machine.createdAt)}</span>
                  {machine.createdByName && ` · ${machine.createdByName}`}
                </SpecLine>
                <SpecLine label="Last edited">
                  <span className="readout">{formatDate(machine.updatedAt)}</span>
                  {machine.updatedByName && ` · ${machine.updatedByName}`}
                </SpecLine>
              </dl>
              <div>
                <DimRule label="Notes" className="mb-2" />
                {machine.notes ? (
                  <p className="text-sm whitespace-pre-line text-slate-700 dark:text-slate-200">
                    {machine.notes}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No notes.</p>
                )}
              </div>
              <button type="button" className="btn-ghost" onClick={() => onEdit(machine)}>
                <IconEdit className="h-4 w-4" /> Edit details
              </button>
            </div>
          )}
        </div>
      )}
    </SidePanel>
  );
}
