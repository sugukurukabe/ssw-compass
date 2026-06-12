import { describe, expect, it, vi } from "vitest";
import { createGracefulShutdownHandler } from "../src/index.js";

type CloseCallback = (err?: Error) => void;

function makeExitRecorder(): { exitCodes: number[]; exitProcess: (code: number) => never } {
  const exitCodes: number[] = [];
  return {
    exitCodes,
    exitProcess: (code: number): never => {
      exitCodes.push(code);
      return undefined as never;
    },
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("graceful shutdown", () => {
  it("does not force exit while httpServer.close is still draining requests", async () => {
    vi.useFakeTimers();
    try {
      let closeCallback: CloseCallback | undefined;
      const close = vi.fn<(callback: CloseCallback) => void>((callback) => {
        closeCallback = callback;
      });
      const shutdownOtel = vi.fn<() => Promise<void>>(async () => undefined);
      const { exitCodes, exitProcess } = makeExitRecorder();
      const gracefulShutdown = createGracefulShutdownHandler({
        httpServer: { close },
        shutdownOtel,
        exitProcess,
      });

      gracefulShutdown("SIGTERM");

      expect(close).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(shutdownOtel).not.toHaveBeenCalled();
      expect(exitCodes).toEqual([]);

      expect(closeCallback).toBeDefined();
      closeCallback?.();
      await flushMicrotasks();

      expect(shutdownOtel).toHaveBeenCalledTimes(1);
      expect(exitCodes).toEqual([0]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits for OTel shutdown before exiting after the HTTP server closes", async () => {
    vi.useFakeTimers();
    try {
      let closeCallback: CloseCallback | undefined;
      let resolveOtel: (() => void) | undefined;
      const close = vi.fn<(callback: CloseCallback) => void>((callback) => {
        closeCallback = callback;
      });
      const shutdownOtel = vi.fn<() => Promise<void>>(
        () =>
          new Promise<void>((resolve) => {
            resolveOtel = resolve;
          }),
      );
      const { exitCodes, exitProcess } = makeExitRecorder();
      const gracefulShutdown = createGracefulShutdownHandler({
        httpServer: { close },
        shutdownOtel,
        exitProcess,
      });

      gracefulShutdown("SIGTERM");
      expect(closeCallback).toBeDefined();
      closeCallback?.();
      await flushMicrotasks();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(shutdownOtel).toHaveBeenCalledTimes(1);
      expect(exitCodes).toEqual([]);

      expect(resolveOtel).toBeDefined();
      resolveOtel?.();
      await flushMicrotasks();

      expect(exitCodes).toEqual([0]);
    } finally {
      vi.useRealTimers();
    }
  });
});
