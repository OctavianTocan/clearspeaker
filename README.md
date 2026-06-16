<p align="center">
  <img src="assets/clearspeaker-icon.png" alt="ClearSpeaker icon" width="128" height="128">
</p>

# ClearSpeaker

ClearSpeaker is a no-view Raycast command that cleans selected text and reads it aloud with xAI text-to-speech.

It is built for reading developer-heavy text without the noise: it strips links, file paths, markup, and fenced code blocks before sending text to TTS, then chunks prose on sentence boundaries so playback does not trail off mid-sentence.

## Features

- Speaks selected text from the frontmost app.
- Uses xAI TTS with the `ara` voice by default.
- Starts quickly by generating the first chunk separately.
- Prefetches upcoming chunks while audio is playing.
- Streams all chunks into one `ffplay` process for smoother back-to-back playback.
- Skips URLs, markdown link targets, file paths, fenced code blocks, and common formatting markup.

## Requirements

- macOS
- Raycast
- An xAI API key
- FFmpeg for seamless playback:

```sh
brew install ffmpeg
```

The command uses `ffplay` from FFmpeg to keep one persistent audio process alive while chunks are queued.

## Setup

1. Install dependencies:

```sh
npm install
```

2. Start Raycast development mode:

```sh
npm run dev
```

3. In Raycast, configure the command preferences:

- `xAI API Key`: your xAI API key
- `Voice ID`: optional; defaults to `ara`

## Usage

Select text in any app, run `Read Selection Aloud` from Raycast, and the command will read the cleaned prose aloud.

## Privacy

Selected text is sent directly to xAI's TTS API so audio can be generated. API keys are stored in Raycast command preferences and are not committed to this repository.

## Development

```sh
npm test
npm exec tsc -- --noEmit
npm run lint
npm run build
```

`npm test` covers text cleanup, sentence-safe chunking, and WAV parsing behavior.

## License

MIT
