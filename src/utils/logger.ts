import pino from "pino";
import { config } from "../config/environment";

export const pinoOptions = {
  level: config.LOG_LEVEL,
  transport:
    config.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  formatters: {
    level: (label: string) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    req: (req: any) => ({
      method: req.method,
      url: req.url,
      headers: req.headers,
      hostname: req.hostname,
      remoteAddress: req.ip,
    }),
    res: (res: any) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
  },
};

export const logger = pino(pinoOptions);
