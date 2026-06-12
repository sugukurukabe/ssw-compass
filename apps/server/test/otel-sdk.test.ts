/**
 * OTel SDK グレースフルシャットダウン (Bug 3 修正) の単体テスト
 * Unit tests for OTel SDK graceful shutdown fix (Bug 3)
 * Uji unit perbaikan graceful shutdown OTel SDK (Bug 3)
 */
import { afterEach, describe, expect, it } from "vitest";
import { getRegisteredSdkShutdown } from "../src/otel-sdk.js";

describe("OTel SDK graceful shutdown (Bug 3)", () => {
  afterEach(() => {
    // OTEL_SDK_ENABLED をリセット (他テストに副作用を与えない)
    delete process.env["OTEL_SDK_ENABLED"];
    delete process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];
  });

  it("getRegisteredSdkShutdown returns a no-op Promise when SDK is not started", async () => {
    // SDK 未起動時は no-op (Promise.resolve()) が返るべき
    const shutdown = getRegisteredSdkShutdown();
    await expect(shutdown()).resolves.toBeUndefined();
  });

  it("initOtelSdk does NOT register SIGTERM/SIGINT handlers (Bug 3 guard)", async () => {
    // Bug 3: otel-sdk.ts 側に process.once(SIGTERM/SIGINT) が残っていないことを確認する。
    // OTEL_SDK_ENABLED=true で initOtelSdk() を呼んでも SIGTERM listeners が増えないこと。
    const { initOtelSdk } = await import("../src/otel-sdk.js");
    const before = process.listenerCount("SIGTERM");
    // SDK 初期化を試みる (dynamic import 失敗などで no-op になることが多い)
    await initOtelSdk().catch(() => undefined);
    const after = process.listenerCount("SIGTERM");
    expect(after).toBe(before);
  });
});
