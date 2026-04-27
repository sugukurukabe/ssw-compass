import type { ClassifyProcedureInput } from "@ssw/shared-types";
import type { ClassifyDecision } from "./decision-tree.js";

export {
  ClassifyProcedureInput,
  ClassifyProcedureOutput,
} from "@ssw/shared-types";

/**
 * Build the Vertex AI Search query for a classify_procedure request.
 * Combines the decided procedure type with the input context so the retriever
 * surfaces grounding documents that match both the procedure and, if provided,
 * the industry sector.
 */
export function buildClassifyQuery(
  args: ClassifyProcedureInput,
  decision: ClassifyDecision,
): string {
  const parts: string[] = [decision.type, args.currentStatus, args.targetStatus, args.location];
  if (args.industry !== undefined) {
    parts.push(args.industry);
  }
  if (args.yearMonth !== undefined) {
    parts.push(args.yearMonth);
  }
  return parts.join(" ");
}
