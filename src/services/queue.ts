import { redis } from "../config/redis";
import { logger } from "../utils/logger";
import { QueueMessage } from "../types";

export class QueueService {
  private processing = new Map<string, boolean>();
  private handlers = new Map<
    string,
    (message: QueueMessage) => Promise<void>
  >();

  constructor(private queueName: string) {}

  async enqueue<T>(
    type: string,
    payload: T,
    options?: { priority?: number; delay?: number }
  ): Promise<string> {
    const message: QueueMessage<T> = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 3,
    };

    const serialized = JSON.stringify(message);
    const queueKey = `queue:${this.queueName}`;

    if (options?.delay) {
      await redis.zadd(
        `${queueKey}:delayed`,
        Date.now() + options.delay,
        serialized
      );
    } else if (options?.priority) {
      await redis.zadd(`${queueKey}:priority`, options.priority, serialized);
    } else {
      await redis.lpush(queueKey, serialized);
    }

    logger.debug({ messageId: message.id, type }, "Message enqueued");
    return message.id;
  }

  async dequeue(): Promise<QueueMessage | null> {
    const queueKey = `queue:${this.queueName}`;

    // Check delayed queue
    const delayed = await redis.zrangebyscore(
      `${queueKey}:delayed`,
      0,
      Date.now(),
      "LIMIT",
      0,
      1
    );

    if (delayed.length > 0) {
      await redis.zrem(`${queueKey}:delayed`, delayed[0]);
      return JSON.parse(delayed[0]);
    }

    // Check priority queue
    const priority = await redis.zpopmax(`${queueKey}:priority`);
    if (priority.length > 0) {
      return JSON.parse(priority[0]);
    }

    // Check regular queue
    const message = await redis.rpop(queueKey);
    if (message) {
      return JSON.parse(message);
    }

    return null;
  }

  registerHandler(
    type: string,
    handler: (message: QueueMessage) => Promise<void>
  ): void {
    this.handlers.set(type, handler);
  }

  async startProcessing(concurrency: number = 1): Promise<void> {
    for (let i = 0; i < concurrency; i++) {
      this.processMessages(i);
    }
  }

  private async processMessages(workerId: number): Promise<void> {
    const workerKey = `worker:${workerId}`;
    this.processing.set(workerKey, true);

    while (this.processing.get(workerKey)) {
      try {
        const message = await this.dequeue();

        if (!message) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        const handler = this.handlers.get(message.type);

        if (!handler) {
          logger.warn(
            { messageType: message.type },
            "No handler for message type"
          );
          await this.deadLetter(message);
          continue;
        }

        try {
          await handler(message);
          logger.debug(
            { messageId: message.id },
            "Message processed successfully"
          );
        } catch (error) {
          logger.error(
            { error, messageId: message.id },
            "Error processing message"
          );
          await this.retry(message);
        }
      } catch (error) {
        logger.error({ error, workerId }, "Worker error");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async retry(message: QueueMessage): Promise<void> {
    message.retries++;

    if (message.retries >= message.maxRetries) {
      await this.deadLetter(message);
      return;
    }

    const delay = Math.pow(2, message.retries) * 1000;
    await this.enqueue(message.type, message.payload, { delay });
  }

  private async deadLetter(message: QueueMessage): Promise<void> {
    const dlqKey = `dlq:${this.queueName}`;
    await redis.lpush(
      dlqKey,
      JSON.stringify({
        ...message,
        failedAt: Date.now(),
      })
    );

    logger.error(
      { messageId: message.id },
      "Message sent to dead letter queue"
    );
  }

  async stopProcessing(): Promise<void> {
    for (const key of this.processing.keys()) {
      this.processing.set(key, false);
    }
  }

  async getQueueSize(): Promise<{
    regular: number;
    priority: number;
    delayed: number;
    dlq: number;
  }> {
    const queueKey = `queue:${this.queueName}`;
    const [regular, priority, delayed, dlq] = await Promise.all([
      redis.llen(queueKey),
      redis.zcard(`${queueKey}:priority`),
      redis.zcard(`${queueKey}:delayed`),
      redis.llen(`dlq:${this.queueName}`),
    ]);

    return { regular, priority, delayed, dlq };
  }

  async clearQueue(): Promise<void> {
    const queueKey = `queue:${this.queueName}`;
    await Promise.all([
      redis.del(queueKey),
      redis.del(`${queueKey}:priority`),
      redis.del(`${queueKey}:delayed`),
    ]);
  }

  async reprocessDLQ(): Promise<number> {
    const dlqKey = `dlq:${this.queueName}`;
    const queueKey = `queue:${this.queueName}`;

    const messages = await redis.lrange(dlqKey, 0, -1);

    if (messages.length > 0) {
      await redis.rpush(queueKey, ...messages);
      await redis.del(dlqKey);
    }

    return messages.length;
  }
}

export const eventQueue = new QueueService("events");
export const metricQueue = new QueueService("metrics");
