import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanTextForSpeech, splitText } from "../src/text-chunking.ts";

test("splitText keeps a chunk running until the next sentence end", () => {
  const openingSentence =
    "This sentence intentionally runs beyond the first chunk target so the old splitter would trail off mid thought instead of waiting for the period.";
  const nextSentence = "The next sentence should start cleanly.";

  const [firstChunk, secondChunk] = splitText(
    `${openingSentence} ${nextSentence}`,
  );

  assert.equal(firstChunk, openingSentence);
  assert.equal(secondChunk, nextSentence);
});

test("splitText treats question and exclamation marks as sentence ends", () => {
  const question =
    "Can this chunk keep speaking until the question is actually finished even when the sentence is longer than the first target?";
  const exclamation = "Yes, it should!";

  const [firstChunk, secondChunk] = splitText(`${question} ${exclamation}`);

  assert.equal(firstChunk, question);
  assert.equal(secondChunk, exclamation);
});

test("cleanTextForSpeech removes markdown links when the label is a file path", () => {
  const text = cleanTextForSpeech(
    "Check [packages/clients/ai-sdk/test/PiSpike.spike.test.ts](https://github.com/example-org/example-repo/blob/main/packages/clients/ai-sdk/test/PiSpike.spike.test.ts) for the failing case.",
  );

  assert.equal(text, "Check for the failing case.");
});

test("cleanTextForSpeech removes bare URLs and file paths", () => {
  const text = cleanTextForSpeech(
    "Open https://example.com/docs and then inspect packages/clients/ai-sdk/test/PiSpike.spike.test.ts before replying.",
  );

  assert.equal(text, "Open and then inspect before replying.");
});

test("cleanTextForSpeech removes fenced code blocks completely", () => {
  const text = cleanTextForSpeech(`Start here.

\`\`\`ts
const path = "packages/clients/ai-sdk/test/PiSpike.spike.test.ts";
throw new Error("nope");
\`\`\`

Then continue with this sentence.`);

  assert.equal(text, "Start here. Then continue with this sentence.");
});

test("cleanTextForSpeech strips common markdown and html markup", () => {
  const text = cleanTextForSpeech(
    "# **Important** <strong>note</strong>: - read _this_ before ~~that~~.",
  );

  assert.equal(text, "Important note: read this before that.");
});
