export interface WavFormat {
  readonly chunk: Buffer;
  readonly audioFormat: number;
  readonly channelCount: number;
  readonly sampleRate: number;
  readonly byteRate: number;
  readonly blockAlign: number;
  readonly bitsPerSample: number;
}

export interface WavAudio {
  readonly format: WavFormat;
  readonly data: Buffer;
}

export interface PcmPlaybackOptions {
  readonly sampleRate: number;
  readonly channelLayout: "mono" | "stereo";
}

export function extractWavAudio(audio: Buffer): WavAudio {
  if (
    audio.length < 12 ||
    audio.toString("ascii", 0, 4) !== "RIFF" ||
    audio.toString("ascii", 8, 12) !== "WAVE"
  ) {
    throw new Error("xAI returned audio in an unsupported format");
  }

  let offset = 12;
  let format: WavFormat | undefined;
  let data: Buffer | undefined;

  while (offset + 8 <= audio.length) {
    const chunkId = audio.toString("ascii", offset, offset + 4);
    const chunkSize = audio.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const isOpenEndedDataChunk = chunkId === "data" && chunkSize === 0xffffffff;
    const chunkEnd = isOpenEndedDataChunk
      ? audio.length
      : chunkStart + chunkSize;

    if (chunkEnd > audio.length) {
      throw new Error("xAI returned a truncated WAV file");
    }

    if (chunkId === "fmt ") {
      format = readWavFormat(audio.subarray(chunkStart, chunkEnd));
    } else if (chunkId === "data") {
      data = audio.subarray(chunkStart, chunkEnd);
    }

    offset = isOpenEndedDataChunk ? audio.length : chunkEnd + (chunkSize % 2);
  }

  if (!format || !data) {
    throw new Error("xAI returned a WAV file without playable audio");
  }

  return { format, data };
}

export function getPcmPlaybackOptions(format: WavFormat): PcmPlaybackOptions {
  if (format.audioFormat !== 1 || format.bitsPerSample !== 16) {
    throw new Error("xAI returned audio in an unsupported WAV encoding");
  }

  if (format.channelCount === 1) {
    return { sampleRate: format.sampleRate, channelLayout: "mono" };
  }

  if (format.channelCount === 2) {
    return { sampleRate: format.sampleRate, channelLayout: "stereo" };
  }

  throw new Error("xAI returned audio with an unsupported channel layout");
}

export function isSameWavFormat(left: WavFormat, right: WavFormat) {
  return left.chunk.equals(right.chunk);
}

function readWavFormat(chunk: Buffer): WavFormat {
  if (chunk.length < 16) {
    throw new Error("xAI returned a WAV file with an invalid format chunk");
  }

  return {
    chunk,
    audioFormat: chunk.readUInt16LE(0),
    channelCount: chunk.readUInt16LE(2),
    sampleRate: chunk.readUInt32LE(4),
    byteRate: chunk.readUInt32LE(8),
    blockAlign: chunk.readUInt16LE(12),
    bitsPerSample: chunk.readUInt16LE(14),
  };
}
