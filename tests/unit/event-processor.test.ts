/// <reference types="bun-types" />
import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
// Type definition is now properly referenced above the imports
import { EventProcessorService } from "../../src/services/event-processor";
import { Event } from "../../src/schemas/event.schema";

describe("EventProcessorService", () => {
  let eventProcessor: EventProcessorService;

  beforeEach(() => {
    eventProcessor = new EventProcessorService();
  });

  afterEach(async () => {
    await eventProcessor.shutdown();
  });

  describe("processEvent", () => {
    test("should process a valid event", async () => {
      const event: Event = {
        type: "pageview",
        metadata: {
          page: "/home",
          referrer: "google.com",
        },
        userId: "user123",
        sessionId: "session456",
      };

      await expect(eventProcessor.processEvent(event)).resolves.not.toThrow();
    });

    test("should enrich event with timestamp if not provided", async () => {
      const event: Event = {
        type: "click",
        metadata: {
          button: "signup",
        },
      };

      const enrichSpy = mock(() => {});

      await eventProcessor.processEvent(event);

      // Verify timestamp was added
      expect(event.timestamp).toBeDefined();
    });

    test("should handle batch processing", async () => {
      const events: Event[] = Array.from({ length: 100 }, (_, i) => ({
        type: "api_call",
        metadata: {
          endpoint: `/api/test${i}`,
          method: "GET",
        },
        duration: Math.random() * 100,
      }));

      const promises = events.map((e) => eventProcessor.processEvent(e));
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });

  describe("getQueueStatus", () => {
    test("should return queue status", async () => {
      const status = await eventProcessor.getQueueStatus();

      expect(status).toHaveProperty("queueSize");
      expect(status).toHaveProperty("isProcessing");
      expect(typeof status.queueSize).toBe("number");
      expect(typeof status.isProcessing).toBe("boolean");
    });
  });

  describe("error handling", () => {
    test("should handle processing errors gracefully", async () => {
      const invalidEvent = {
        type: "invalid_type",
        metadata: null,
      } as any;

      await expect(eventProcessor.processEvent(invalidEvent)).rejects.toThrow();
    });
  });
});
