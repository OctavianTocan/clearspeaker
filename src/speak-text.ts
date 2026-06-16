import {
  closeMainWindow,
  getPreferenceValues,
  getSelectedText,
  showHUD,
  showToast,
  Toast,
} from "@raycast/api";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import type { Writable } from "node:stream";
import { promisify } from "node:util";
import { splitText } from "./text-chunking";
import {
  extractWavAudio,
  getPcmPlaybackOptions,
  isSameWavFormat,
  type PcmPlaybackOptions,
  type WavAudio,
  type WavFormat,
} from "./wav";

const run = promisify(execFile);
const PREFETCH_COUNT = 3;
const DEFAULT_VOICE_ID = "ara";
const DEFAULT_INFISICAL_SECRET_NAME = "XAI_API_KEY";
const DEFAULT_INFISICAL_ENVIRONMENT = "dev";
const DEFAULT_INFISICAL_PATH = "/";
const FFPLAY_PATHS = [
  "/opt/homebrew/bin/ffplay",
  "/usr/local/bin/ffplay",
  "ffplay",
];
const INFISICAL_PATHS = [
  "/opt/homebrew/bin/infisical",
  "/usr/local/bin/infisical",
  "infisical",
];

let ffplayPathPromise: Promise<string> | undefined;
let infisicalPathPromise: Promise<string | undefined> | undefined;

interface Preferences {
  readonly infisicalProjectId?: string;
  readonly infisicalEnvironment?: string;
  readonly infisicalPath?: string;
  readonly infisicalSecretName?: string;
  readonly infisicalDomain?: string;
  readonly infisicalToken?: string;
  readonly xaiApiKey?: string;
  readonly voiceId?: string;
}

export default async function main() {
  let toast: Toast | undefined;

  try {
    const text = (await getSelectedText()).trim();

    if (!text) {
      await showHUD("No text selected");
      return;
    }

    toast = await showToast({
      style: Toast.Style.Animated,
      title: "Generating speech",
    });
    await closeMainWindow();

    await speakText(text, toast);
    await toast.hide();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (toast) {
      toast.style = Toast.Style.Failure;
      toast.title = "Couldn't speak selected text";
      toast.message = message;
    } else {
      await showToast({
        style: Toast.Style.Failure,
        title: "Couldn't speak selected text",
        message,
      });
    }
  }
}

async function speakText(text: string, toast: Toast) {
  const chunks = splitText(text);

  if (chunks.length === 0) {
    toast.style = Toast.Style.Success;
    toast.title = "Nothing to speak";
    toast.message = "";
    return;
  }

  const { apiKey, voiceId } = await getSpeechPreferences();
  let nextChunkToGenerate = 0;
  const pendingChunks = new Map<number, Promise<Buffer>>();
  let player: PcmPlayer | undefined;

  const prefetchChunks = () => {
    while (
      nextChunkToGenerate < chunks.length &&
      pendingChunks.size < PREFETCH_COUNT
    ) {
      const index = nextChunkToGenerate;
      const promise = createSpeech(chunks[index], apiKey, voiceId);
      promise.catch(() => undefined);
      pendingChunks.set(index, promise);
      nextChunkToGenerate += 1;
    }
  };

  try {
    prefetchChunks();

    for (let index = 0; index < chunks.length; index += 1) {
      const audio = await getPendingChunkAudio(index, pendingChunks);
      const wavAudio = extractWavAudio(audio);

      prefetchChunks();
      toast.style = Toast.Style.Success;
      toast.title = "Playing speech";
      toast.message =
        chunks.length > 1 ? `Part ${index + 1} of ${chunks.length}` : "";

      player ??= await PcmPlayer.create(wavAudio.format);
      await player.write(wavAudio);

      if (index + 1 < chunks.length && pendingChunks.has(index + 1)) {
        toast.style = Toast.Style.Animated;
        toast.title = "Preparing next part";
        toast.message = `Part ${index + 2} of ${chunks.length}`;
      }
    }

    await player?.finish();
  } finally {
    player?.dispose();
  }
}

async function getPendingChunkAudio(
  index: number,
  pendingChunks: Map<number, Promise<Buffer>>,
) {
  const chunk = pendingChunks.get(index);

  if (!chunk) {
    throw new Error(`Speech part ${index + 1} was not queued`);
  }

  pendingChunks.delete(index);
  return chunk;
}

async function getSpeechPreferences() {
  const preferences = getPreferenceValues<Preferences>();
  const apiKey =
    process.env.XAI_API_KEY?.trim() ||
    (await getInfisicalSecret(preferences)) ||
    preferences.xaiApiKey?.trim();

  if (!apiKey) {
    throw new Error(
      "Could not load XAI_API_KEY from Infisical. Set Infisical preferences or add a fallback xAI API key.",
    );
  }

  return {
    apiKey,
    voiceId: preferences.voiceId?.trim() || DEFAULT_VOICE_ID,
  };
}

