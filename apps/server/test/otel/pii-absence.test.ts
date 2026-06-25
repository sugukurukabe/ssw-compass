/**
 * OpenTelemetry 計装の PII / シークレット不在テスト (T7)。
 * PII / secret absence tests for the OpenTelemetry instrumentation (T7).
 * Uji ketiadaan PII / rahasia untuk instrumentasi OpenTelemetry (T7).
 *
 * 目的: instrumentTool() が生成する span の属性・イベント・ステータスに、
 * PII (在留カード番号・パスポート番号・マイナンバー・氏名・生年月日) や
 * シークレット (JWT・service account key) が一切載らないことを保証する。
 * 将来の計装変更で誤って PII を span に載せたら CI で検知できるようにする。
 *
 * Goal: guarantee that spans produced by instrumentTool() never carry PII
 * (residence card / passport / My Number / name / DOB) or secrets (JWT,
 * service-account key) in their attributes, events, or status — so any future
 * instrumentation change that leaks PII onto a span is caught in CI.
 *
 * 検証方式 / Verification approach / Pendekatan verifikasi:
 *  1. 許可リスト: span 属性キー集合が非 PII メタのみに収まること。
 *     Allow-list: span attribute keys stay within the non-PII metadata set.
 *  2. PII 非出現: PII を含む引数・例外でも span に当該文字列が現れないこと。
 *     PII non-appearance: PII in args/exceptions never appears on the span.
 *  3. シークレット非出現: JWT / SA key が span に現れないこと。
 *     Secret non-appearance: JWT / SA key never appears on the span.
 *
 * InMemorySpanExporter を登録し、実 span をエクスポートして属性を直接検査する。
 * Registers an InMemorySpanExporter to export real spans and inspect them.
 */
import { trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  type ReadableSpan,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

// otel.ts は import 時に `trace.getTracer()` を呼ぶため、グローバル TracerProvider を
// 登録した後に動的 import する。静的 import だと no-op の ProxyTracer を掴んでしまい
// span がエクスポートされない。
// otel.ts calls `trace.getTracer()` at import time, so we register the global
// TracerProvider first and then dynamically import it; a static import would
// capture a no-op ProxyTracer and never export spans.
type InstrumentTool = typeof import("../../src/otel.js").instrumentTool;
let instrumentTool: InstrumentTool;

// instrumentTool が span に設定してよい属性キーの許可リスト (すべて非 PII メタ)。
// Allow-list of attribute keys instrumentTool may set (all non-PII metadata).
// Daftar izin kunci atribut yang boleh diset instrumentTool (semua meta non-PII).
const ALLOWED_ATTRIBUTE_KEYS: ReadonlySet<string> = new Set([
  "mcp.method.name",
  "gen_ai.tool.name",
  "mcp.request_state.id",
  "mcp.task.id",
  "mcp.tool.duration_ms",
  "error.type",
]);

// 明らかにダミーの PII / シークレット文字列 (実在しない)。
// Obviously fake PII / secret strings (not real values).
// String PII / rahasia yang jelas-jelas palsu (bukan nilai asli).
const PII = {
  zairyu: "AB12345678CD",
  passport: "AB1234567",
  myNumber: "123456789012",
  name: "山田太郎",
  dob: "1990-01-15",
} as const;

const DUMMY_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXBpaSJ9.c2lnbmF0dXJlX2R1bW15X3Rlc3Q";
const DUMMY_SA_KEY =
  "-----BEGIN PRIVATE KEY-----MIIdummyFAKEkeyMaterialForTestOnly-----END PRIVATE KEY-----";

const SENSITIVE_VALUES: readonly string[] = [...Object.values(PII), DUMMY_JWT, DUMMY_SA_KEY];

const exporter = new InMemorySpanExporter();
let provider: BasicTracerProvider;

beforeAll(async () => {
  // 同一ワーカー内の他テストが既にグローバル TracerProvider を登録していると
  // register() は二重登録で無視されるため、一度 disable してから登録する。
  // Clear any global provider another test in this worker may have registered,
  // otherwise register() is ignored as a duplicate and our exporter sees no spans.
  trace.disable();
  provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  provider.register();
  // 登録後に動的 import して、otel.ts が実トレーサーを掴むようにする。
  // Import after registration so otel.ts binds to the real tracer.
  ({ instrumentTool } = await import("../../src/otel.js"));
});

afterEach(() => {
  exporter.reset();
});

afterAll(async () => {
  await provider.shutdown();
  trace.disable();
});

/**
 * code 付きの Error を生成する (error.type 検証用)。`any` を使わず型安全に。
 * Builds an Error carrying a `code` (for error.type checks) without `any`.
 * Membuat Error dengan `code` (untuk cek error.type) tanpa `any`.
 */
function errorWithCode(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

/**
 * instrumentTool でラップした fn を実行し、エクスポートされた最新 span を返す。
 * 例外経路も span を生成するため throw は握り潰す。
 * Runs an instrumentTool-wrapped fn and returns the latest exported span;
 * swallows throws because the error path still produces a span.
 */
async function captureSpan(
  name: string,
  fn: (args: unknown) => Promise<unknown>,
  args: unknown,
): Promise<ReadableSpan> {
  try {
    await instrumentTool(name, fn)(args);
  } catch {
    // 例外経路の span を検査するため意図的に握り潰す。
    // Intentionally swallow to inspect the error-path span.
  }
  const span = exporter.getFinishedSpans().at(-1);
  if (span === undefined) {
    throw new Error("expected at least one exported span");
  }
  return span;
}

/**
 * span の検査対象 (属性・ステータス・イベント) を 1 つの文字列に直列化する。
 * Serializes the inspectable parts of a span (attributes/status/events).
 */
function serializeSpan(span: ReadableSpan): string {
  return JSON.stringify({
    name: span.name,
    attributes: span.attributes,
    status: span.status,
    events: span.events.map((event) => ({
      name: event.name,
      attributes: event.attributes,
    })),
  });
}

function expectNoSensitive(haystack: string): void {
  for (const value of SENSITIVE_VALUES) {
    expect(haystack).not.toContain(value);
  }
}

describe("instrumentTool — span attribute allow-list", () => {
  it("success span exposes only allow-listed, non-PII attribute keys", async () => {
    const span = await captureSpan("search_visa", async () => ({ ok: true }), {
      requestState: "rs-clean-001",
      _meta: {
        "io.modelcontextprotocol/related-task": { taskId: "task-clean-001" },
      },
    });

    for (const key of Object.keys(span.attributes)) {
      expect(ALLOWED_ATTRIBUTE_KEYS.has(key), `unexpected span attribute key: ${key}`).toBe(true);
    }
    expect(Object.keys(span.attributes)).toEqual(
      expect.arrayContaining([
        "mcp.method.name",
        "gen_ai.tool.name",
        "mcp.tool.duration_ms",
        "mcp.request_state.id",
        "mcp.task.id",
      ]),
    );
  });

  it("error span exposes only allow-listed keys and a non-PII error.type", async () => {
    const span = await captureSpan(
      "search_visa",
      async () => {
        throw errorWithCode("boom", "VALIDATION_ERROR");
      },
      { requestState: "rs-clean-002" },
    );

    for (const key of Object.keys(span.attributes)) {
      expect(ALLOWED_ATTRIBUTE_KEYS.has(key), `unexpected span attribute key: ${key}`).toBe(true);
    }
    expect(span.attributes["error.type"]).toBe("VALIDATION_ERROR");
  });
});

describe("instrumentTool — PII never reaches spans", () => {
  it("PII embedded in raw tool arguments does not appear on the span", async () => {
    const span = await captureSpan("search_visa", async () => ({ ok: true }), {
      query: `applicant ${PII.name}`,
      note: `zairyu ${PII.zairyu} / passport ${PII.passport}`,
      birthDate: PII.dob,
      individualNumber: PII.myNumber,
      requestState: "rs-clean-003",
    });

    expectNoSensitive(serializeSpan(span));
  });

  it("PII echoed inside a thrown error message is not recorded on the span", async () => {
    const span = await captureSpan(
      "search_visa",
      async () => {
        throw errorWithCode(
          `rejected zairyu=${PII.zairyu} passport=${PII.passport} myNumber=${PII.myNumber} name=${PII.name} dob=${PII.dob}`,
          "PII_DETECTED",
        );
      },
      { requestState: "rs-clean-004" },
    );

    expectNoSensitive(serializeSpan(span));
    expect(span.attributes["error.type"]).toBe("PII_DETECTED");
  });

  it("records a redacted exception event carrying only the non-PII error type", async () => {
    const span = await captureSpan(
      "search_visa",
      async () => {
        // 例外メッセージ・スタックに PII 形状の文字列を含めても span に出ないこと。
        throw errorWithCode(`leaky message ${PII.passport}`, "RATE_LIMIT");
      },
      { requestState: "rs-clean-005" },
    );

    const exceptionEvent = span.events.find((event) => event.name === "exception");
    expect(exceptionEvent).toBeDefined();
    expect(exceptionEvent?.attributes?.["exception.message"]).toBe("RATE_LIMIT");
    expect(exceptionEvent?.attributes?.["exception.stacktrace"]).toBeUndefined();
    expectNoSensitive(serializeSpan(span));
  });
});

describe("instrumentTool — secrets never reach spans", () => {
  it("a JWT in args and a service-account key in a thrown error are not recorded", async () => {
    const span = await captureSpan(
      "search_visa",
      async () => {
        throw errorWithCode(`upstream rejected key ${DUMMY_SA_KEY}`, "UPSTREAM_ERROR");
      },
      { authorization: `Bearer ${DUMMY_JWT}`, requestState: "rs-clean-006" },
    );

    expectNoSensitive(serializeSpan(span));
    expect(span.attributes["error.type"]).toBe("UPSTREAM_ERROR");
  });
});
