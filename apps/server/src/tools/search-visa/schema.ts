import type { SearchVisaInput } from "@vcj/shared-types";

export { SearchVisaInput, SearchVisaOutput } from "@vcj/shared-types";

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
