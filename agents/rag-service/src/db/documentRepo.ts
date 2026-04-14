import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { DocumentRecord } from "../types.js";

// ─── Row shape as stored in SQLite ────────────────────────────────────────────

interface DocumentRow {
  id: string;
  title: string;
  file_path: string;
  status: string;
  chunk_count: number;
  metadata: string;
  error_msg: string | null;
  created_at: string;
  updated_at: string;
}

// ─── DDL ──────────────────────────────────────────────────────────────────────

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

// ─── Repository ───────────────────────────────────────────────────────────────

export class DocumentRepository {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.exec(CREATE_TABLE_SQL);
  }

  /** Insert a new document record. created_at and updated_at are set automatically. */
  insert(doc: Omit<DocumentRecord, "createdAt" | "updatedAt">): DocumentRecord {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO documents (id, title, file_path, status, chunk_count, metadata, error_msg, created_at, updated_at)
      VALUES (@id, @title, @file_path, @status, @chunk_count, @metadata, @error_msg, @created_at, @updated_at)
    `);
    stmt.run({
      id: doc.id,
      title: doc.title,
      file_path: doc.filePath,
      status: doc.status,
      chunk_count: doc.chunkCount,
      metadata: JSON.stringify(doc.metadata ?? {}),
      error_msg: doc.errorMessage ?? null,
      created_at: now,
      updated_at: now,
    });
    return { ...doc, createdAt: now, updatedAt: now };
  }

  /** Update status (and optionally chunkCount / errorMessage) for a document. */
  updateStatus(
    id: string,
    status: DocumentRecord["status"],
    extra?: { chunkCount?: number; errorMessage?: string }
  ): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE documents
      SET status      = @status,
          updated_at  = @updated_at,
          chunk_count = COALESCE(@chunk_count, chunk_count),
          error_msg   = COALESCE(@error_msg,   error_msg)
      WHERE id = @id
    `);
    stmt.run({
      id,
      status,
      updated_at: now,
      chunk_count: extra?.chunkCount ?? null,
      error_msg: extra?.errorMessage ?? null,
    });
  }

  /** Return a single document by id, or null if not found. */
  findById(id: string): DocumentRecord | null {
    const stmt = this.db.prepare<[string], DocumentRow>(
      "SELECT * FROM documents WHERE id = ?"
    );
    const row = stmt.get(id);
    return row ? this.rowToRecord(row) : null;
  }

  /** Return all documents. */
  findAll(): DocumentRecord[] {
    const stmt = this.db.prepare<[], DocumentRow>("SELECT * FROM documents");
    return stmt.all().map((row) => this.rowToRecord(row));
  }

  /** Delete a document by id. */
  delete(id: string): void {
    this.db.prepare("DELETE FROM documents WHERE id = ?").run(id);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private rowToRecord(row: DocumentRow): DocumentRecord {
    return {
      id: row.id,
      title: row.title,
      filePath: row.file_path,
      status: row.status as DocumentRecord["status"],
      chunkCount: row.chunk_count,
      metadata: JSON.parse(row.metadata) as Record<string, unknown>,
      errorMessage: row.error_msg ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
