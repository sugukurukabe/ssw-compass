import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("vcj-mcp", "1.0.0");

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

export function instrumentTool<T>(
  name: string,
  fn: (args: unknown) => Promise<T>,
): (args: unknown) => Promise<T> {
  return async (args: unknown): Promise<T> =>
    tracer.startActiveSpan(`tools/call ${name}`, { kind: SpanKind.SERVER }, async (span) => {
      span.setAttributes({
        "mcp.method.name": "tools/call",
        "gen_ai.tool.name": name,
      });
      const t0 = performance.now();
      try {
        const result = await fn(args);
        span.setAttribute("mcp.tool.duration_ms", performance.now() - t0);
        return result;
      } catch (e: unknown) {
        const err = toErrorLike(e);
        if (e instanceof Error) {
          span.recordException(e);
        }
        span.setAttribute("error.type", err.code ?? "INTERNAL");
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        throw e;
      } finally {
        span.end();
      }
    });
}
