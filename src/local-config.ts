import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface LocalInfisicalConfig {
  readonly projectId?: string;
  readonly environment?: string;
  readonly path?: string;
  readonly secretName?: string;
  readonly domain?: string;
  readonly token?: string;
}

export function getLocalInfisicalConfig(): LocalInfisicalConfig {
  for (const path of getLocalInfisicalConfigPaths()) {
    try {
      const config = parseLocalInfisicalConfig(readFileSync(path, "utf8"));

      if (Object.keys(config).length > 0) {
        return config;
      }
    } catch {
      // Try the next local-only config location.
    }
  }

  return {};
}

export function getLocalInfisicalConfigPaths() {
  const explicitPath = trimOptionalConfigText(process.env.CLEARSPEAKER_CONFIG);
  const home = homedir();
  const paths = [
    explicitPath,
    join(home, "Library/Application Support/ClearSpeaker/infisical.json"),
    join(home, ".config/clearspeaker/infisical.json"),
    join(process.cwd(), ".infisical.json"),
  ];

  return paths.filter((path): path is string => Boolean(path));
}

export function parseLocalInfisicalConfig(
  contents: string,
): LocalInfisicalConfig {
  const value = JSON.parse(contents) as Record<string, unknown>;

  return {
    projectId:
      trimOptionalConfigText(value.projectId) ||
      trimOptionalConfigText(value.workspaceId),
    environment:
      trimOptionalConfigText(value.environment) ||
      trimOptionalConfigText(value.defaultEnvironment),
    path:
      trimOptionalConfigText(value.path) ||
      trimOptionalConfigText(value.secretPath),
    secretName:
      trimOptionalConfigText(value.secretName) ||
      trimOptionalConfigText(value.secretKey),
    domain: trimOptionalConfigText(value.domain),
    token: trimOptionalConfigText(value.token),
  };
}

function trimOptionalConfigText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";

  return text || undefined;
}
