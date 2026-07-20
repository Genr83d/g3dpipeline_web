import type { JobStatus } from '../types';

export function resolvedCompletedQuantity(
  stored: unknown,
  quantity: number,
  status: JobStatus,
): number {
  const fallback = status === 'completed' ? quantity : 0;
  const value = typeof stored === 'number' && Number.isInteger(stored) ? stored : fallback;
  return Math.min(Math.max(0, value), Math.max(0, quantity));
}

export function jobCompletionRatio(completedQuantity: number, quantity: number): number {
  if (quantity <= 0) return 0;
  return Math.min(1, Math.max(0, completedQuantity / quantity));
}

export function validateCompletedQuantity(raw: string | number, quantity: number): string | null {
  const message = `Enter a whole number from 0 to ${quantity}.`;
  const text = typeof raw === 'string' ? raw.trim() : String(raw);
  if (!/^\d+$/.test(text)) return message;
  const value = typeof raw === 'number' ? raw : Number(text);
  return Number.isInteger(value) && value >= 0 && value <= quantity ? null : message;
}
