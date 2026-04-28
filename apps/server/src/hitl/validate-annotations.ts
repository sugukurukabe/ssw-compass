/**
 * 起動時 tool annotation バリデーション (ADR-014 §5)
 * Startup tool annotation validation
 * Validasi anotasi alat saat startup
 *
 * createMcpServer() 内で呼び出す。L2/L3 tool の mis-configuration を deploy 時に検出。
 * Called inside createMcpServer(). Detects L2/L3 tool mis-configuration at deploy time.
 * Dipanggil di dalam createMcpServer(). Mendeteksi konfigurasi salah alat L2/L3 saat deploy.
 */

import type { SswCompassToolAnnotation } from "@ssw/shared-types";

export class ToolAnnotationConfigError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly reason: string,
  ) {
    super(`Tool "${toolName}" annotation error: ${reason}`);
    this.name = "ToolAnnotationConfigError";
  }
}

type AnnotatedTool = {
  name: string;
  annotations: SswCompassToolAnnotation;
};

/**
 * 全ツールの annotation を検証し、違反があれば ToolAnnotationConfigError を throw する。
 *
 * ルール (ADR-014 / v4 §4.2):
 * 1. L2/L3 → requiresGyoseishoshiAuth=true
 * 2. L2/L3 → hitlControls に H01_DRAFT_LOCKGATE を含む
 * 3. pro/business tier → hitlControls に H04_AUDIT_LOG_7Y を含む
 * 4. anonymous/free tier → requiresGyoseishoshiAuth=false
 */
export function validateToolAnnotations(tools: ReadonlyArray<AnnotatedTool>): void {
  for (const tool of tools) {
    const { name, annotations: ann } = tool;
    const level = ann.legalLevel;

    if (level === "L2" || level === "L3") {
      if (!ann.requiresGyoseishoshiAuth) {
        throw new ToolAnnotationConfigError(
          name,
          `legalLevel=${level} requires requiresGyoseishoshiAuth=true`,
        );
      }
      if (!ann.hitlControls.includes("H01_DRAFT_LOCKGATE")) {
        throw new ToolAnnotationConfigError(
          name,
          `legalLevel=${level} requires H01_DRAFT_LOCKGATE in hitlControls`,
        );
      }
    }

    if (ann.tier === "pro" || ann.tier === "business") {
      if (!ann.hitlControls.includes("H04_AUDIT_LOG_7Y")) {
        throw new ToolAnnotationConfigError(
          name,
          `tier=${ann.tier} requires H04_AUDIT_LOG_7Y in hitlControls`,
        );
      }
    }

    if ((level === "L0" || level === "L1") && ann.requiresGyoseishoshiAuth) {
      throw new ToolAnnotationConfigError(
        name,
        `legalLevel=${level} must NOT require gyoseishoshi auth (L2/L3 only)`,
      );
    }
  }
}
