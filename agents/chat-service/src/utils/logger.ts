type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  ts: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

function formatEntry(entry: LogEntry): string {
  const base = `[${entry.ts}] [${entry.level.toUpperCase()}] ${entry.message}`;
  if (entry.data !== undefined) {
    const dataStr =
      entry.data instanceof Error
        ? `${entry.data.message}\n${entry.data.stack ?? ""}`
        : JSON.stringify(entry.data);
    return `${base} ${dataStr}`;
  }
  return base;
}

function log(level: LogLevel, message: string, data?: unknown): void {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    message,
    data,
  };
  const formatted = formatEntry(entry);
  if (level === "error") {
    console.error(formatted);
  } else if (level === "warn") {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

export const logger = {
  info: (message: string, data?: unknown) => log("info", message, data),
  warn: (message: string, data?: unknown) => log("warn", message, data),
  error: (message: string, data?: unknown) => log("error", message, data),
  debug: (message: string, data?: unknown) => {
    if (process.env["NODE_ENV"] !== "production") {
      log("debug", message, data);
    }
  },
};
