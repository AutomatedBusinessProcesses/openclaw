import { sanitizeUserFacingText } from "../../agents/pi-embedded-helpers/sanitize-user-facing-text.js";
import { hasReplyPayloadContent } from "../../interactive/payload.js";
import { normalizeOptionalString } from "../../shared/string-coerce.js";
import { stripHeartbeatToken } from "../heartbeat.js";
import {
  HEARTBEAT_TOKEN,
  isSilentReplyPayloadText,
  isSilentReplyText,
  SILENT_REPLY_TOKEN,
  startsWithSilentToken,
  stripLeadingSilentToken,
  stripSilentToken,
} from "../tokens.js";
import type { ReplyPayload } from "../types.js";
import {
  resolveResponsePrefixTemplate,
  type ResponsePrefixContext,
} from "./response-prefix-template.js";

export type NormalizeReplySkipReason = "empty" | "silent" | "heartbeat";

export type NormalizeReplyOptions = {
  responsePrefix?: string;
  responseSuffix?: string;
  applyChannelTransforms?: boolean;
  /** Context for template variable interpolation in responsePrefix */
  responsePrefixContext?: ResponsePrefixContext;
  onHeartbeatStrip?: () => void;
  stripHeartbeat?: boolean;
  silentToken?: string;
  transformReplyPayload?: (payload: ReplyPayload) => ReplyPayload | null;
  onSkip?: (reason: NormalizeReplySkipReason) => void;
};

function hasTerminalResponseSuffix(text: string, responseSuffix: string): boolean {
  const textEnd = text.trimEnd();
  const suffixEnd = responseSuffix.trimEnd();
  const marker = suffixEnd.trim();
  if (!marker) {
    return true;
  }
  if (/^\s/u.test(suffixEnd) && textEnd.endsWith(suffixEnd)) {
    return true;
  }
  return textEnd === marker || textEnd.endsWith(`\n${marker}`);
}

export function normalizeReplyPayload(
  payload: ReplyPayload,
  opts: NormalizeReplyOptions = {},
): ReplyPayload | null {
  const applyChannelTransforms = opts.applyChannelTransforms ?? true;
  const hasContent = (text: string | undefined) =>
    hasReplyPayloadContent(
      {
        ...payload,
        text,
      },
      {
        trimText: true,
      },
    );
  const trimmed = normalizeOptionalString(payload.text) ?? "";
  if (!hasContent(trimmed)) {
    opts.onSkip?.("empty");
    return null;
  }

  const silentToken = opts.silentToken ?? SILENT_REPLY_TOKEN;
  let text = payload.text ?? undefined;
  if (text && isSilentReplyPayloadText(text, silentToken)) {
    if (!hasContent("")) {
      opts.onSkip?.("silent");
      return null;
    }
    text = "";
  }
  // Strip NO_REPLY from mixed-content messages (e.g. "😄 NO_REPLY") so the
  // token never leaks to end users.  If stripping leaves nothing, treat it as
  // silent just like the exact-match path above.  (#30916, #30955)
  if (text && !isSilentReplyText(text, silentToken)) {
    const hasLeadingSilentToken = startsWithSilentToken(text, silentToken);
    if (hasLeadingSilentToken) {
      text = stripLeadingSilentToken(text, silentToken);
    }
    if (hasLeadingSilentToken || text.toLowerCase().includes(silentToken.toLowerCase())) {
      text = stripSilentToken(text, silentToken);
      if (!hasContent(text)) {
        opts.onSkip?.("silent");
        return null;
      }
    }
  }
  if (text && !trimmed) {
    // Keep empty text when media exists so media-only replies still send.
    text = "";
  }

  const shouldStripHeartbeat = opts.stripHeartbeat ?? true;
  if (shouldStripHeartbeat && text?.includes(HEARTBEAT_TOKEN)) {
    const stripped = stripHeartbeatToken(text, { mode: "message" });
    if (stripped.didStrip) {
      opts.onHeartbeatStrip?.();
    }
    if (stripped.shouldSkip && !hasContent(stripped.text)) {
      opts.onSkip?.("heartbeat");
      return null;
    }
    text = stripped.text;
  }

  if (text) {
    text = sanitizeUserFacingText(text, { errorContext: Boolean(payload.isError) });
  }
  if (!hasContent(text)) {
    opts.onSkip?.("empty");
    return null;
  }

  let enrichedPayload: ReplyPayload = { ...payload, text };
  if (applyChannelTransforms && opts.transformReplyPayload) {
    enrichedPayload = opts.transformReplyPayload(enrichedPayload) ?? enrichedPayload;
    text = enrichedPayload.text;
  }

  // Resolve template variables in responsePrefix if context is provided
  const effectivePrefix = opts.responsePrefixContext
    ? resolveResponsePrefixTemplate(opts.responsePrefix, opts.responsePrefixContext)
    : opts.responsePrefix;

  if (
    effectivePrefix &&
    text &&
    text.trim() !== HEARTBEAT_TOKEN &&
    !text.startsWith(effectivePrefix)
  ) {
    text = `${effectivePrefix} ${text}`;
  }

  const responseSuffix = opts.responseSuffix;
  if (responseSuffix && text) {
    if (!hasTerminalResponseSuffix(text, responseSuffix)) {
      text = `${text.trimEnd()}${responseSuffix}`;
    }
  }

  enrichedPayload = { ...enrichedPayload, text };
  return enrichedPayload;
}
