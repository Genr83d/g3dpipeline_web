import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  updateProfile as fbUpdateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

/** Short first name used for job stamps: displayName's first word,
 *  else the email local-part, capitalized. */
export function deriveFirstName(user: User): string {
  const source = user.displayName?.trim() || user.email?.split('@')[0] || 'User';
  const word = source.split(/\s+/)[0];
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export async function signUp(name: string, email: string, password: string): Promise<void> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await fbUpdateProfile(cred.user, { displayName: name });
  // Exact field set required by the rules; email must match the auth token.
  await setDoc(doc(db, 'users', cred.user.uid), {
    uid: cred.user.uid,
    name,
    email: cred.user.email,
    role: 'staff',
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Not signed in.');
  const cred = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, cred);
  await updatePassword(user, newPassword);
}
