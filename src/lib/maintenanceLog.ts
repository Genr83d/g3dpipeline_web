import type { MaintenanceHistoryRecord } from '../types';

/** Who did a piece of maintenance: a team member, or someone outside the team
 *  known only by name, whose uid is ''. */
export interface MaintenanceWorker {
  uid: string;
  name: string;
}

/** "Completed by Sam", adding who logged it when that was someone else.
 *  Records from before the apps asked who did the work only say who logged
 *  them, since that is all they hold. Mirrors the Flutter app's
 *  MachineMaintenanceRecord.attribution. */
export function maintenanceAttribution(
  record: Pick<
    MaintenanceHistoryRecord,
    'completedByName' | 'completedByUid' | 'loggedByUid' | 'loggedByName'
  >,
): string {
  const namesWhoDidTheWork = record.loggedByUid !== '';
  if (!namesWhoDidTheWork || !record.completedByName) {
    const logger = namesWhoDidTheWork ? record.loggedByName : record.completedByName;
    return logger ? `Logged by ${logger}` : '';
  }
  const loggedOwnWork = record.completedByUid === record.loggedByUid;
  return loggedOwnWork || !record.loggedByName
    ? `Completed by ${record.completedByName}`
    : `Completed by ${record.completedByName} · logged by ${record.loggedByName}`;
}
