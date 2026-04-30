import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FormBundle,
  type FormBundle as FormBundleType,
  type FormSection,
  FormsCatalogEntry,
  type FormsCatalogEntry as FormsCatalogEntryType,
} from "@ssw/shared-types";

const __dirname = dirname(fileURLToPath(import.meta.url));
let cachedEntries: readonly FormsCatalogEntryType[] | null = null;

function resolveCatalogPath(): string {
  const override = process.env["SSW_FORMS_CATALOG_PATH"];
  if (override !== undefined && override.length > 0) {
    return override;
  }
  return resolve(__dirname, "..", "..", "..", "data", "forms-catalog.jsonl");
}

export async function loadFormsCatalog(): Promise<readonly FormsCatalogEntryType[]> {
  if (cachedEntries !== null) return cachedEntries;
  const text = await readFile(resolveCatalogPath(), "utf-8");
  const entries = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return FormsCatalogEntry.parse(JSON.parse(line) as unknown);
      } catch (error) {
        throw new Error(
          `Invalid forms-catalog.jsonl line ${index + 1}: ${(error as Error).message}`,
        );
      }
    });
  cachedEntries = entries;
  return cachedEntries;
}

function table2Sections(profile: FormBundleType["receivingOrganizationProfile"]): {
  required: FormSection[];
  omitted: FormSection[];
} {
  if (profile === "not_applicable" || profile === "same_fiscal_year_repeat") {
    return { required: [], omitted: ["table2_1", "table2_2", "table2_3"] };
  }
  if (profile === "table2_1_eligible") {
    return { required: ["table2_1"], omitted: ["table2_2", "table2_3"] };
  }
  if (profile === "corporation") {
    return { required: ["table2_2"], omitted: ["table2_1", "table2_3"] };
  }
  return { required: ["table2_3"], omitted: ["table2_1", "table2_2"] };
}

export function buildFormBundle(
  input: Omit<FormBundleType, "requiredSections" | "omittedSections">,
): FormBundleType {
  const table2 =
    input.procedure === "renewal"
      ? { required: [], omitted: ["table2_1", "table2_2", "table2_3"] as FormSection[] }
      : table2Sections(input.receivingOrganizationProfile);
  return FormBundle.parse({
    ...input,
    requiredSections: ["table1", ...table2.required, "table3"],
    omittedSections: table2.omitted,
  });
}
