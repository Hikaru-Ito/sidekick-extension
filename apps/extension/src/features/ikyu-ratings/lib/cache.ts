import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { MAX_CACHE_ENTRIES, type IkyuLookup } from '../types';

/**
 * IDB cache for Ikyu aggregate lookups (Tabelog + Maps), keyed by Ikyu
 * restaurant id. Shares the `sidekick` database with read-later and
 * tabelog-gmap — see `read-later/lib/db.ts` for the schema notes.
 */
interface SidekickDB extends DBSchema {
  readLater: {
    key: string;
    value: Record<string, unknown>;
    indexes: { 'by-savedAt': number; 'by-url': string; 'by-tags': string; 'by-readAt': number };
  };
  tabelogGmap: {
    key: string;
    value: Record<string, unknown>;
    indexes: { 'by-fetchedAt': number };
  };
  ikyuRatings: {
    key: string;
    value: IkyuLookup;
    indexes: { 'by-fetchedAt': number };
  };
}

const DB_NAME = 'sidekick';
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<SidekickDB>> | null = null;

function getDB(): Promise<IDBPDatabase<SidekickDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SidekickDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const rl = db.createObjectStore('readLater', { keyPath: 'id' });
          rl.createIndex('by-savedAt', 'savedAt');
          rl.createIndex('by-url', 'url', { unique: false });
          rl.createIndex('by-tags', 'tags', { multiEntry: true });
          rl.createIndex('by-readAt', 'readAt');
        }
        if (oldVersion < 2) {
          const tg = db.createObjectStore('tabelogGmap', { keyPath: 'tabelogId' });
          tg.createIndex('by-fetchedAt', 'fetchedAt');
        }
        if (oldVersion < 3) {
          const ik = db.createObjectStore('ikyuRatings', { keyPath: 'ikyuId' });
          ik.createIndex('by-fetchedAt', 'fetchedAt');
        }
      },
      blocking() {
        void dbPromise?.then((db) => db.close());
        dbPromise = null;
      },
    });
  }
  return dbPromise;
}

const CHANNEL_NAME = 'sidekick:ikyu-ratings';

function broadcast(): void {
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.postMessage({ type: 'changed', at: Date.now() });
    ch.close();
  } catch {
    /* unavailable */
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

export async function getCached(ikyuId: string): Promise<IkyuLookup | null> {
  const db = await getDB();
  const v = await db.get('ikyuRatings', ikyuId);
  return v ?? null;
}

export async function setCached(entry: IkyuLookup): Promise<void> {
  const db = await getDB();
  await db.put('ikyuRatings', entry);
  await enforceCap();
  broadcast();
}

export async function clearAll(): Promise<void> {
  const db = await getDB();
  await db.clear('ikyuRatings');
  broadcast();
}

export async function countCached(): Promise<number> {
  const db = await getDB();
  return db.count('ikyuRatings');
}

export function isFresh(entry: IkyuLookup, ttlDays: number): boolean {
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  return Date.now() - entry.fetchedAt < ttlMs;
}

async function enforceCap(): Promise<void> {
  const db = await getDB();
  const count = await db.count('ikyuRatings');
  if (count <= MAX_CACHE_ENTRIES) return;
  const excess = count - MAX_CACHE_ENTRIES;
  const tx = db.transaction('ikyuRatings', 'readwrite');
  const idx = tx.store.index('by-fetchedAt');
  let cursor = await idx.openCursor();
  let dropped = 0;
  while (cursor && dropped < excess) {
    await cursor.delete();
    dropped++;
    cursor = await cursor.continue();
  }
  await tx.done;
}
