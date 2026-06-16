import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLocalInfisicalConfig } from "../src/local-config.ts";

test("parseLocalInfisicalConfig accepts Infisical project files", () => {
  assert.deepEqual(
    parseLocalInfisicalConfig(
      JSON.stringify({
        workspaceId: "project-123",
        defaultEnvironment: "dev",
      }),
    ),
    {
      projectId: "project-123",
      environment: "dev",
      path: undefined,
      secretName: undefined,
      domain: undefined,
      token: undefined,
    },
  );
});

test("parseLocalInfisicalConfig accepts ClearSpeaker-specific overrides", () => {
  assert.deepEqual(
    parseLocalInfisicalConfig(
      JSON.stringify({
        projectId: "project-456",
        environment: "prod",
        secretPath: "/tts",
        secretKey: "CUSTOM_XAI_KEY",
        domain: "https://example.com/api",
      }),
    ),
    {
      projectId: "project-456",
      environment: "prod",
      path: "/tts",
      secretName: "CUSTOM_XAI_KEY",
      domain: "https://example.com/api",
      token: undefined,
    },
  );
});
