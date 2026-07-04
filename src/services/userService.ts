import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toDate, type AppUser, type ProfileFields, type UserRole, type UserStatus } from '../types';

function parseUser(uid: string, data: Record<string, unknown>): AppUser {
  const role = data.role as string;
  const status = data.status as string;
  return {
    uid,
    name: (data.name as string) ?? '',
    email: (data.email as string) ?? '',
    role: (role === 'manager' || role === 'admin' ? role : 'staff') as UserRole,
    status: (status === 'active' || status === 'disabled' || status === 'removed'
      ? status
      : 'pending') as UserStatus,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    firstName: data.firstName as string | undefined,
    lastName: data.lastName as string | undefined,
    fullName: data.fullName as string | undefined,
    phoneNumber: data.phoneNumber as string | undefined,
    jobTitle: data.jobTitle as string | undefined,
    department: data.department as string | undefined,
  };
}

/** Live-subscribe to a single user's profile doc. Emits null while the doc
 *  doesn't exist yet (fresh sign-up before the profile write lands). */
export function watchUser(
  uid: string,
  onUser: (user: AppUser | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => onUser(snap.exists() ? parseUser(snap.id, snap.data()) : null),
    onError,
  );
}

/** Admin: live list of all users, ordered by email. */
export function watchAllUsers(
  onUsers: (users: AppUser[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, 'users'), orderBy('email'));
  return onSnapshot(
    q,
    (snap) => onUsers(snap.docs.map((d) => parseUser(d.id, d.data()))),
    onError,
  );
}

/** Admin: change a non-admin user's status. Rules only allow this exact patch. */
export async function setUserStatus(uid: string, status: UserStatus): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { status, updatedAt: serverTimestamp() });
}

/** Self-update of the allowed profile fields. */
export async function updateProfile(uid: string, fields: ProfileFields): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) patch[k] = v;
  }
  await updateDoc(doc(db, 'users', uid), patch);
}
