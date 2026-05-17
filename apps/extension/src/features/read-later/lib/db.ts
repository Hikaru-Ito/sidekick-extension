import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ReadLaterItem } from '../types';

interface SidekickDB extends DBSchema {
  readLater: {
    key: string;
    value: ReadLaterItem;
    indexes: {
      'by-savedAt': number;
      'by-url': string;
      'by-tags': string;
      'by-readAt': number;
    };
  };
}

const DB_NAME = 'sidekick';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<SidekickDB>> | null = null;

function getDB(): Promise<IDBPDatabase<SidekickDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SidekickDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('readLater', { keyPath: 'id' });
        store.createIndex('by-savedAt', 'savedAt');
        store.createIndex('by-url', 'url', { unique: false });
        store.createIndex('by-tags', 'tags', { multiEntry: true });
        store.createIndex('by-readAt', 'readAt');
      },
    });
  }
  return dbPromise;
}

const CHANNEL_NAME = 'sidekick:read-later';

function broadcast(): void {
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.postMessage({ type: 'changed', at: Date.now() });
    ch.close();
  } catch {
    /* BroadcastChannel may be unavailable in some contexts */
  }
}

export function subscribeChanges(handler: () => void): () => void {
  let ch: BroadcastChannel | null = null;
  try {
    ch = new BroadcastChannel(CHANNEL_NAME);
    ch.onmessage = () => handler();
  } catch {
    ch = null;
  }
  return () => ch?.close();
}

export async function findByUrl(url: string): Promise<ReadLaterItem | null> {
  const db = await getDB();
  const result = await db.getFromIndex('readLater', 'by-url', url);
  return result ?? null;
}

export async function listItems(): Promise<ReadLaterItem[]> {
  const db = await getDB();
  // Newest first.
  const items = await db.getAllFromIndex('readLater', 'by-savedAt');
  return items.reverse();
}

export async function putItem(item: ReadLaterItem): Promise<void> {
  const db = await getDB();
  await db.put('readLater', item);
  broadcast();
}

export async function patchItem(
  id: string,
  patch: Partial<ReadLaterItem>,
): Promise<ReadLaterItem | null> {
  const db = await getDB();
  const tx = db.transaction('readLater', 'readwrite');
  const cur = await tx.store.get(id);
  if (!cur) {
    await tx.done;
    return null;
  }
  const next: ReadLaterItem = { ...cur, ...patch };
  await tx.store.put(next);
  await tx.done;
  broadcast();
  return next;
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('readLater', id);
  broadcast();
}

export async function getItem(id: string): Promise<ReadLaterItem | null> {
  const db = await getDB();
  const item = await db.get('readLater', id);
  return item ?? null;
}

export async function countItems(): Promise<{ total: number; unread: number }> {
  const items = await listItems();
  return {
    total: items.length,
    unread: items.filter((i) => i.readAt === null).length,
  };
}

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
