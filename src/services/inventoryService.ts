import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toDate, type Material } from '../types';
import type { Actor } from './jobService';

export const inventoryCol = collection(db, 'inventory');

export function parseMaterial(id: string, data: Record<string, unknown>): Material {
  return {
    id,
    name: typeof data.name === 'string' ? data.name : '',
    unit: typeof data.unit === 'string' ? data.unit : '',
    quantity: typeof data.quantity === 'number' ? data.quantity : 0,
    totalQuantity: typeof data.totalQuantity === 'number' ? data.totalQuantity : 0,
    createdAt: toDate(data.createdAt),
    createdByUid: (data.createdByUid as string) ?? '',
    createdByName: (data.createdByName as string) ?? '',
    updatedAt: toDate(data.updatedAt),
    updatedByUid: (data.updatedByUid as string) ?? '',
    updatedByName: (data.updatedByName as string) ?? '',
  };
}

export function watchInventory(
  onMaterials: (materials: Material[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(inventoryCol, orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snap) => onMaterials(snap.docs.map((d) => parseMaterial(d.id, d.data()))),
    onError,
  );
}

/** Low stock is strictly below 30% of full stock. */
export function isLowStock(m: Material): boolean {
  return m.totalQuantity > 0 && m.quantity / m.totalQuantity < 0.3;
}

/** Stock fill ratio clamped to [0, 1] for progress bars and percentages. */
export function stockRatio(m: Material): number {
  if (m.totalQuantity <= 0) return 0;
  return Math.min(1, Math.max(0, m.quantity / m.totalQuantity));
}

export interface MaterialInput {
  name: string;
  unit: string;
  quantity: number;
  totalQuantity: number;
}

function materialActorName(actor: Actor): string {
  return actor.displayName?.trim() || actor.firstName || actor.email || 'User';
}

export async function addMaterial(actor: Actor, input: MaterialInput): Promise<void> {
  const byName = materialActorName(actor);
  await addDoc(inventoryCol, {
    ...input,
    createdAt: serverTimestamp(),
    createdByUid: actor.uid,
    createdByName: byName,
    updatedAt: serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByName: byName,
  });
}

export async function editMaterial(actor: Actor, id: string, input: MaterialInput): Promise<void> {
  const byName = materialActorName(actor);
  await updateDoc(doc(db, 'inventory', id), {
    ...input,
    updatedAt: serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByName: byName,
  });
}

/** Case-insensitive search across material name and unit. */
export function filterMaterials(materials: Material[], search: string): Material[] {
  const term = search.trim().toLowerCase();
  if (!term) return materials;
  return materials.filter(
    (m) => m.name.toLowerCase().includes(term) || m.unit.toLowerCase().includes(term),
  );
}
