/**
 * 异步索引队列
 *
 * 职责：
 *   - 解耦文档上传与向量化，上传接口立即返回 202，向量化在后台异步执行
 *   - FIFO 顺序处理任务
 *   - 通过 concurrency 参数控制同时执行的任务数（默认 2）
 *
 * 状态流转：
 *   pending → indexing → ready
 *                     ↘ error（Embedding API 失败等）
 */
import type { Indexer } from "../indexer/indexer.js";
import type { DocumentRepository } from "../db/documentRepo.js";
import type { IndexJob } from "../types.js";

export class IndexQueue {
  /** 等待处理的任务列表（FIFO） */
  private queue: IndexJob[] = [];
  /** 当前正在执行的任务数 */
  private running: number = 0;
  /** 任务完成回调列表 */
  private onCompleteHandlers: ((docId: string) => void)[] = [];
  /** 任务失败回调列表 */
  private onErrorHandlers: ((docId: string, error: Error) => void)[] = [];

  constructor(
    private readonly indexer: Indexer,
    private readonly repo: DocumentRepository,
    private readonly concurrency: number
  ) {}

  /** 将任务加入队列末尾，并尝试立即触发执行 */
  enqueue(job: IndexJob): void {
    this.queue.push(job);
    this._drain();
  }

  /** 返回当前等待中的任务数（不含正在执行的） */
  getQueueLength(): number {
    return this.queue.length;
  }

  /** 注册任务完成回调 */
  onJobComplete(handler: (docId: string) => void): void {
    this.onCompleteHandlers.push(handler);
  }

  /** 注册任务失败回调 */
  onJobError(handler: (docId: string, error: Error) => void): void {
    this.onErrorHandlers.push(handler);
  }

  /**
   * 消费队列：在并发上限内尽可能多地启动任务
   * 每次任务完成后会再次调用 _drain，确保队列持续消费
   */
  _drain(): void {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.running++;
      void this._process(job); // fire-and-forget，不阻塞
    }
  }

  /** 执行单个索引任务，更新 DB 状态，完成后触发回调 */
  async _process(job: IndexJob): Promise<void> {
    // 标记为索引中
    await this.repo.updateStatus(job.docId, "indexing");
    try {
      // 执行分块 + Embedding + 写入 Milvus
      const result = await this.indexer.processDocument(job);
      // 成功：更新状态为 ready，记录 chunk 数量
      await this.repo.updateStatus(job.docId, "ready", { chunkCount: result.chunkCount });
      for (const handler of this.onCompleteHandlers) handler(job.docId);
    } catch (err) {
      // 失败：更新状态为 error，记录错误信息
      const error = err instanceof Error ? err : new Error(String(err));
      await this.repo.updateStatus(job.docId, "error", { errorMessage: error.message });
      for (const handler of this.onErrorHandlers) handler(job.docId, error);
    } finally {
      this.running--;
      this._drain(); // 任务结束后继续消费队列
    }
  }
}
