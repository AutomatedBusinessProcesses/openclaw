import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { OpenClawConfig } from "openclaw/plugin-sdk/config-types";
import { afterEach, describe, expect, it } from "vitest";
import type { TelegramMessageContext } from "./bot-message-context.js";
import { appendTelegramPromptLog, resolveTelegramPromptLogDir } from "./prompt-log.js";

const tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-telegram-prompt-log-"));
  tempDirs.push(dir);
  return dir;
}

function createContext(overrides?: Partial<TelegramMessageContext>): TelegramMessageContext {
  return {
    chatId: 123,
    msg: {
      date: Date.parse("2026-05-18T12:34:56.000Z") / 1000,
      message_id: 456,
      from: { is_bot: false },
    },
    route: {
      agentId: "main",
      accountId: "default",
      sessionKey: "agent:main:main",
    },
    threadSpec: { id: 777, scope: "dm" },
    ctxPayload: {
      ChatType: "direct",
      RawBody: "raw prompt text",
      BodyForAgent: "Remember this part-search constraint.",
      AccountId: "default",
      SessionKey: "agent:main:main",
      MessageSid: "456",
      SenderName: "AJ",
      SenderId: "111",
      SenderUsername: "aj",
      ConversationLabel: "AJ",
    },
    ...overrides,
  } as unknown as TelegramMessageContext;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("telegram prompt log", () => {
  it("writes prompt-only Markdown and JSONL into the active agent workspace", async () => {
    const workspace = await makeTempDir();
    const cfg = {
      agents: { list: [{ id: "main", workspace }] },
    } satisfies OpenClawConfig;

    const result = await appendTelegramPromptLog({
      cfg,
      context: createContext(),
      media: [{ path: "/tmp/image.png", contentType: "image/png" }],
    });

    const dir = resolveTelegramPromptLogDir(cfg, "main");
    expect(result).toEqual({
      markdownPath: path.join(dir, "2026-05-18.md"),
      jsonlPath: path.join(dir, "2026-05-18.jsonl"),
    });

    const markdown = await fs.readFile(path.join(dir, "2026-05-18.md"), "utf8");
    expect(markdown).toContain("## 2026-05-18T12:34:56.000Z | direct | agent:main");
    expect(markdown).toContain("Remember this part-search constraint.");
    expect(markdown).toContain("- media: image/png");
    expect(markdown).not.toContain("assistant");

    const jsonl = await fs.readFile(path.join(dir, "2026-05-18.jsonl"), "utf8");
    const parsed = JSON.parse(jsonl.trim()) as { text: string; mediaTypes: string[] };
    expect(parsed.text).toBe("Remember this part-search constraint.");
    expect(parsed.mediaTypes).toEqual(["image/png"]);
  });

  it("does not log messages sent by bots", async () => {
    const workspace = await makeTempDir();
    const cfg = {
      agents: { list: [{ id: "main", workspace }] },
    } satisfies OpenClawConfig;

    const result = await appendTelegramPromptLog({
      cfg,
      context: createContext({
        msg: { from: { is_bot: true } },
      } as Partial<TelegramMessageContext>),
    });

    expect(result).toBeNull();
    await expect(fs.access(resolveTelegramPromptLogDir(cfg, "main"))).rejects.toThrow();
  });

  it("uses a longer Markdown fence when the prompt contains backticks", async () => {
    const workspace = await makeTempDir();
    const cfg = {
      agents: { list: [{ id: "main", workspace }] },
    } satisfies OpenClawConfig;
    const context = createContext({
      ctxPayload: {
        ChatType: "direct",
        BodyForAgent: "Keep this code:\n```ts\nconst x = 1;\n```",
        RawBody: "raw",
      },
    } as Partial<TelegramMessageContext>);

    await appendTelegramPromptLog({ cfg, context });

    const markdown = await fs.readFile(
      path.join(resolveTelegramPromptLogDir(cfg, "main"), "2026-05-18.md"),
      "utf8",
    );
    expect(markdown).toContain("````text\nKeep this code:");
  });
});
