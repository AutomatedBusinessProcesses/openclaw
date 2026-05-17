import { describe, expect, it } from "vitest";
import {
  handleMessageEnd,
  resolveSilentReplyFallbackText,
} from "./pi-embedded-subscribe.handlers.messages.js";

describe("resolveSilentReplyFallbackText", () => {
  it("replaces NO_REPLY with latest messaging tool text when available", () => {
    expect(
      resolveSilentReplyFallbackText({
        text: "NO_REPLY",
        messagingToolSentTexts: ["first", "final delivered text"],
      }),
    ).toBe("final delivered text");
  });

  it("keeps original text when response is not NO_REPLY", () => {
    expect(
      resolveSilentReplyFallbackText({
        text: "normal assistant reply",
        messagingToolSentTexts: ["final delivered text"],
      }),
    ).toBe("normal assistant reply");
  });

  it("keeps NO_REPLY when there is no messaging tool text to mirror", () => {
    expect(
      resolveSilentReplyFallbackText({
        text: "NO_REPLY",
        messagingToolSentTexts: [],
      }),
    ).toBe("NO_REPLY");
  });
});

describe("handleMessageEnd", () => {
  it("thinkingOnlyAssistantReplyFallback surfaces short transcript-like thinking as visible text", () => {
    const events: unknown[] = [];
    const ctx = {
      params: {
        runId: "run-1",
        session: { id: "session-1" },
        enforceFinalTag: false,
        onAgentEvent(event: unknown) {
          events.push(event);
        },
      },
      state: {
        includeReasoning: false,
        streamReasoning: false,
        emittedAssistantUpdate: false,
        messagingToolSentTexts: [],
      },
      noteLastAssistant() {},
      recordAssistantUsage() {},
      stripBlockTags(text: string) {
        return text;
      },
      flushBlockReplyBuffer() {},
      blockChunker: null,
      blockChunking: false,
      emitBlockChunk() {},
    } as unknown as Parameters<typeof handleMessageEnd>[0];

    handleMessageEnd(ctx, {
      type: "message",
      message: {
        role: "assistant",
        content: [
          {
            type: "thinking",
            thinking: "Testing, testing, testing.",
          },
        ],
      },
    } as unknown as Parameters<typeof handleMessageEnd>[1]);

    expect(events).toContainEqual({
      runId: "run-1",
      stream: "assistant",
      data: {
        text: "Testing, testing, testing.",
        delta: "Testing, testing, testing.",
        mediaUrls: undefined,
      },
    });
  });
});
