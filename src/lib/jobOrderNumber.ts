/** Shared with the Flutter app: `G3D-` followed by the first eight characters
 *  of the Firestore document ID, uppercased. */
export const JOB_ORDER_NUMBER_PREFIX = 'G3D-';

const ORDER_NUMBER_ID_LENGTH = 8;

/** Derives the order number a new job stores at creation time. Returns '' for a
 *  blank document ID so callers never persist a bare prefix. */
export function orderNumberFromDocumentId(documentId: string): string {
  const id = documentId.trim();
  if (!id) return '';
  return `${JOB_ORDER_NUMBER_PREFIX}${id.slice(0, ORDER_NUMBER_ID_LENGTH).toUpperCase()}`;
}

/** Display order number for a job document. A stored value always wins — it is
 *  the number the shop already knows — and legacy jobs written before the field
 *  existed derive a stable one from their document ID, so no migration is
 *  needed. Empty only when both the stored value and the ID are empty. */
export function jobOrderNumber(storedOrderNumber: unknown, documentId: string): string {
  const stored = typeof storedOrderNumber === 'string' ? storedOrderNumber.trim() : '';
  return stored || orderNumberFromDocumentId(documentId);
}
