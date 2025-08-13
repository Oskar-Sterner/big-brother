export class BatchProcessor<T> {
  private batch: T[] = [];
  private batchSize: number;
  private flushInterval: number;
  private processor: (items: T[]) => Promise<void>;
  private timer: NodeJS.Timeout | null = null;
  private processing = false;

  constructor(
    batchSize: number,
    flushInterval: number,
    processor: (items: T[]) => Promise<void>
  ) {
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.processor = processor;
    this.startTimer();
  }

  async add(item: T): Promise<void> {
    this.batch.push(item);
    if (this.batch.length >= this.batchSize) {
      await this.flush();
    }
  }

  async addMany(items: T[]): Promise<void> {
    for (const item of items) {
      await this.add(item);
    }
  }

  private startTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = setInterval(() => {
      if (this.batch.length > 0 && !this.processing) {
        this.flush().catch(console.error);
      }
    }, this.flushInterval);
  }

  async flush(): Promise<void> {
    if (this.processing || this.batch.length === 0) {
      return;
    }

    this.processing = true;
    const items = [...this.batch];
    this.batch = [];

    try {
      await this.processor(items);
    } catch (error) {
      this.batch.unshift(...items);
      throw error;
    } finally {
      this.processing = false;
    }
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }

  getQueueSize(): number {
    return this.batch.length;
  }

  isProcessing(): boolean {
    return this.processing;
  }
}
