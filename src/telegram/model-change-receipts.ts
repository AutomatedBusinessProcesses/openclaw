import fs from "node:fs/promises";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";

export type ModelChangeReceipt = {
  id: string;
  changedAt?: string;
  source?: string;
  slotId?: string;
  slotKind?: string;
  ref: string;
  label?: string;
  previousRef?: string;
  previousLabel?: string;
  fallbackRefs?: string[];
};

const RECEIPTS_FILENAME = "model-change-receipts.json";
const MAX_RECEIPTS_PER_NOTICE = 6;

function receiptQueuePath() {
  return path.join(resolveStateDir(), RECEIPTS_FILENAME);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(cleanString).filter(Boolean);
}

function normalizeReceipt(value: unknown): ModelChangeReceipt | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const id = cleanString(raw.id);
  const ref = cleanString(raw.ref);
  if (!id || !ref) {
    return null;
  }
  return {
    id,
    changedAt: cleanString(raw.changedAt) || undefined,
    source: cleanString(raw.source) || undefined,
    slotId: cleanString(raw.slotId) || undefined,
    slotKind: cleanString(raw.slotKind) || undefined,
    ref,
    label: cleanString(raw.label) || undefined,
    previousRef: cleanString(raw.previousRef) || undefined,
    previousLabel: cleanString(raw.previousLabel) || undefined,
    fallbackRefs: cleanStringArray(raw.fallbackRefs),
  };
}

export async function readPendingModelChangeReceipts(): Promise<ModelChangeReceipt[]> {
  let raw: string;
  try {
    raw = await fs.readFile(receiptQueuePath(), "utf8");
  } catch {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(normalizeReceipt)
      .filter((entry): entry is ModelChangeReceipt => Boolean(entry));
  } catch {
    return [];
  }
}

export async function acknowledgeModelChangeReceipts(receiptIds: string[]): Promise<void> {
  const ids = new Set(receiptIds.map((id) => id.trim()).filter(Boolean));
  if (ids.size === 0) {
    return;
  }
  const filePath = receiptQueuePath();
  const pending = await readPendingModelChangeReceipts();
  const remaining = pending.filter((receipt) => !ids.has(receipt.id));
  if (remaining.length === pending.length) {
    return;
  }
  if (remaining.length === 0) {
    await fs.unlink(filePath).catch(() => undefined);
    return;
  }
  await fs.writeFile(filePath, `${JSON.stringify(remaining, null, 2)}\n`);
}

function displayName(receipt: ModelChangeReceipt): string {
  return receipt.label || receipt.ref;
}

function previousDisplayName(receipt: ModelChangeReceipt): string {
  return receipt.previousLabel || receipt.previousRef || "previous route";
}

function displayFallbacks(receipt: ModelChangeReceipt): string {
  return receipt.fallbackRefs?.length ? receipt.fallbackRefs.join(", ") : "none";
}

export function formatModelChangeReceiptNotice(receipts: ModelChangeReceipt[]): string {
  const visible = receipts.slice(-MAX_RECEIPTS_PER_NOTICE);
  const latest = visible.at(-1);
  if (!latest) {
    return "";
  }
  if (receipts.length === 1) {
    return [`Model active: ${displayName(latest)}`, `Fallback: ${displayFallbacks(latest)}`].join(
      "\n",
    );
  }
  const changeLines = visible.map(
    (receipt) => `- ${previousDisplayName(receipt)} -> ${displayName(receipt)}`,
  );
  const hiddenCount = receipts.length - visible.length;
  const hiddenLine = hiddenCount > 0 ? [`- ${hiddenCount} earlier change(s) omitted`] : [];
  return [
    `Model active: ${displayName(latest)} (${receipts.length} changes collapsed)`,
    `Fallback: ${displayFallbacks(latest)}`,
    ...hiddenLine,
    ...changeLines,
  ].join("\n");
}
