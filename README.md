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
- An xAI API key stored as `XAI_API_KEY` in Infisical, or a fallback key stored in Raycast preferences
- Infisical CLI if you want automatic secret lookup:

```sh
brew install infisical/get-cli/infisical
infisical login
```

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

- `Infisical Project ID`: optional when local config exists; otherwise set this so the CLI can fetch `XAI_API_KEY`
- `Infisical Environment`: defaults to `dev`
- `Infisical Secret Path`: defaults to `/`
- `Infisical Secret Name`: defaults to `XAI_API_KEY`
- `Infisical Domain`: optional, for EU Cloud or self-hosted Infisical
- `Infisical Service Token`: optional, only needed if the CLI cannot use your local login
- `Fallback xAI API Key`: optional; used only if Infisical lookup fails
- `Voice ID`: optional; defaults to `ara`

For installed Raycast commands, the extension may not run from the repository directory. To keep Infisical working outside development mode, add a local-only config file at:

```text
~/Library/Application Support/ClearSpeaker/infisical.json
```

The file can use Infisical's project format:

```json
{
  "workspaceId": "your-infisical-project-id",
  "defaultEnvironment": "dev"
}
```

The same values can also be set in Raycast command preferences. Raycast preferences take precedence over local config.

## Usage

Select text in any app, run `Read Selection Aloud` from Raycast, and the command will read the cleaned prose aloud.

## Privacy

Selected text is sent directly to xAI's TTS API so audio can be generated. Secrets are read from your local Infisical setup when available; optional fallback keys are stored in Raycast command preferences and are not committed to this repository.

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
