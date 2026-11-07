// Persistence: a single SQLite table of JSON documents, scoped by owner.
// Uses Node's built-in sqlite module (Node 22.13+), so there is no native
// dependency to compile. Swap this file for Postgres/KV in production; the
// rest of the app only calls the four functions exported here.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export const KINDS = ['projects', 'styles', 'prefs'] as const;
export type Kind = (typeof KINDS)[number];
export const isKind = (k: string): k is Kind => (KINDS as readonly string[]).includes(k);

let db: DatabaseSync | null = null;
function conn(): DatabaseSync {
  if (db) return db;
  const file = path.resolve(process.env.SURFACE_DB_PATH || './data/surface-studio.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS items (
      owner TEXT NOT NULL,
      kind TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (owner, kind, id)
    );
    CREATE INDEX IF NOT EXISTS items_recent ON items (owner, kind, updated_at DESC);
  `);
  return db;
}

export function listItems(owner: string, kind: Kind, limit = 200): unknown[] {
  const rows = conn().prepare('SELECT data FROM items WHERE owner = ? AND kind = ? ORDER BY updated_at DESC LIMIT ?').all(owner, kind, limit) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data));
}

export function getItem(owner: string, kind: Kind, id: string): unknown | null {
  const row = conn().prepare('SELECT data FROM items WHERE owner = ? AND kind = ? AND id = ?').get(owner, kind, id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}

export function putItem(owner: string, kind: Kind, id: string, data: unknown): void {
  conn().prepare(`INSERT INTO items (owner, kind, id, data, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(owner, kind, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)
    .run(owner, kind, id, JSON.stringify(data), Date.now());
}

export function deleteItem(owner: string, kind: Kind, id: string): void {
  conn().prepare('DELETE FROM items WHERE owner = ? AND kind = ? AND id = ?').run(owner, kind, id);
}
