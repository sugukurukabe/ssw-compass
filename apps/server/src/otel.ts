import { context, propagation, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("ssw-mcp", "1.0.0");

interface ErrorLike {
  code: string | undefined;
  message: string;
}

function toErrorLike(value: unknown): ErrorLike {
  if (value instanceof Error) {
    const maybeCode = (value as Error & { code?: unknown }).code;
    return {
      code: typeof maybeCode === "string" ? maybeCode : undefined,
      message: value.message,
    };
  }
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const code = typeof obj["code"] === "string" ? (obj["code"] as string) : undefined;
    const message = typeof obj["message"] === "string" ? (obj["message"] as string) : String(value);
    return { code, message };
  }
  return { code: undefined, message: String(value) };
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function extractStringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function extractTraceCarrier(args: unknown): Record<string, string> | undefined {
  const root = objectRecord(args);
  const meta = objectRecord(root?.["_meta"]);
  if (meta === null) {
    return undefined;
  }
  const carrier: Record<string, string> = {};
  for (const key of ["traceparent", "tracestate", "baggage"]) {
    const value = extractStringField(meta, key);
    if (value !== undefined) {
      carrier[key] = value;
    }
  }
  return Object.keys(carrier).length > 0 ? carrier : undefined;
}

function extractRequestState(args: unknown): string | undefined {
  const root = objectRecord(args);
  return root === null ? undefined : extractStringField(root, "requestState");
}

function extractRelatedTaskId(args: unknown): string | undefined {
  const root = objectRecord(args);
  const meta = objectRecord(root?.["_meta"]);
  const relatedTask = objectRecord(meta?.["io.modelcontextprotocol/related-task"]);
  return relatedTask === null ? undefined : extractStringField(relatedTask, "taskId");
}

export function instrumentTool<T>(
  name: string,
  fn: (args: unknown) => Promise<T>,
): (args: unknown) => Promise<T> {
  return async (args: unknown): Promise<T> => {
    const carrier = extractTraceCarrier(args);
    const parentContext =
      carrier === undefined ? context.active() : propagation.extract(context.active(), carrier);

    return tracer.startActiveSpan(
      `tools/call ${name}`,
      { kind: SpanKind.SERVER },
      parentContext,
      async (span) => {
        span.setAttributes({
          "mcp.method.name": "tools/call",
          "gen_ai.tool.name": name,
        });
        const requestState = extractRequestState(args);
        if (requestState !== undefined) {
          span.setAttribute("mcp.request_state.id", requestState);
        }
        const taskId = extractRelatedTaskId(args);
        if (taskId !== undefined) {
          span.setAttribute("mcp.task.id", taskId);
        }
        const t0 = performance.now();
        try {
          const result = await fn(args);
          span.setAttribute("mcp.tool.duration_ms", performance.now() - t0);
          return result;
        } catch (e: unknown) {
          const err = toErrorLike(e);
          // 例外の生メッセージ・スタックには echo されたユーザー入力 (PII) や
          // シークレットが含まれうるため span には載せない。非 PII な error.type のみ記録する。
          // Raw exception messages/stacktraces may carry echoed user input (PII) or
          // secrets, so they are never placed on the span — only the non-PII error.type.
          // Pesan/stacktrace exception mentah bisa memuat input pengguna (PII) atau
          // rahasia, jadi tidak ditaruh di span — hanya error.type non-PII yang dicatat.
          const errorType = err.code ?? "INTERNAL";
          span.recordException({ name: errorType, message: errorType });
          span.setAttribute("error.type", errorType);
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw e;
        } finally {
          span.end();
        }
      },
    );
  };
}
