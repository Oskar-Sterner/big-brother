import { Event } from "../schemas/event.schema";

export abstract class BaseProcessor {
  abstract name: string;
  abstract shouldProcess(event: Event): boolean;
  abstract process(event: Event): Promise<void>;

  protected validateEvent(event: Event): boolean {
    return !!(event.type && event.timestamp);
  }

  protected async logProcessing(event: Event): Promise<void> {
    console.log(`[${this.name}] Processing event: ${event.type}`);
  }

  protected async handleError(error: Error, event: Event): Promise<void> {
    console.error(`[${this.name}] Error processing event:`, error, event);
  }
}
