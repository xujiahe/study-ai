export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export class RagClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  async retrieve(query: string, k = 4): Promise<string> {
    const response = await this.request<{ results: Array<{ content: string; source: string }> }>(
      "POST",
      "/retrieve",
      { query, k }
    );

    return response.results
      .map((r, i) => `[${i + 1}] (${r.source})\n${r.content}`)
      .join("\n\n---\n\n");
  }

  async uploadDocument(
    text: string,
    title: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    const response = await this.request<{ docId: string }>(
      "POST",
      "/documents",
      { text, title, metadata }
    );
    return response.docId;
  }

  async waitForReady(docId: string, timeoutMs = 60000): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const status = await this.request<{ status: string; errorMessage?: string }>(
        "GET",
        `/documents/${docId}/status`
      );

      if (status.status === "ready") return;
      if (status.status === "error") {
        throw new Error(`Document indexing failed: ${status.errorMessage ?? "unknown error"}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new TimeoutError(`Timed out waiting for document ${docId} to be ready`);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
      },
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const res = await fetch(url, init);

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${errorBody}`);
    }

    return res.json() as Promise<T>;
  }
}
