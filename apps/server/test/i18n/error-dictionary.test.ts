import { ERROR_DICTIONARY, ERROR_KINDS, SUPPORTED_LANGUAGES } from "@ssw/shared-types";
import { describe, expect, it } from "vitest";

describe("UI error dictionary", () => {
  it("contains every frozen error key for every supported language", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      for (const kind of ERROR_KINDS) {
        const message = ERROR_DICTIONARY[language][`error.${kind}`];
        expect(message.length).toBeGreaterThan(0);
      }
    }
  });
});
