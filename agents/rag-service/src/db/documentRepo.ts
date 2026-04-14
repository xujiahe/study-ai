import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { DocumentRecord } from "../types.js";

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS documents (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK(status IN ('pending','indexing','ready','error')),
  chunk_count INTEGER NOT NULL DEFAULT 0,
  metadata    TEXT NOT NULL DEFAULT '{}',
  error_msg   TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
`;

export class DocumentRepository {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(CREATE_TABLE_SQL);
  }

  insert(doc: Omit<DocumentRecord, "createdAt" | "updatedAt">): DocumentRecord {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO documents (id, title, file_path, status, chunk_count, metadata, error_msg, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      doc.id, doc.title, doc.filePath, doc.status, doc.chunkCount,
      JSON.stringify(doc.metadata ?? {}), doc.errorMessage ?? null, now, now
    );
    return { ...doc, createdAt: now, updatedAt: now };
  }

  updateStatus(id: string, status: DocumentRecord["status"], extra?: { chunkCount?: number; errorMessage?: string }): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE documents SET status=?, updated_at=?,
        chunk_count=COALESCE(?, chunk_count),
        error_msg=COALESCE(?, error_msg)
      WHERE id=?
    `).run(status, now, extra?.chunkCount ?? null, extra?.errorMessage ?? null, id);
  }

  findById(id: string): DocumentRecord | null {
    const row = this.db.prepare("SELECT * FROM documents WHERE id=?").get(id) as Record<string, unknown> | undefined;
    return row ? this.toRecord(row) : null;
  }

  findAll(): DocumentRecord[] {
    const rows = this.db.prepare("SELECT * FROM documents").all() as Record<string, unknown>[];
    return rows.map(r => this.toRecord(r));
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM documents WHERE id=?").run(id);
  }

  private toRecord(row: Record<string, unknown>): DocumentRecord {
    return {
      id: row.id as string,
      title: row.title as string,
      filePath: row.file_path as string,
      status: row.status as DocumentRecord["status"],
      chunkCount: row.chunk_count as number,
      metadata: JSON.parse(row.metadata as string) as Record<string, unknown>,
      errorMessage: (row.error_msg as string | null) ?? undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
