import { createGcpLoggingPinoConfig } from "@google-cloud/pino-logging-gcp-config";
import { type Logger, pino } from "pino";

const serviceVersion = process.env["K_REVISION"] ?? "dev";
const logLevel = process.env["LOG_LEVEL"] ?? "info";

export const logger: Logger = pino(
  createGcpLoggingPinoConfig(
    {
      serviceContext: {
        service: "ssw-mcp",
        version: serviceVersion,
      },
    },
    {
      level: logLevel,
      redact: {
        paths: ["*.email", "*.passport", "*.dob", "*.phone", "*.zairyu", "args", "input", "query"],
        censor: "[REDACTED]",
      },
    },
  ),
);
