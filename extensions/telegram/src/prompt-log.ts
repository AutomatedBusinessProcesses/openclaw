import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { OpenClawConfig } from "openclaw/plugin-sdk/config-types";
import { normalizeAgentId } from "openclaw/plugin-sdk/routing";
import { resolveRequiredHomeDir, resolveStateDir } from "openclaw/plugin-sdk/state-paths";
import type { TelegramMessageContext } from "./bot-message-context.js";
import type { TelegramMediaRef } from "./bot-message-context.types.js";

const LOG_ROOT = path.join("logs", "telegram-prompts");

type AgentEntry = NonNullable<NonNullable<OpenClawConfig["agents"]>["list"]>[number];

export type TelegramPromptLogResult = {
  markdownPath: string;
  jsonlPath: string;
};

export type AppendTelegramPromptLogParams = {
  cfg: OpenClawConfig;
  context: TelegramMessageContext;
  media?: TelegramMediaRef[];
  env?: NodeJS.ProcessEnv;
  now?: Date;
};

function stripNullBytes(value: string): string {
  return value.replaceAll("\0", "");
}

function resolveUserPath(input: string, env: NodeJS.ProcessEnv): string {
  const trimmed = stripNullBytes(input.trim());
  if (!trimmed) {
    return "";
  }
  const home = resolveRequiredHomeDir(env, os.homedir);
  if (trimmed === "~") {
    return home;
  }
  if (trimmed.startsWith("~/") || trimmed.startsWith("~" + path.sep)) {
    return path.join(home, trimmed.slice(2));
  }
  return path.resolve(trimmed);
}

function listAgentEntries(cfg: OpenClawConfig): AgentEntry[] {
  return Array.isArray(cfg.agents?.list) ? cfg.agents.list : [];
}

function resolveDefaultAgentId(cfg: OpenClawConfig): string {
  const entries = listAgentEntries(cfg);
  return normalizeAgentId((entries.find((entry) => entry.default) ?? entries[0])?.id);
}

