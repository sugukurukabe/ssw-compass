/**
 * OpenTelemetry NodeSDK のブートストラップ (可観測性)。
 * OpenTelemetry NodeSDK bootstrap for observability.
 * Bootstrap NodeSDK OpenTelemetry untuk observabilitas.
 *
 * otel.ts は instrumentTool() で span を生成するが、SDK (TracerProvider +
 * exporter) を起動しないと span は no-op だった。本モジュールが NodeSDK と
 * OTLP exporter を初期化し、生成済みの span を実際にエクスポートする。
 *
 * 既定では無効。以下のいずれかで有効化する (ローカル/CI/テストでは無効のまま):
 * - `OTEL_SDK_ENABLED=true`
 * - `OTEL_EXPORTER_OTLP_ENDPOINT` を設定 (例: Cloud Run の OTel collector sidecar)
 *
 * Cloud Trace へは OTLP collector (googlecloud exporter) 経由で送る想定。
 * 実行 SA は roles/cloudtrace.agent を保有済み (infra/terraform)。
 */

import { logger } from "./logger.js";

let started = false;

function isEnabled(): boolean {
  if (process.env["OTEL_SDK_ENABLED"] === "true") return true;
  const endpoint = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];
  return endpoint !== undefined && endpoint.length > 0;
}

/**
 * NodeSDK を一度だけ起動する。無効時・初期化失敗時は安全に no-op で返す。
 * Starts the NodeSDK once; safely no-ops when disabled or on failure.
 * Memulai NodeSDK sekali; aman no-op saat dinonaktifkan atau gagal.
 */
export async function initOtelSdk(): Promise<void> {
  if (started) return;
  if (!isEnabled()) {
    logger.info({ event: "otel_sdk_disabled" }, "otel_sdk_disabled");
    return;
  }
  if (process.env["OTEL_SERVICE_NAME"] === undefined) {
    process.env["OTEL_SERVICE_NAME"] = "ssw-mcp";
  }
  try {
    // 重い SDK は有効時のみ dynamic import する (ローカル/テストの負荷回避)。
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
    const sdk = new NodeSDK({ traceExporter: new OTLPTraceExporter() });
    sdk.start();
    started = true;
    logger.info(
      {
        event: "otel_sdk_started",
        endpoint: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] ?? "default(localhost:4318)",
        service: process.env["OTEL_SERVICE_NAME"],
      },
      "otel_sdk_started",
    );
    const shutdown = (): void => {
      void sdk.shutdown().finally(() => process.exit(0));
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ event: "otel_sdk_init_failed", err: message }, "otel_sdk_init_failed");
  }
}
