#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SECRET_KEY_PATTERN =
  /(api[_-]?key|token|secret|password|passwd|pwd|cookie|session|credential|recovery|phrase)/i;

function usage() {
  console.error(
    "usage: log-shopper-event.mjs <start|search|source|env-link|decision|final|note> [--key value ...]",
  );
  process.exit(2);
}

function parseArgs(argv) {
  const event = argv[0];
  if (!event || event.startsWith("--")) {
    usage();
  }
  const fields = {};
  for (let index = 1; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) {
      usage();
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      usage();
    }
    fields[key.slice(2)] = value;
    index += 1;
  }
  return { event, fields };
}

function defaultLogPath() {
  const stateDir = process.env.OPENCLAW_STATE_DIR || path.join(os.homedir(), ".openclaw");
  return path.join(stateDir, "workspace", "skills", "shopper", "shopper-log.md");
}

function redact(key, value) {
  if (SECRET_KEY_PATTERN.test(key) || SECRET_KEY_PATTERN.test(value)) {
    return "<redacted>";
  }
  return value;
}

function appendEntry(logPath, event, fields) {
  const now = new Date().toISOString();
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(
      logPath,
      [
        "# Shopper Research Log",
        "",
        "Durable record of shopper searches, sources, environment links, decisions, and final recommendations.",
        "Secret values must not be stored here.",
        "",
      ].join("\n"),
      { mode: 0o600 },
    );
  }

  const title = fields.title || fields.goal || fields.query || fields.url || fields.path || "entry";
  const lines = [`## ${now} - ${event}`, "", `- Title: ${redact("title", title)}`];
  for (const [key, value] of Object.entries(fields)) {
    if (key === "title" || key === "log") {
      continue;
    }
    lines.push(`- ${key}: ${redact(key, value)}`);
  }
  lines.push("");
  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, { mode: 0o600 });
  fs.chmodSync(logPath, 0o600);
}

const { event, fields } = parseArgs(process.argv.slice(2));
const logPath = fields.log ? path.resolve(fields.log) : defaultLogPath();
appendEntry(logPath, event, fields);
console.log(logPath);
