const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function formatDate(d: Date | null): string {
  return d ? dateFmt.format(d) : '—';
}

/** Whole numbers without decimals; decimal quantities keep meaningful digits
 *  without trailing zeroes (12 → "12", 2.5 → "2.5", 0.125 → "0.125"). */
export function formatQuantity(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return String(parseFloat(n.toFixed(4)));
}

/** Human message for a Firebase error, without leaking raw codes. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as { code?: string }).code ?? '';
    const normalizedCode = code.replace(/^firestore\//, '');
    const map: Record<string, string> = {
      'auth/invalid-credential': 'Incorrect email or password.',
      'auth/user-not-found': 'No account exists with that email.',
      'auth/wrong-password': 'Incorrect email or password.',
      'auth/email-already-in-use': 'An account already exists with that email.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/invalid-email': 'That email address is not valid.',
      'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
      'permission-denied': "You don't have permission to do that.",
      'failed-precondition': 'This action is temporarily unavailable. Please try again shortly.',
      unavailable: 'Unable to connect. Check your internet connection and try again.',
      'deadline-exceeded': 'The request took too long. Please try again.',
    };
    if (map[code]) return map[code];
    if (map[normalizedCode]) return map[normalizedCode];
    if (code.startsWith('auth/')) return 'Unable to complete authentication. Please try again.';

    const message = err.message
      .replace(/^Firebase:\s*/, '')
      .replace(/\s*\(auth\/.*\)\.?$/, '.');
    if (
      /https?:\/\//i.test(message) ||
      /firebase|firestore|create.*index|exception|stack trace/i.test(message)
    ) {
      return 'Unable to complete that action right now. Please try again.';
    }
    return message || 'Something went wrong.';
  }
  return 'Something went wrong.';
}

/** Format a Date as the value for <input type="date">. */
export function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse a yyyy-mm-dd input into a local end-of-day Date (deadlines are inclusive). */
export function fromDateInputValue(v: string): Date {
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59);
}
