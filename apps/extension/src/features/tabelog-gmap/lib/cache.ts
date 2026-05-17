import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { MAX_CACHE_ENTRIES, type GmapLookup } from '../types';

/**
 * IDB cache for Google Maps lookups, keyed by Tabelog place id.
 * Reuses the same database name as Read Later (single DB per extension).
 */
interface SidekickDB extends DBSchema {
  /** Read Later store — kept here so we open the same DB version. */
  readLater: {
    key: string;
    // We don't read from this store in this feature; treat as any-record.
    value: Record<string, unknown>;
    indexes: { 'by-savedAt': number; 'by-url': string; 'by-tags': string; 'by-readAt': number };
  };
  tabelogGmap: {
    key: string;
    value: GmapLookup;
    indexes: { 'by-fetchedAt': number };
  };
}

const DB_NAME = 'sidekick';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<SidekickDB>> | null = null;

function getDB(): Promise<IDBPDatabase<SidekickDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SidekickDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          // Created by the Read Later feature on first run. We mirror its
          // schema so older installs don't lose data when this feature lands.
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
      },
      blocking() {
        // See sibling note in read-later/lib/db.ts — close to allow upgrades.
        void dbPromise?.then((db) => db.close());
        dbPromise = null;
      },
    });
  }
  return dbPromise;
}

const CHANNEL_NAME = 'sidekick:tabelog-gmap';

function broadcast(): void {
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.postMessage({ type: 'changed', at: Date.now() });
    ch.close();
  } catch {
    /* unavailable in some contexts */
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

export async function getCached(tabelogId: string): Promise<GmapLookup | null> {
  const db = await getDB();
  const v = await db.get('tabelogGmap', tabelogId);
  return v ?? null;
}

export async function setCached(entry: GmapLookup): Promise<void> {
  const db = await getDB();
  await db.put('tabelogGmap', entry);
  await enforceCap();
  broadcast();
}

export async function deleteCached(tabelogId: string): Promise<void> {
  const db = await getDB();
  await db.delete('tabelogGmap', tabelogId);
  broadcast();
}

export async function clearAll(): Promise<void> {
  const db = await getDB();
  await db.clear('tabelogGmap');
  broadcast();
}

export async function countCached(): Promise<number> {
  const db = await getDB();
  return db.count('tabelogGmap');
}

export function isFresh(entry: GmapLookup, ttlDays: number): boolean {
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  return Date.now() - entry.fetchedAt < ttlMs;
}

/** Drop oldest entries when the store grows beyond MAX_CACHE_ENTRIES. */
async function enforceCap(): Promise<void> {
  const db = await getDB();
  const count = await db.count('tabelogGmap');
  if (count <= MAX_CACHE_ENTRIES) return;
  const excess = count - MAX_CACHE_ENTRIES;
  const tx = db.transaction('tabelogGmap', 'readwrite');
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
