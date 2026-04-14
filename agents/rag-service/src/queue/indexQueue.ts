import type { Indexer } from "../indexer/indexer.js";
import type { DocumentRepository } from "../db/documentRepo.js";
import type { IndexJob } from "../types.js";

export class IndexQueue {
  private queue: IndexJob[] = [];
  private running: number = 0;
  private onCompleteHandlers: ((docId: string) => void)[] = [];
  private onErrorHandlers: ((docId: string, error: Error) => void)[] = [];

  constructor(
    private readonly indexer: Indexer,
    private readonly repo: DocumentRepository,
    private readonly concurrency: number
  ) {}

  enqueue(job: IndexJob): void {
    this.queue.push(job);
    this._drain();
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  onJobComplete(handler: (docId: string) => void): void {
    this.onCompleteHandlers.push(handler);
  }

  onJobError(handler: (docId: string, error: Error) => void): void {
    this.onErrorHandlers.push(handler);
  }

  _drain(): void {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.running++;
      // fire-and-forget
      void this._process(job);
    }
  }

  async _process(job: IndexJob): Promise<void> {
    await this.repo.updateStatus(job.docId, "indexing");
    try {
      const result = await this.indexer.processDocument(job);
      await this.repo.updateStatus(job.docId, "ready", {
        chunkCount: result.chunkCount,
      });
      for (const handler of this.onCompleteHandlers) {
        handler(job.docId);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      await this.repo.updateStatus(job.docId, "error", {
        errorMessage: error.message,
      });
      for (const handler of this.onErrorHandlers) {
        handler(job.docId, error);
      }
    } finally {
      this.running--;
      this._drain();
    }
  }
}
