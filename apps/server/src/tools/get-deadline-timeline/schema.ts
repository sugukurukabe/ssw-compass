import type { GetDeadlineTimelineInput } from "@ssw/shared-types";

export {
  GetDeadlineTimelineInput,
  GetDeadlineTimelineOutput,
} from "@ssw/shared-types";

/**
 * Build the Vertex AI Search query for a get_deadline_timeline request.
 * Combines visa category, event context, and reference year-month so the
 * retriever surfaces grounding documents covering the applicable rules.
 */
export function buildTimelineQuery(args: GetDeadlineTimelineInput): string {
  const parts: string[] = [args.visaCategory, args.eventContext];
  if (args.referenceYearMonth !== undefined) {
    parts.push(args.referenceYearMonth);
  }
  return parts.join(" ");
}