function resolveAgentWorkspaceDir(
  cfg: OpenClawConfig,
  agentId: string,
  env: NodeJS.ProcessEnv,
): string {
  const id = normalizeAgentId(agentId);
  const configured = listAgentEntries(cfg).find(
    (entry) => normalizeAgentId(entry.id) === id,
  )?.workspace;
  if (configured?.trim()) {
    return resolveUserPath(configured, env);
  }
  const fallback = cfg.agents?.defaults?.workspace?.trim();
  const defaultAgentId = resolveDefaultAgentId(cfg);
  if (id === defaultAgentId) {
    if (fallback) {
      return resolveUserPath(fallback, env);
    }
    const home = resolveRequiredHomeDir(env, os.homedir);
    const profile = env.OPENCLAW_PROFILE?.trim();
    return profile && profile.toLowerCase() !== "default"
      ? path.join(home, ".openclaw", `workspace-${profile}`)
      : path.join(home, ".openclaw", "workspace");
  }
  if (fallback) {
    return path.join(resolveUserPath(fallback, env), id);
  }
  return path.join(resolveStateDir(env, os.homedir), `workspace-${id}`);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function readPayloadString(payload: unknown, key: string): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function chooseFence(text: string): string {
  let fence = "```";
  while (text.includes(fence)) {
    fence += "`";
  }
  return fence;
}

function formatMarkdownEntry(params: {
  timestamp: string;
  accountId: string;
  agentId: string;
  sessionKey: string;
  chatId: string;
  chatType: string;
  conversationLabel?: string;
  threadId?: string;
  messageId?: string;
  senderName?: string;
  senderId?: string;
  senderUsername?: string;
  mediaTypes: string[];
  text: string;
}): string {
  const lines = [
    `## ${params.timestamp} | ${params.chatType} | agent:${params.agentId}`,
    "",
    `- account: \`${params.accountId}\``,
    `- session: \`${params.sessionKey}\``,
    `- chat: \`${params.chatId}\``,
    params.threadId ? `- thread: \`${params.threadId}\`` : undefined,
    params.messageId ? `- message: \`${params.messageId}\`` : undefined,
    params.conversationLabel ? `- conversation: ${params.conversationLabel}` : undefined,
    params.senderName || params.senderId || params.senderUsername
      ? `- sender: ${[
          params.senderName,
          params.senderUsername ? `@${params.senderUsername}` : undefined,
          params.senderId ? `id:${params.senderId}` : undefined,
        ]
          .filter(Boolean)
          .join(" ")}`
      : undefined,
    params.mediaTypes.length > 0 ? `- media: ${params.mediaTypes.join(", ")}` : undefined,
    "",
  ].filter((line): line is string => line !== undefined);
  const fence = chooseFence(params.text);
  return `${lines.join("\n")}${fence}text\n${params.text}\n${fence}\n\n`;
}

async function ensurePromptLogReadme(dir: string): Promise<void> {
  const readmePath = path.join(dir, "README.md");
  const body =
    "# Telegram Prompt Log\n\n" +
    "Prompt-only inbound Telegram messages are appended here. Bot outputs are not logged.\n\n" +
    "- Daily Markdown files are for fast reading/searching.\n" +
    "- Daily JSONL files are for structured tools.\n" +
    '- Search with `rg "phrase" logs/telegram-prompts` from the agent workspace.\n';
  await fs
    .writeFile(readmePath, body, { encoding: "utf8", flag: "wx", mode: 0o600 })
    .catch((err: NodeJS.ErrnoException) => {
      if (err.code !== "EEXIST") {
        throw err;
      }
    });
}

export function resolveTelegramPromptLogDir(
  cfg: OpenClawConfig,
  agentId: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return path.join(resolveAgentWorkspaceDir(cfg, agentId, env), LOG_ROOT);
}

export async function appendTelegramPromptLog({
  cfg,
  context,
  media = [],
  env = process.env,
  now,
}: AppendTelegramPromptLogParams): Promise<TelegramPromptLogResult | null> {
  if (context.msg.from?.is_bot) {
    return null;
  }

  const timestampDate =
    typeof context.msg.date === "number" ? new Date(context.msg.date * 1000) : (now ?? new Date());
  const timestamp = timestampDate.toISOString();
  const day = formatDateOnly(timestampDate);
  const agentId = normalizeAgentId(context.route.agentId);
  const accountId =
    context.route.accountId || readPayloadString(context.ctxPayload, "AccountId") || "default";
  const sessionKey =
    context.route.sessionKey || readPayloadString(context.ctxPayload, "SessionKey") || "";
  const text =
    readPayloadString(context.ctxPayload, "BodyForAgent") ??
    readPayloadString(context.ctxPayload, "RawBody") ??
    "";
  const dir = resolveTelegramPromptLogDir(cfg, agentId, env);
  const markdownPath = path.join(dir, `${day}.md`);
  const jsonlPath = path.join(dir, `${day}.jsonl`);
  const threadId =
    context.threadSpec.id !== undefined
      ? String(context.threadSpec.id)
      : readPayloadString(context.ctxPayload, "MessageThreadId");
  const messageId =
    readPayloadString(context.ctxPayload, "MessageSid") ??
    (context.msg.message_id !== undefined ? String(context.msg.message_id) : undefined);
  const senderId = readPayloadString(context.ctxPayload, "SenderId");
  const senderUsername = readPayloadString(context.ctxPayload, "SenderUsername");
  const senderName = readPayloadString(context.ctxPayload, "SenderName");
  const conversationLabel = readPayloadString(context.ctxPayload, "ConversationLabel");
  const mediaTypes = media
    .map((entry) => entry.contentType)
    .filter((value): value is string => Boolean(value));

  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  await ensurePromptLogReadme(dir);
  await fs.appendFile(
    markdownPath,
    formatMarkdownEntry({
      timestamp,
      accountId,
      agentId,
      sessionKey,
      chatId: String(context.chatId),
      chatType: context.ctxPayload.ChatType,
      conversationLabel,
      threadId,
      messageId,
      senderName,
      senderId,
      senderUsername,
      mediaTypes,
      text,
    }),
    { encoding: "utf8", mode: 0o600 },
  );
  await fs.appendFile(
    jsonlPath,
    `${JSON.stringify({
      timestamp,
      provider: "telegram",
      accountId,
      agentId,
      sessionKey,
      chatId: String(context.chatId),
      chatType: context.ctxPayload.ChatType,
      conversationLabel,
      threadId,
      messageId,
      senderName,
      senderId,
      senderUsername,
      mediaTypes,
      text,
    })}\n`,
    { encoding: "utf8", mode: 0o600 },
  );

  return { markdownPath, jsonlPath };
}
