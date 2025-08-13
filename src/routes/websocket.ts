import { FastifyPluginAsync } from "fastify";
import { WebSocket } from "ws";
import { subClient } from "../config/redis";
import { RealtimeSubscriptionSchema } from "../schemas/metric.schema";

export const websocketRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/realtime", { websocket: true }, (connection, req) => {
    const socket = connection as WebSocket;
    const subscriptions = new Set<string>();
    let isAlive = true;

    const heartbeat = setInterval(() => {
      if (!isAlive) {
        clearInterval(heartbeat);
        socket.terminate();
        return;
      }
      isAlive = false;
      socket.ping();
    }, 30000);

    socket.on("pong", () => {
      isAlive = true;
    });

    socket.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === "subscribe") {
          const validated = RealtimeSubscriptionSchema.parse(data.payload);

          for (const metric of validated.metrics) {
            const channel = `metrics:${metric}`;
            subscriptions.add(channel);
            await subClient.subscribe(channel);
          }

          socket.send(
            JSON.stringify({
              type: "subscribed",
              channels: Array.from(subscriptions),
            })
          );
        }

        if (data.type === "unsubscribe") {
          for (const metric of data.metrics || []) {
            const channel = `metrics:${metric}`;
            subscriptions.delete(channel);
            await subClient.unsubscribe(channel);
          }

          socket.send(
            JSON.stringify({
              type: "unsubscribed",
              channels: data.metrics,
            })
          );
        }

        if (data.type === "ping") {
          socket.send(JSON.stringify({ type: "pong" }));
        }
      } catch (error) {
        socket.send(
          JSON.stringify({
            type: "error",
            message: "Invalid message format",
          })
        );
      }
    });

    subClient.on("message", (channel, message) => {
      if (subscriptions.has(channel)) {
        socket.send(
          JSON.stringify({
            type: "data",
            channel,
            data: JSON.parse(message),
            timestamp: Date.now(),
          })
        );
      }
    });

    socket.on("close", async () => {
      clearInterval(heartbeat);
      for (const channel of subscriptions) {
        await subClient.unsubscribe(channel);
      }
    });

    socket.send(
      JSON.stringify({
        type: "connected",
        timestamp: Date.now(),
      })
    );
  });
};
