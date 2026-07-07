import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toDate, type Material } from '../types';

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

/** Case-insensitive search across material name and unit. */
export function filterMaterials(materials: Material[], search: string): Material[] {
  const term = search.trim().toLowerCase();
  if (!term) return materials;
  return materials.filter(
    (m) => m.name.toLowerCase().includes(term) || m.unit.toLowerCase().includes(term),
  );
}
