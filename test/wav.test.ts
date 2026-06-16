import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractWavAudio,
  getPcmPlaybackOptions,
  isSameWavFormat,
} from "../src/wav.ts";

test("extractWavAudio returns format and playable data from a WAV file", () => {
  const samples = Buffer.from([1, 2, 3, 4]);
  const audio = extractWavAudio(createWav(samples));

  assert.equal(audio.format.sampleRate, 24000);
  assert.equal(audio.format.channelCount, 1);
  assert.equal(audio.format.bitsPerSample, 16);
  assert.deepEqual(audio.data, samples);
});

test("extractWavAudio skips non-audio chunks before the data chunk", () => {
  const metadata = Buffer.concat([
    Buffer.from("LIST"),
    uint32(4),
    Buffer.from("INFO"),
  ]);
  const samples = Buffer.from([5, 6, 7, 8]);
  const audio = extractWavAudio(createWav(samples, [metadata]));

  assert.deepEqual(audio.data, samples);
});

test("extractWavAudio accepts an oversized final data chunk", () => {
  const samples = Buffer.from([9, 10, 11, 12]);
  const audio = extractWavAudio(createWav(samples, [], samples.length + 1000));

  assert.deepEqual(audio.data, samples);
});

test("extractWavAudio rejects truncated metadata chunks", () => {
  const invalidMetadata = Buffer.concat([Buffer.from("LIST"), uint32(1000)]);

  assert.throws(
    () =>
      extractWavAudio(createWav(Buffer.from([1, 2, 3, 4]), [invalidMetadata])),
    /truncated WAV file/,
  );
});

test("getPcmPlaybackOptions maps xAI WAV output to raw PCM playback options", () => {
  const audio = extractWavAudio(createWav(Buffer.from([1, 2, 3, 4])));

  assert.deepEqual(getPcmPlaybackOptions(audio.format), {
    sampleRate: 24000,
    channelLayout: "mono",
  });
  assert.equal(isSameWavFormat(audio.format, audio.format), true);
});

function createWav(
  samples: Buffer,
  extraChunks: Buffer[] = [],
  dataChunkSize = samples.length,
) {
  const formatChunk = Buffer.alloc(16);
  const channelCount = 1;
  const sampleRate = 24000;
  const bitsPerSample = 16;
  const blockAlign = (channelCount * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;

  formatChunk.writeUInt16LE(1, 0);
  formatChunk.writeUInt16LE(channelCount, 2);
  formatChunk.writeUInt32LE(sampleRate, 4);
  formatChunk.writeUInt32LE(byteRate, 8);
  formatChunk.writeUInt16LE(blockAlign, 12);
  formatChunk.writeUInt16LE(bitsPerSample, 14);

  const chunks = [
    Buffer.from("WAVE"),
    Buffer.from("fmt "),
    uint32(formatChunk.length),
    formatChunk,
    ...extraChunks,
    Buffer.from("data"),
    uint32(dataChunkSize),
    samples,
  ];
  const body = Buffer.concat(chunks);

  return Buffer.concat([Buffer.from("RIFF"), uint32(body.length), body]);
}

function uint32(value: number) {
  const buffer = Buffer.alloc(4);

  buffer.writeUInt32LE(value, 0);
  return buffer;
}
