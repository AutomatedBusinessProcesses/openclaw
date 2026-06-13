/**
 * Standalone MCP server for selected built-in OpenClaw tools.
 *
 * Run via: node --import tsx src/mcp/openclaw-tools-serve.ts
 * Or: bun src/mcp/openclaw-tools-serve.ts
 */
import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { AnyAgentTool } from "../agents/tools/common.js";
import { createCronTool } from "../agents/tools/cron-tool.js";
import { createVideoGenerateTool } from "../agents/tools/video-generate-tool.js";
import type { OpenClawConfig } from "../config/config.js";
import { formatErrorMessage } from "../infra/errors.js";
import { connectToolsMcpServerToStdio, createToolsMcpServer } from "./tools-stdio-server.js";

const DEFAULT_MCP_VIDEO_GENERATION_MODEL = {
  primary: "xai/grok-imagine-video",
  fallbacks: ["google/veo-3.1-fast-generate-preview", "comfy/workflow"],
  timeoutMs: 900_000,
};

function withMcpVideoGenerationDefaults(cfg: OpenClawConfig): OpenClawConfig {
  const current = cfg.agents?.defaults?.videoGenerationModel;
  if (
    typeof current === "string" ||
    current?.primary ||
    (Array.isArray(current?.fallbacks) && current.fallbacks.length > 0)
  ) {
    return cfg;
  }

  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        videoGenerationModel: DEFAULT_MCP_VIDEO_GENERATION_MODEL,
      },
    },
  };
}

export function resolveOpenClawToolsForMcp(
  params: { config?: OpenClawConfig } = {},
): AnyAgentTool[] {
  const config = withMcpVideoGenerationDefaults(params.config ?? {});
  return [createCronTool(), createVideoGenerateTool({ config })].filter(
    (tool): tool is AnyAgentTool => Boolean(tool),
  );
}

function createOpenClawToolsMcpServer(
  params: {
    tools?: AnyAgentTool[];
  } = {},
): Server {
  const tools = params.tools ?? resolveOpenClawToolsForMcp();
  return createToolsMcpServer({ name: "openclaw-tools", tools });
}

async function serveOpenClawToolsMcp(): Promise<void> {
  const server = createOpenClawToolsMcpServer();
  await connectToolsMcpServerToStdio(server);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  serveOpenClawToolsMcp().catch((err) => {
    process.stderr.write(`openclaw-tools-serve: ${formatErrorMessage(err)}\n`);
    process.exit(1);
  });
}
