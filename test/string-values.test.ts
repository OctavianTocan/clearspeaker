import assert from "node:assert/strict";
import { test } from "node:test";
import { trimOptionalText, trimText } from "../src/string-values.ts";

test("trimText treats missing external values as empty text", () => {
  assert.equal(trimText(undefined), "");
  assert.equal(trimText(null), "");
});

test("trimOptionalText only returns meaningful trimmed strings", () => {
  assert.equal(trimOptionalText("  XAI_API_KEY  "), "XAI_API_KEY");
  assert.equal(trimOptionalText("   "), undefined);
  assert.equal(trimOptionalText(undefined), undefined);
});
