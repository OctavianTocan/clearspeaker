const FIRST_CHUNK_LENGTH = 120;
const CHUNK_LENGTH = 500;
const MAX_CHUNK_LENGTH = 14000;
const MIN_BREAK_RATIO = 0.45;
const SENTENCE_END_PATTERN = /[.!?]["')\]]?(?=\s|$)/g;
const CODE_BLOCK_PATTERN =
  /(^|\n)[ \t]*(```|~~~)[^\n]*\n[\s\S]*?(?:\n[ \t]*\2[ \t]*(?=\n|$)|$)/g;
const MARKDOWN_LINK_PATTERN = /!?\[([^\]]*)\]\(([^)]*)\)/g;
const HTML_TAG_PATTERN = /<\/?[^>\s]+(?:\s+[^>]*)?>/g;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"'`)\]]+/gi;
const FILE_PATH_PATTERN =
  /(^|[\s([{"'`])(?:\.{1,2}\/|\/|~\/)?[A-Za-z0-9._@-]+(?:\/[A-Za-z0-9._@-]+)+\.[A-Za-z0-9][A-Za-z0-9_-]*(?=$|[\s)\]},:;"'`!?])/g;
const FILE_PATH_ONLY_PATTERN =
  /^(?:\.{1,2}\/|\/|~\/)?[A-Za-z0-9._@-]+(?:\/[A-Za-z0-9._@-]+)+\.[A-Za-z0-9][A-Za-z0-9_-]*$/;

export function splitText(text: string) {
  const chunks: string[] = [];
  let remaining = cleanTextForSpeech(text);
  let limit = FIRST_CHUNK_LENGTH;

  while (remaining) {
    const chunk = takeChunk(remaining, limit);
    chunks.push(chunk);
    remaining = remaining.slice(chunk.length).trim();
    limit = CHUNK_LENGTH;
  }

  return chunks;
}

export function cleanTextForSpeech(text: string) {
  return normalizeWhitespace(
    text
      .replace(/\r\n?/g, "\n")
      .replace(CODE_BLOCK_PATTERN, "\n")
      .replace(MARKDOWN_LINK_PATTERN, (match, label: string) => {
        if (match.startsWith("!") || isUrl(label) || isFilePath(label)) {
          return "";
        }

        return label;
      })
      .replace(/`([^`]+)`/g, "$1")
      .replace(HTML_TAG_PATTERN, " ")
      .replace(URL_PATTERN, "")
      .replace(FILE_PATH_PATTERN, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s{0,3}>\s?/gm, "")
      .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/gm, "")
      .replace(/(^|\s)[-*+]\s+/g, "$1")
      .replace(/\*\*([^*\n]+)\*\*/g, "$1")
      .replace(/__([^_\n]+)__/g, "$1")
      .replace(/\*([^*\n]+)\*/g, "$1")
      .replace(/_([^_\n]+)_/g, "$1")
      .replace(/~~([^~\n]+)~~/g, "$1"),
  );
}

function takeChunk(text: string, limit: number) {
  if (text.length <= limit) {
    return text;
  }

  const maxChunkLength = Math.min(text.length, MAX_CHUNK_LENGTH);
  const minBreak = Math.floor(limit * MIN_BREAK_RATIO);
  const sentenceBreak =
    findLastSentenceEnd(text, minBreak, limit + 1) ??
    findNextSentenceEnd(text, limit + 1, maxChunkLength) ??
    findLastSentenceEnd(text, 0, limit + 1);
  const slice = text.slice(0, limit + 1);
  const phraseBreak = Math.max(
    slice.lastIndexOf("; "),
    slice.lastIndexOf(": "),
    slice.lastIndexOf(", "),
  );
  const wordBreak = slice.lastIndexOf(" ");
  const splitAt =
    sentenceBreak ||
    (phraseBreak >= minBreak && phraseBreak + 1) ||
    (wordBreak >= minBreak && wordBreak) ||
    limit;

  return text.slice(0, splitAt).trim();
}

function findLastSentenceEnd(text: string, start: number, end: number) {
  let sentenceEnd: number | undefined;

  for (const match of text.slice(0, end).matchAll(SENTENCE_END_PATTERN)) {
    const splitAt = match.index + match[0].length;

    if (splitAt >= start) {
      sentenceEnd = splitAt;
    }
  }

  return sentenceEnd;
}

function findNextSentenceEnd(text: string, start: number, end: number) {
  for (const match of text.slice(start, end).matchAll(SENTENCE_END_PATTERN)) {
    return start + match.index + match[0].length;
  }

  return undefined;
}

function isUrl(text: string) {
  return /^(?:https?:\/\/|www\.)/i.test(text.trim());
}

function isFilePath(text: string) {
  return FILE_PATH_ONLY_PATTERN.test(text.trim());
}

function normalizeWhitespace(text: string) {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\s+([)\]}])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
