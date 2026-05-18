import { describe, expect, it } from "vitest";
import {
  formatWorkingDraftCodeBlock,
  formatWorkingDraftProgressPayload,
} from "./working-draft-format.js";

describe("working draft progress formatting", () => {
  it("wraps progress text in a copyable markdown code fence", () => {
    expect(formatWorkingDraftCodeBlock("Snapping...\nExec: list files")).toBe(
      "```text\nWORKING DRAFT\nSnapping...\nExec: list files\n```",
    );
  });

  it("does not double-wrap existing draft or status code blocks", () => {
    const draft = "```text\nWORKING DRAFT\n- already formatted\n```";
    const status = "```text\nSTATUS\n- already formatted\n```";

    expect(formatWorkingDraftCodeBlock(draft)).toBe(draft);
    expect(formatWorkingDraftCodeBlock(status)).toBe(status);
  });

  it("still wraps notes that merely contain an older draft block later", () => {
    expect(formatWorkingDraftCodeBlock("Before\n```text\nWORKING DRAFT\nold\n```")).toBe(
      "````text\nWORKING DRAFT\nBefore\n```text\nWORKING DRAFT\nold\n```\n````",
    );
  });

  it("uses a longer fence when the progress text contains markdown fences", () => {
    expect(formatWorkingDraftCodeBlock("Read:\n```ts\nconst ok = true;\n```")).toBe(
      "````text\nWORKING DRAFT\nRead:\n```ts\nconst ok = true;\n```\n````",
    );
  });

  it("leaves media and exec approval payloads alone", () => {
    const mediaPayload = { text: "caption", mediaUrl: "https://example.com/a.png" };
    const approvalPayload = {
      text: "Approval required",
      channelData: { execApproval: { approvalSlug: "abc123" } },
    };

    expect(formatWorkingDraftProgressPayload(mediaPayload)).toBe(mediaPayload);
    expect(formatWorkingDraftProgressPayload(approvalPayload)).toBe(approvalPayload);
  });
});
