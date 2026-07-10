import { describe, expect, it } from 'vitest';
import {
  assignableRolesFor,
  canAssignRole,
  roleLabel,
} from '../lib/roles';
import {
  canClearCollaborators,
  canCompleteJob,
  canDeleteJob,
  canEditJob,
  canManageCollaborators,
  canRestoreJob,
  canStartJob,
} from '../lib/jobPermissions';
import { parseAssignedRole, parseUserRole, type UserRole } from '../types';

const roles: readonly UserRole[] = ['staff', 'awf', 'manager', 'admin'];

describe('AWF role model', () => {
  it('parses every supported role and defaults unknown legacy values to Staff', () => {
    for (const role of roles) expect(parseUserRole(role)).toBe(role);
    expect(parseUserRole(undefined)).toBe('staff');
    expect(parseUserRole('operator')).toBe('staff');

    expect(parseAssignedRole('awf')).toBe('awf');
    expect(parseAssignedRole('operator')).toBe('');
  });

  it('uses the full AWF label except in the compact account treatment', () => {
    expect(roleLabel('staff')).toBe('Staff');
    expect(roleLabel('awf')).toBe('AWF Staff');
    expect(roleLabel('awf', true)).toBe('Staff');
    expect(roleLabel('manager')).toBe('Manager');
    expect(roleLabel('admin')).toBe('Admin');
  });
});

describe('assignment role matrix', () => {
  it('allows managers to assign only Staff and AWF Staff', () => {
    expect(assignableRolesFor('manager')).toEqual(['staff', 'awf']);
    expect(canAssignRole('manager', 'staff')).toBe(true);
    expect(canAssignRole('manager', 'awf')).toBe(true);
    expect(canAssignRole('manager', 'manager')).toBe(false);
    expect(canAssignRole('manager', 'admin')).toBe(false);
  });

  it('allows admins to assign any active role and no other role to assign', () => {
    expect(assignableRolesFor('admin')).toEqual(roles);
    for (const targetRole of roles) expect(canAssignRole('admin', targetRole)).toBe(true);
    for (const assignerRole of ['staff', 'awf'] as const) {
      expect(assignableRolesFor(assignerRole)).toEqual([]);
      for (const targetRole of roles) {
        expect(canAssignRole(assignerRole, targetRole)).toBe(false);
      }
    }
  });
});

describe('job action matrix', () => {
  const pendingUnassigned = {
    status: 'pending' as const,
    collaboratorUids: [],
    assignedToUid: '',
  };
  const pendingAssigned = {
    status: 'pending' as const,
    collaboratorUids: ['assigned-user'],
    assignedToUid: 'assigned-user',
  };
  const startedAssigned = {
    status: 'started' as const,
    collaboratorUids: ['assigned-user'],
    assignedToUid: 'assigned-user',
  };

  it('allows Staff, AWF Staff, and Admin—but not Manager—to claim an unassigned job', () => {
    expect(canStartJob(pendingUnassigned, { uid: 'staff-user', role: 'staff' })).toBe(true);
    expect(canStartJob(pendingUnassigned, { uid: 'awf-user', role: 'awf' })).toBe(true);
    expect(canStartJob(pendingUnassigned, { uid: 'admin-user', role: 'admin' })).toBe(true);
    expect(canStartJob(pendingUnassigned, { uid: 'manager-user', role: 'manager' })).toBe(false);
  });

  it('allows only a collaborator to start an already assigned pending job', () => {
    for (const role of roles) {
      expect(canStartJob(pendingAssigned, { uid: 'assigned-user', role })).toBe(true);
      expect(canStartJob(pendingAssigned, { uid: 'someone-else', role })).toBe(false);
    }
  });

  it('allows collaborators, managers, and admins to complete a started job', () => {
    expect(canCompleteJob(startedAssigned, { uid: 'assigned-user', role: 'awf' })).toBe(true);
    expect(canCompleteJob(startedAssigned, { uid: 'someone-else', role: 'staff' })).toBe(false);
    expect(canCompleteJob(startedAssigned, { uid: 'someone-else', role: 'awf' })).toBe(false);
    expect(canCompleteJob(startedAssigned, { uid: 'manager-user', role: 'manager' })).toBe(true);
    expect(canCompleteJob(startedAssigned, { uid: 'admin-user', role: 'admin' })).toBe(true);
  });

  it('applies management-only edit, team, restore, clear, and delete permissions', () => {
    for (const role of ['staff', 'awf'] as const) {
      expect(canEditJob('pending', role)).toBe(false);
      expect(canManageCollaborators('pending', role)).toBe(false);
      expect(canClearCollaborators('pending', role, true)).toBe(false);
      expect(canRestoreJob(role)).toBe(false);
      expect(canDeleteJob(role)).toBe(false);
    }

    for (const role of ['manager', 'admin'] as const) {
      expect(canEditJob('pending', role)).toBe(true);
      expect(canEditJob('completed', role)).toBe(false);
      expect(canManageCollaborators('started', role)).toBe(true);
      expect(canManageCollaborators('completed', role)).toBe(false);
      expect(canClearCollaborators('pending', role, true)).toBe(true);
      expect(canClearCollaborators('started', role, true)).toBe(false);
      expect(canClearCollaborators('pending', role, false)).toBe(false);
      expect(canRestoreJob(role)).toBe(true);
    }

    expect(canDeleteJob('manager')).toBe(false);
    expect(canDeleteJob('admin')).toBe(true);
  });
});
