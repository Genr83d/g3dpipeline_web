import type { UserRole } from '../types';

const ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  staff: 'Staff',
  awf: 'AWF Staff',
  manager: 'Manager',
  admin: 'Admin',
};

const COMPACT_ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  ...ROLE_LABELS,
  awf: 'Staff',
};

const MANAGER_ASSIGNABLE_ROLES: readonly UserRole[] = ['staff', 'awf'];
const ADMIN_ASSIGNABLE_ROLES: readonly UserRole[] = ['staff', 'awf', 'manager', 'admin'];

export function roleLabel(role: UserRole, compact = false): string {
  return (compact ? COMPACT_ROLE_LABELS : ROLE_LABELS)[role];
}

export function roleScopeKey(uid: string, role: UserRole): string {
  return `${uid}:${role}`;
}

export function isManagerOrAdminRole(role: UserRole): boolean {
  return role === 'manager' || role === 'admin';
}

export function assignableRolesFor(role: UserRole): readonly UserRole[] {
  if (role === 'admin') return ADMIN_ASSIGNABLE_ROLES;
  if (role === 'manager') return MANAGER_ASSIGNABLE_ROLES;
  return [];
}

export function canAssignRole(assignerRole: UserRole, targetRole: UserRole): boolean {
  return assignableRolesFor(assignerRole).includes(targetRole);
}

export function canSelfStartUnassigned(role: UserRole): boolean {
  return role === 'staff' || role === 'awf' || role === 'admin';
}