async function getInfisicalSecret(preferences: Preferences) {
  const infisicalPath = await findInfisicalPath();

  if (!infisicalPath) {
    return undefined;
  }

  const args = [
    "secrets",
    "get",
    preferences.infisicalSecretName?.trim() || DEFAULT_INFISICAL_SECRET_NAME,
    "--plain",
    "--silent",
    "--env",
    preferences.infisicalEnvironment?.trim() || DEFAULT_INFISICAL_ENVIRONMENT,
    "--path",
    preferences.infisicalPath?.trim() || DEFAULT_INFISICAL_PATH,
  ];
  const projectId = preferences.infisicalProjectId?.trim();
  const domain = preferences.infisicalDomain?.trim();
  const token = preferences.infisicalToken?.trim();

  if (projectId) {
    args.push("--projectId", projectId);
  }

  if (domain) {
    args.push("--domain", domain);
  }

  if (token) {
    args.push("--token", token);
  }

  try {
    const { stdout } = await run(infisicalPath, args, {
      timeout: 10000,
      env: process.env,
    });

    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function createSpeech(text: string, apiKey: string, voiceId: string) {
  if (text.length > 15000) {
    throw new Error(
      "Selected text is longer than xAI's 15,000 character TTS limit",
    );
  }

  const response = await fetch("https://api.x.ai/v1/tts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      language: "en",
      optimize_streaming_latency: 2,
      output_format: { codec: "wav", sample_rate: 24000 },
    }),
  });

  const audio = Buffer.from(await response.arrayBuffer());

  if (!response.ok) {
    throw new XaiApiError(
      response.status,
      `xAI TTS failed: ${audio.toString("utf8").slice(0, 200)}`,
    );
  }

  return audio;
}

class PcmPlayer {
  private stderr = "";
  private isDone = false;

  private constructor(
    private readonly format: WavFormat,
    private readonly process: ReturnType<typeof spawn>,
  ) {
    this.process.stderr?.on("data", (chunk: Buffer) => {
      this.stderr += chunk.toString("utf8");
    });
    this.process.once("error", (error) => {
      this.stderr += error instanceof Error ? error.message : String(error);
    });
    this.process.stdin?.on("error", (error) => {
      this.stderr += error instanceof Error ? error.message : String(error);
    });
  }

  static async create(format: WavFormat) {
    return new PcmPlayer(
      format,
      await spawnFfplay(getPcmPlaybackOptions(format)),
    );
  }

  async write(audio: WavAudio) {
    if (!isSameWavFormat(this.format, audio.format)) {
      throw new Error("xAI returned inconsistent WAV formats between chunks");
    }

    if (!this.process.stdin) {
      throw new Error("Audio player is not writable");
    }

    await writeToStream(this.process.stdin, audio.data);
  }

  async finish() {
    if (this.isDone) {
      return;
    }

    let processClosed = false;

    try {
      if (this.process.stdin) {
        await endStream(this.process.stdin);
      }

      const [code, signal] = (await once(this.process, "close")) as [
        number | null,
        NodeJS.Signals | null,
      ];
      processClosed = true;

      if (code !== 0) {
        const detail = this.stderr.trim() || signal || `exit code ${code}`;

        throw new Error(`ffplay failed: ${detail}`);
      }
    } finally {
      this.isDone = true;

      if (!processClosed) {
        this.process.kill();
      }
    }
  }

  dispose() {
    if (this.isDone) {
      return;
    }

    this.isDone = true;
    this.process.stdin?.destroy();
    this.process.kill();
  }
}

async function spawnFfplay(options: PcmPlaybackOptions) {
  const ffplayPath = await findFfplayPath();
  const playerProcess = spawn(
    ffplayPath,
    [
      "-v",
      "error",
      "-nodisp",
      "-autoexit",
      "-f",
      "s16le",
      "-sample_rate",
      String(options.sampleRate),
      "-ch_layout",
      options.channelLayout,
      "-i",
      "pipe:0",
    ],
    {
      stdio: ["pipe", "ignore", "pipe"],
      windowsHide: true,
      env: { ...process.env, SDL_AUDIODRIVER: "coreaudio" },
    },
  );

  await Promise.race([
    once(playerProcess, "spawn"),
    once(playerProcess, "error").then(([error]) => {
      throw error;
    }),
  ]);

  return playerProcess;
}

function findFfplayPath() {
  ffplayPathPromise ??= resolveFfplayPath();
  return ffplayPathPromise;
}

function findInfisicalPath() {
  infisicalPathPromise ??= resolveInfisicalPath();
  return infisicalPathPromise;
}

async function resolveFfplayPath() {
  for (const path of FFPLAY_PATHS) {
    try {
      await run(path, ["-version"]);
      return path;
    } catch {
      // Try the next common Homebrew/PATH location.
    }
  }

  throw new Error(
    "Install FFmpeg to enable seamless playback: brew install ffmpeg",
  );
}

async function resolveInfisicalPath() {
  for (const path of INFISICAL_PATHS) {
    try {
      await run(path, ["--version"]);
      return path;
    } catch {
      // Try the next common Homebrew/PATH location.
    }
  }

  return undefined;
}

async function writeToStream(stream: Writable, buffer: Buffer) {
  if (stream.write(buffer)) {
    return;
  }

  await Promise.race([
    once(stream, "drain"),
    once(stream, "error").then(([error]) => {
      throw error;
    }),
  ]);
}

async function endStream(stream: Writable) {
  await new Promise<void>((resolve, reject) => {
    stream.once("error", reject);
    stream.end(resolve);
  });
}

class XaiApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
