import { resolveSendableOutboundReplyParts } from "openclaw/plugin-sdk/reply-payload";
import { copyReplyPayloadMetadata } from "../reply-payload.js";
import type { ReplyPayload } from "../types.js";

const WORKING_DRAFT_HEADING = "WORKING DRAFT";
const EXISTING_DRAFT_FENCE_RE = /^\s*`{3,}[^\n]*\n\s*(?:WORKING DRAFT|STATUS)\b/i;

function longestBacktickRun(text: string): number {
  let longest = 0;
  let current = 0;
  for (const char of text) {
    if (char === "`") {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

export function formatWorkingDraftCodeBlock(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || EXISTING_DRAFT_FENCE_RE.test(trimmed)) {
    return text;
  }
  const fence = "`".repeat(Math.max(3, longestBacktickRun(trimmed) + 1));
  return `${fence}text\n${WORKING_DRAFT_HEADING}\n${trimmed}\n${fence}`;
}

export function formatWorkingDraftProgressPayload(payload: ReplyPayload): ReplyPayload {
  if (!payload.text || resolveSendableOutboundReplyParts(payload).hasMedia) {
    return payload;
  }
  const channelData = payload.channelData;
  const execApproval =
    channelData && typeof channelData === "object" && !Array.isArray(channelData)
      ? channelData.execApproval
      : undefined;
  if (execApproval && typeof execApproval === "object" && !Array.isArray(execApproval)) {
    return payload;
  }
  const text = formatWorkingDraftCodeBlock(payload.text);
  return text === payload.text ? payload : copyReplyPayloadMetadata(payload, { ...payload, text });
}
