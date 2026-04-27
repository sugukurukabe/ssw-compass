import type { SearchVisaInput } from "@ssw/shared-types";

export { SearchVisaInput, SearchVisaOutput } from "@ssw/shared-types";

export function buildQuery(args: SearchVisaInput): string {
  const parts: string[] = [args.category];
  if (args.industry !== undefined) {
    parts.push(args.industry);
  }
  if (args.yearMonth !== undefined) {
    parts.push(args.yearMonth);
  }
  return parts.join(" ");
}
