import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { resolveOpenClawToolsForMcp } from "./openclaw-tools-serve.js";
import { createPluginToolsMcpHandlers } from "./plugin-tools-handlers.js";

describe("OpenClaw tools MCP server", () => {
  it("exposes video generation with MCP defaults", async () => {
    const handlers = createPluginToolsMcpHandlers(
      resolveOpenClawToolsForMcp({ config: {} as OpenClawConfig }),
    );

    const listed = await handlers.listTools();
    expect(listed.tools.map((tool) => tool.name)).toContain("video_generate");
  });

  it("does not expose owner-only cron", async () => {
    const handlers = createPluginToolsMcpHandlers(resolveOpenClawToolsForMcp());

    const listed = await handlers.listTools();
    expect(listed.tools.map((tool) => tool.name)).not.toContain("cron");
  });

  it("blocks owner-only cron invocation", async () => {
    const handlers = createPluginToolsMcpHandlers(resolveOpenClawToolsForMcp());

    const result = await handlers.callTool({ name: "cron", arguments: { action: "status" } });
    expect(result).toEqual({
      content: [{ type: "text", text: "Unknown tool: cron" }],
      isError: true,
    });
  });
});
