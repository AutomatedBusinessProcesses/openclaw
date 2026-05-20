import type { Bot } from "grammy";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAutoTopicLabelConfig as resolveAutoTopicLabelConfigRuntime } from "./auto-topic-label-config.js";
import type { TelegramBotDeps } from "./bot-deps.js";
import {
  createSequencedTestDraftStream,
  createTestDraftStream,
} from "./draft-stream.test-helpers.js";

type DispatchReplyWithBufferedBlockDispatcherArgs = Parameters<
  TelegramBotDeps["dispatchReplyWithBufferedBlockDispatcher"]
>[0];
type ChannelMessageReplyPipeline = ReturnType<
  NonNullable<TelegramBotDeps["createChannelMessageReplyPipeline"]>
>;

const createTelegramDraftStream = vi.hoisted(() => vi.fn());
const dispatchReplyWithBufferedBlockDispatcher = vi.hoisted(() =>
  vi.fn<(params: DispatchReplyWithBufferedBlockDispatcherArgs) => Promise<unknown>>(),
);
const deliverReplies = vi.hoisted(() => vi.fn());
const deliverInboundReplyWithMessageSendContext = vi.hoisted(() => vi.fn());
const emitInternalMessageSentHook = vi.hoisted(() => vi.fn());
const createForumTopicTelegram = vi.hoisted(() => vi.fn());
const deleteMessageTelegram = vi.hoisted(() => vi.fn());
const editForumTopicTelegram = vi.hoisted(() => vi.fn());
const editMessageTelegram = vi.hoisted(() => vi.fn());
const reactMessageTelegram = vi.hoisted(() => vi.fn());
const sendMessageTelegram = vi.hoisted(() => vi.fn());
const sendPollTelegram = vi.hoisted(() => vi.fn());
const sendStickerTelegram = vi.hoisted(() => vi.fn());
const loadConfig = vi.hoisted(() => vi.fn(() => ({})));
const readChannelAllowFromStore = vi.hoisted(() => vi.fn(async () => []));
const upsertChannelPairingRequest = vi.hoisted(() =>
  vi.fn(async () => ({
    code: "PAIRCODE",
    created: true,
  })),
);
const enqueueSystemEvent = vi.hoisted(() => vi.fn());
const buildModelsProviderData = vi.hoisted(() =>
  vi.fn(async () => ({
    byProvider: new Map<string, Set<string>>(),
    providers: [],
    resolvedDefault: { provider: "openai", model: "gpt-test" },
    modelNames: new Map<string, string>(),
  })),
);
const listSkillCommandsForAgents = vi.hoisted(() => vi.fn(() => []));
const createChannelMessageReplyPipeline = vi.hoisted(() =>
  vi.fn<() => ChannelMessageReplyPipeline>(() => ({
    responsePrefix: undefined,
    responseSuffix: undefined,
    responsePrefixContextProvider: () => ({ identityName: undefined }),
    onModelSelected: () => undefined,
  })),
);
const wasSentByBot = vi.hoisted(() => vi.fn(() => false));
const loadSessionStore = vi.hoisted(() => vi.fn());
const resolveStorePath = vi.hoisted(() => vi.fn(() => "/tmp/sessions.json"));
const generateTopicLabel = vi.hoisted(() => vi.fn());
const readPendingModelChangeReceipts = vi.hoisted(() => vi.fn());
const acknowledgeModelChangeReceipts = vi.hoisted(() => vi.fn());
const formatModelChangeReceiptNotice = vi.hoisted(() => vi.fn());
const describeStickerImage = vi.hoisted(() => vi.fn(async () => null));
const loadModelCatalog = vi.hoisted(() => vi.fn(async () => ({})));
const findModelInCatalog = vi.hoisted(() => vi.fn(() => null));
const modelSupportsVision = vi.hoisted(() => vi.fn(() => false));
const resolveAgentDir = vi.hoisted(() => vi.fn(() => "/tmp/agent"));
const resolveDefaultModelForAgent = vi.hoisted(() =>
  vi.fn(() => ({ provider: "openai", model: "gpt-test" })),
);
const getAgentScopedMediaLocalRoots = vi.hoisted(() =>
  vi.fn((_cfg: unknown, agentId: string) => [`/tmp/.openclaw/workspace-${agentId}`]),
);
const resolveChunkMode = vi.hoisted(() => vi.fn(() => undefined));
const resolveMarkdownTableMode = vi.hoisted(() => vi.fn(() => "preserve"));
const resolveSessionStoreEntry = vi.hoisted(() =>
  vi.fn(({ store, sessionKey }: { store: Record<string, unknown>; sessionKey: string }) => ({
    existing: store[sessionKey],
  })),
);

vi.mock("./draft-stream.js", () => ({
  createTelegramDraftStream,
}));

vi.mock("openclaw/plugin-sdk/channel-message", async (importOriginal) => {
  const actual = await importOriginal<typeof import("openclaw/plugin-sdk/channel-message")>();
  return {
    ...actual,
    deliverInboundReplyWithMessageSendContext,
  };
});

vi.mock("./bot/delivery.js", () => ({
  deliverReplies,
  emitInternalMessageSentHook,
}));

vi.mock("./bot/delivery.replies.js", () => ({
  deliverReplies,
  emitInternalMessageSentHook,
}));

vi.mock("./send.js", () => ({
  createForumTopicTelegram,
  deleteMessageTelegram,
  editForumTopicTelegram,
  editMessageTelegram,
  reactMessageTelegram,
  sendMessageTelegram,
  sendPollTelegram,
  sendStickerTelegram,
}));

vi.mock("./bot-message-dispatch.runtime.js", () => ({
  generateTopicLabel,
  getAgentScopedMediaLocalRoots,
  loadSessionStore,
  resolveAutoTopicLabelConfig: resolveAutoTopicLabelConfigRuntime,
  resolveChunkMode,
  resolveMarkdownTableMode,
  resolveSessionStoreEntry,
  resolveStorePath,
}));

vi.mock("./model-change-receipts.js", () => ({
  readPendingModelChangeReceipts,
  acknowledgeModelChangeReceipts,
  formatModelChangeReceiptNotice,
}));

vi.mock("./bot-message-dispatch.agent.runtime.js", () => ({
  findModelInCatalog,
  loadModelCatalog,
  modelSupportsVision,
  resolveAgentDir,
  resolveDefaultModelForAgent,
}));

vi.mock("./sticker-cache.js", () => ({
  cacheSticker: vi.fn(),
  getCachedSticker: () => null,
  getCacheStats: () => ({ count: 0 }),
  searchStickers: () => [],
  getAllCachedStickers: () => [],
  describeStickerImage,
}));

let dispatchTelegramMessage: typeof import("./bot-message-dispatch.js").dispatchTelegramMessage;
let resetTelegramReplyFenceForTests: typeof import("./bot-message-dispatch.js").resetTelegramReplyFenceForTests;

const telegramDepsForTest: TelegramBotDeps = {
  getRuntimeConfig: loadConfig as TelegramBotDeps["getRuntimeConfig"],
  resolveStorePath: resolveStorePath as TelegramBotDeps["resolveStorePath"],
  loadSessionStore: loadSessionStore as TelegramBotDeps["loadSessionStore"],
  readChannelAllowFromStore:
    readChannelAllowFromStore as TelegramBotDeps["readChannelAllowFromStore"],
  upsertChannelPairingRequest:
    upsertChannelPairingRequest as TelegramBotDeps["upsertChannelPairingRequest"],
  enqueueSystemEvent: enqueueSystemEvent as TelegramBotDeps["enqueueSystemEvent"],
  dispatchReplyWithBufferedBlockDispatcher:
    dispatchReplyWithBufferedBlockDispatcher as TelegramBotDeps["dispatchReplyWithBufferedBlockDispatcher"],
  buildModelsProviderData: buildModelsProviderData as TelegramBotDeps["buildModelsProviderData"],
  listSkillCommandsForAgents:
    listSkillCommandsForAgents as TelegramBotDeps["listSkillCommandsForAgents"],
  createChannelMessageReplyPipeline:
    createChannelMessageReplyPipeline as TelegramBotDeps["createChannelMessageReplyPipeline"],
  wasSentByBot: wasSentByBot as TelegramBotDeps["wasSentByBot"],
  createTelegramDraftStream:
    createTelegramDraftStream as TelegramBotDeps["createTelegramDraftStream"],
  deliverReplies: deliverReplies as TelegramBotDeps["deliverReplies"],
  deliverInboundReplyWithMessageSendContext:
    deliverInboundReplyWithMessageSendContext as TelegramBotDeps["deliverInboundReplyWithMessageSendContext"],
  emitInternalMessageSentHook:
    emitInternalMessageSentHook as TelegramBotDeps["emitInternalMessageSentHook"],
  editMessageTelegram: editMessageTelegram as TelegramBotDeps["editMessageTelegram"],
};

describe("dispatchTelegramMessage draft streaming", () => {
  type TelegramMessageContext = Parameters<typeof dispatchTelegramMessage>[0]["context"];

  beforeAll(async () => {
    ({ dispatchTelegramMessage, resetTelegramReplyFenceForTests } =
      await import("./bot-message-dispatch.js"));
  });

  beforeEach(() => {
    resetTelegramReplyFenceForTests();
    createTelegramDraftStream.mockReset();
    dispatchReplyWithBufferedBlockDispatcher.mockReset();
    deliverReplies.mockReset();
    deliverInboundReplyWithMessageSendContext.mockReset();
    emitInternalMessageSentHook.mockReset();
    createForumTopicTelegram.mockReset();
    deleteMessageTelegram.mockReset();
    editForumTopicTelegram.mockReset();
    editMessageTelegram.mockReset();
    reactMessageTelegram.mockReset();
    sendMessageTelegram.mockReset();
    sendPollTelegram.mockReset();
    sendStickerTelegram.mockReset();
    loadConfig.mockReset();
    readChannelAllowFromStore.mockReset();
    upsertChannelPairingRequest.mockReset();
    enqueueSystemEvent.mockReset();
    buildModelsProviderData.mockReset();
    listSkillCommandsForAgents.mockReset();
    createChannelMessageReplyPipeline.mockReset();
    wasSentByBot.mockReset();
    loadSessionStore.mockReset();
    resolveStorePath.mockReset();
    generateTopicLabel.mockReset();
    readPendingModelChangeReceipts.mockReset();
    acknowledgeModelChangeReceipts.mockReset();
    formatModelChangeReceiptNotice.mockReset();
    getAgentScopedMediaLocalRoots.mockClear();
    resolveChunkMode.mockClear();
    resolveMarkdownTableMode.mockClear();
    resolveSessionStoreEntry.mockClear();
    describeStickerImage.mockReset();
    loadModelCatalog.mockReset();
    findModelInCatalog.mockReset();
    modelSupportsVision.mockReset();
    resolveAgentDir.mockReset();
    resolveDefaultModelForAgent.mockReset();
    loadConfig.mockReturnValue({});
    dispatchReplyWithBufferedBlockDispatcher.mockResolvedValue({
      queuedFinal: false,
      counts: { block: 0, final: 0, tool: 0 },
    });
    deliverReplies.mockResolvedValue({ delivered: true });
    deliverInboundReplyWithMessageSendContext.mockResolvedValue({
      status: "unsupported",
      reason: "missing_outbound_handler",
    });
    emitInternalMessageSentHook.mockResolvedValue(undefined);
    createForumTopicTelegram.mockResolvedValue({ message_thread_id: 777 });
    deleteMessageTelegram.mockResolvedValue(true);
    editForumTopicTelegram.mockResolvedValue(true);
    editMessageTelegram.mockResolvedValue({ ok: true });
    reactMessageTelegram.mockResolvedValue(true);
    sendMessageTelegram.mockResolvedValue({ message_id: 1001 });
    sendPollTelegram.mockResolvedValue({ message_id: 1001 });
    sendStickerTelegram.mockResolvedValue({ message_id: 1001 });
    readChannelAllowFromStore.mockResolvedValue([]);
    upsertChannelPairingRequest.mockResolvedValue({
      code: "PAIRCODE",
      created: true,
    });
    enqueueSystemEvent.mockResolvedValue(undefined);
    readPendingModelChangeReceipts.mockResolvedValue([]);
    formatModelChangeReceiptNotice.mockReturnValue("");
    buildModelsProviderData.mockResolvedValue({
      byProvider: new Map<string, Set<string>>(),
      providers: [],
      resolvedDefault: { provider: "openai", model: "gpt-test" },
      modelNames: new Map<string, string>(),
    });
    listSkillCommandsForAgents.mockReturnValue([]);
    createChannelMessageReplyPipeline.mockReturnValue({
      responsePrefix: undefined,
      responseSuffix: undefined,
      responsePrefixContextProvider: () => ({ identityName: undefined }),
      onModelSelected: () => undefined,
    });
    wasSentByBot.mockReturnValue(false);
    resolveStorePath.mockReturnValue("/tmp/sessions.json");
    loadSessionStore.mockReturnValue({});
    generateTopicLabel.mockResolvedValue("Topic label");
    describeStickerImage.mockResolvedValue(null);
    loadModelCatalog.mockResolvedValue({});
    findModelInCatalog.mockReturnValue(null);
    modelSupportsVision.mockReturnValue(false);
    resolveAgentDir.mockReturnValue("/tmp/agent");
    resolveDefaultModelForAgent.mockReturnValue({
      provider: "openai",
      model: "gpt-test",
    });
  });

  const createDraftStream = (messageId?: number) => createTestDraftStream({ messageId });
  const createSequencedDraftStream = (startMessageId = 1001) =>
    createSequencedTestDraftStream(startMessageId);

  function setupDraftStreams(params?: { answerMessageId?: number; reasoningMessageId?: number }) {
    const answerDraftStream = createDraftStream(params?.answerMessageId);
    const reasoningDraftStream = createDraftStream(params?.reasoningMessageId);
    createTelegramDraftStream
      .mockImplementationOnce(() => answerDraftStream)
      .mockImplementationOnce(() => reasoningDraftStream);
    return { answerDraftStream, reasoningDraftStream };
  }

  function workingDraftPreview(body: string): string {
    return `\`\`\`text\nWORKING DRAFT\n${body}\n\`\`\``;
  }

  function workingDraftRegex(body: string): RegExp {
    return new RegExp(
      `^\\\`\\\`\\\`text\\nWORKING DRAFT\\nLog: .*telegram-working-drafts.*\\n${body}\\n\\\`\\\`\\\`$`,
      "s",
    );
  }

  function createContext(overrides?: Partial<TelegramMessageContext>): TelegramMessageContext {
    const base = {
      ctxPayload: {},
      primaryCtx: { message: { chat: { id: 123, type: "private" } } },
      msg: {
        chat: { id: 123, type: "private" },
        message_id: 456,
        message_thread_id: 777,
      },
      chatId: 123,
      isGroup: false,
      groupConfig: undefined,
      resolvedThreadId: undefined,
      replyThreadId: 777,
      threadSpec: { id: 777, scope: "dm" },
      historyKey: undefined,
      historyLimit: 0,
      groupHistories: new Map(),
      route: { agentId: "default", accountId: "default" },
      skillFilter: undefined,
      sendTyping: vi.fn(),
      sendRecordVoice: vi.fn(),
      ackReactionPromise: null,
      reactionApi: null,
      removeAckAfterReply: false,
    } as unknown as TelegramMessageContext;
    base.turn = {
      storePath: "/tmp/openclaw/telegram-sessions.json",
      recordInboundSession: vi.fn(async () => undefined),
      record: {
        onRecordError: vi.fn(),
      },
    } as unknown as TelegramMessageContext["turn"];

    return {
      ...base,
      ...overrides,
      // Merge nested fields when overrides provide partial objects.
      primaryCtx: {
        ...(base.primaryCtx as object),
        ...(overrides?.primaryCtx ? (overrides.primaryCtx as object) : null),
      } as TelegramMessageContext["primaryCtx"],
      msg: {
        ...(base.msg as object),
        ...(overrides?.msg ? (overrides.msg as object) : null),
      } as TelegramMessageContext["msg"],
      route: {
        ...(base.route as object),
        ...(overrides?.route ? (overrides.route as object) : null),
      } as TelegramMessageContext["route"],
    };
  }

  function createStatusReactionController() {
    return {
      setQueued: vi.fn(),
      setThinking: vi.fn(async () => {}),
      setTool: vi.fn(async () => {}),
      setCompacting: vi.fn(async () => {}),
      cancelPending: vi.fn(),
      setError: vi.fn(async () => {}),
      setDone: vi.fn(async () => {}),
      restoreInitial: vi.fn(async () => {}),
    };
  }

  function observeDeliveredReply(text: string): Promise<void> {
    return new Promise((resolve) => {
      deliverReplies.mockImplementation(async (params: { replies?: Array<{ text?: string }> }) => {
        if (params.replies?.some((reply) => reply.text === text)) {
          resolve();
        }
        return { delivered: true };
      });
    });
  }

  function createBot(): Bot {
    return {
      api: {
        sendMessage: vi.fn(async (_chatId, _text, params) => ({
          message_id:
            typeof params?.message_thread_id === "number" ? params.message_thread_id : 1001,
        })),
        editMessageText: vi.fn(async () => ({ message_id: 1001 })),
        deleteMessage: vi.fn().mockResolvedValue(true),
        editForumTopic: vi.fn().mockResolvedValue(true),
      },
    } as unknown as Bot;
  }

  it("enforces local access boundaries for unsandboxed Telegram-originated turns", async () => {
    const context = createContext();

    await dispatchWithContext({
      context,
      cfg: { tools: { fs: { workspaceOnly: false } } },
    });

    expect(getAgentScopedMediaLocalRoots).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.objectContaining({
          deny: expect.arrayContaining([
            "bash",
            "exec",
            "process",
            "agents_list",
            "sessions_list",
            "sessions_history",
            "sessions_spawn",
            "sessions_send",
            "sessions_yield",
            "subagents",
          ]),
          fs: expect.objectContaining({ workspaceOnly: true }),
        }),
      }),
      "default",
    );
    expect(dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalledWith(
      expect.objectContaining({
        cfg: expect.objectContaining({
          tools: expect.objectContaining({
            deny: expect.arrayContaining([
              "bash",
              "exec",
              "process",
              "agents_list",
              "sessions_list",
              "sessions_history",
              "sessions_spawn",
              "sessions_send",
              "sessions_yield",
              "subagents",
            ]),
            fs: expect.objectContaining({ workspaceOnly: true }),
          }),
        }),
      }),
    );
  });

  it("preserves explicit Telegram tool denylist entries while hardening local access", async () => {
    const context = createContext();

    await dispatchWithContext({
      context,
      cfg: { tools: { deny: ["web_search"], fs: { workspaceOnly: false } } },
    });

    expect(dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalledWith(
      expect.objectContaining({
        cfg: expect.objectContaining({
          tools: expect.objectContaining({
            deny: expect.arrayContaining([
              "web_search",
              "bash",
              "exec",
              "process",
              "agents_list",
              "sessions_list",
              "sessions_history",
              "sessions_spawn",
              "sessions_send",
              "sessions_yield",
              "subagents",
            ]),
            fs: expect.objectContaining({ workspaceOnly: true }),
          }),
        }),
      }),
    );
  });

  it("uses the shared research workspace for Telegram-originated turns when configured", async () => {
    const context = createContext({ route: { agentId: "ops" } as TelegramMessageContext["route"] });
    const originalSharedWorkspace = process.env.OPENCLAW_SHARED_RESEARCH_WORKSPACE;
    process.env.OPENCLAW_SHARED_RESEARCH_WORKSPACE = "/tmp/shared-research/OpenClaw";
    try {
      await dispatchWithContext({
        context,
        cfg: {
          agents: { list: [{ id: "ops", workspace: "/tmp/private-workspace" }] },
          tools: { fs: { workspaceOnly: false } },
        },
      });
    } finally {
      if (originalSharedWorkspace === undefined) {
        delete process.env.OPENCLAW_SHARED_RESEARCH_WORKSPACE;
      } else {
        process.env.OPENCLAW_SHARED_RESEARCH_WORKSPACE = originalSharedWorkspace;
      }
    }

    expect(dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalledWith(
      expect.objectContaining({
        cfg: expect.objectContaining({
          agents: expect.objectContaining({
            defaults: expect.objectContaining({
              workspace: "/tmp/shared-research/OpenClaw",
            }),
            list: expect.arrayContaining([
              expect.objectContaining({
                id: "ops",
                workspace: "/tmp/shared-research/OpenClaw",
              }),
            ]),
          }),
          tools: expect.objectContaining({
            fs: expect.objectContaining({ workspaceOnly: true }),
          }),
        }),
      }),
    );
  });

  it("allows local execution tools for fully sandboxed Telegram agents", async () => {
    const context = createContext({ route: { agentId: "ops" } as TelegramMessageContext["route"] });

    await dispatchWithContext({
      context,
      cfg: {
        agents: { list: [{ id: "ops", sandbox: { mode: "all" } }] },
        tools: { fs: { workspaceOnly: false } },
      },
    });

    expect(dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalledWith(
      expect.objectContaining({
        cfg: expect.objectContaining({
          tools: expect.objectContaining({
            fs: expect.objectContaining({ workspaceOnly: true }),
          }),
        }),
      }),
    );
    const hardenedCfg = vi
      .mocked(dispatchReplyWithBufferedBlockDispatcher)
      .mock.calls.at(-1)?.[0].cfg;
    expect(hardenedCfg?.tools?.deny ?? []).not.toEqual(expect.arrayContaining(["exec", "process"]));
  });

  function createRuntime(): Parameters<typeof dispatchTelegramMessage>[0]["runtime"] {
    return {
      log: vi.fn(),
      error: vi.fn(),
      exit: () => {
        throw new Error("exit");
      },
    };
  }

  async function dispatchWithContext(params: {
    context: TelegramMessageContext;
    cfg?: Parameters<typeof dispatchTelegramMessage>[0]["cfg"];
    telegramCfg?: Parameters<typeof dispatchTelegramMessage>[0]["telegramCfg"];
    streamMode?: Parameters<typeof dispatchTelegramMessage>[0]["streamMode"];
    telegramDeps?: TelegramBotDeps;
    bot?: Bot;
    replyToMode?: Parameters<typeof dispatchTelegramMessage>[0]["replyToMode"];
    textLimit?: number;
  }) {
    const bot = params.bot ?? createBot();
    await dispatchTelegramMessage({
      context: params.context,
      bot,
      cfg: params.cfg ?? {},
      runtime: createRuntime(),
      replyToMode: params.replyToMode ?? "first",
      streamMode: params.streamMode ?? "partial",
      textLimit: params.textLimit ?? 4096,
      telegramCfg: params.telegramCfg ?? {},
      telegramDeps: params.telegramDeps ?? telegramDepsForTest,
      opts: { token: "token" },
    });
  }

  function createReasoningStreamContext(): TelegramMessageContext {
    loadSessionStore.mockReturnValue({
      s1: { reasoningLevel: "stream" },
    });
    return createContext({
      ctxPayload: { SessionKey: "s1" } as unknown as TelegramMessageContext["ctxPayload"],
    });
  }

  function createReasoningDefaultContext(): TelegramMessageContext {
    loadSessionStore.mockReturnValue({
      s1: {},
    });
    return createContext({
      ctxPayload: { SessionKey: "s1" } as unknown as TelegramMessageContext["ctxPayload"],
      route: { agentId: "ops" } as unknown as TelegramMessageContext["route"],
    });
  }

  it("streams drafts in private threads and forwards thread id", async () => {
    const draftStream = createDraftStream();
    createTelegramDraftStream.mockReturnValue(draftStream);
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(
      async ({ dispatcherOptions, replyOptions }) => {
        await replyOptions?.onPartialReply?.({ text: "Hello" });
        await dispatcherOptions.deliver({ text: "Hello" }, { kind: "final" });
        return { queuedFinal: true };
      },
    );
    deliverReplies.mockResolvedValue({ delivered: true });

    const context = createContext({
      route: {
        agentId: "work",
      } as unknown as TelegramMessageContext["route"],
    });
    await dispatchWithContext({ context });

    expect(createTelegramDraftStream).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 123,
        thread: { id: 777, scope: "dm" },
        minInitialChars: 30,
      }),
    );
    expect(draftStream.update).toHaveBeenCalledWith("Hello");
    expect(deliverReplies).toHaveBeenCalledWith(
      expect.objectContaining({
        thread: { id: 777, scope: "dm" },
        mediaLocalRoots: expect.arrayContaining([
          expect.stringMatching(/[\\/]\.openclaw[\\/]workspace-work$/u),
        ]),
      }),
    );
    expect(dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatcherOptions: expect.objectContaining({
          beforeDeliver: expect.any(Function),
        }),
        replyOptions: expect.objectContaining({
          disableBlockStreaming: true,
        }),
      }),
    );
    expect(editMessageTelegram).not.toHaveBeenCalled();
    expect(draftStream.discard).toHaveBeenCalledTimes(1);
    expect(draftStream.clear).not.toHaveBeenCalled();
  });

  it("flushes pending partial drafts instead of clearing them when no final arrives", async () => {
    const draftStream = createDraftStream();
    createTelegramDraftStream.mockReturnValue(draftStream);
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ replyOptions }) => {
      await replyOptions?.onPartialReply?.({ text: "Working draft" });
      return { queuedFinal: false };
    });

    await dispatchWithContext({ context: createContext() });

    expect(draftStream.update).toHaveBeenCalledWith("Working draft");
    expect(draftStream.stop).toHaveBeenCalledTimes(1);
    expect(draftStream.clear).not.toHaveBeenCalled();
    expect(deliverReplies).not.toHaveBeenCalled();
  });

  it("keeps all superseded draft previews", async () => {
    const draftStream = createDraftStream();
    const bot = createBot();
    createTelegramDraftStream.mockReturnValue(draftStream);
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(
      async ({ dispatcherOptions, replyOptions }) => {
        await replyOptions?.onPartialReply?.({ text: "Hello" });
        await dispatcherOptions.deliver({ text: "Hello" }, { kind: "final" });
        return { queuedFinal: true };
      },
    );
    deliverReplies.mockResolvedValue({ delivered: true });

    await dispatchWithContext({ context: createContext(), bot });

    const streamParams = createTelegramDraftStream.mock.calls[0]?.[0] as Parameters<
      NonNullable<TelegramBotDeps["createTelegramDraftStream"]>
    >[0];
    streamParams.onSupersededPreview?.({
      messageId: 17,
      textSnapshot: "first page",
      retain: true,
    });
    expect(bot.api.deleteMessage).not.toHaveBeenCalled();

    streamParams.onSupersededPreview?.({
      messageId: 18,
      textSnapshot: "stale page",
    });
    expect(bot.api.deleteMessage).not.toHaveBeenCalled();
  });

  it("queues final Telegram replies through outbound delivery when available", async () => {
    deliverInboundReplyWithMessageSendContext.mockResolvedValue({
      status: "handled_visible",
      delivery: {
        messageIds: ["1001"],
        visibleReplySent: true,
      },
    });
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.deliver({ text: "Hello queued" }, { kind: "final" });
      return { queuedFinal: true };
    });

    await dispatchWithContext({
      context: createContext({
        ctxPayload: {
          SessionKey: "s1",
          ChatType: "direct",
          SenderId: "42",
          SenderName: "Alice",
          SenderUsername: "alice",
        } as unknown as TelegramMessageContext["ctxPayload"],
      }),
      streamMode: "off",
      telegramDeps: telegramDepsForTest,
    });

    expect(deliverInboundReplyWithMessageSendContext).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "telegram",
        to: "123",
        accountId: "default",
        payload: expect.objectContaining({ text: "Hello queued" }),
        info: { kind: "final" },
        replyToMode: "first",
        threadId: 777,
        formatting: expect.objectContaining({ textLimit: 4096, tableMode: "preserve" }),
        agentId: "default",
        ctxPayload: expect.objectContaining({
          SessionKey: "s1",
          ChatType: "direct",
          SenderId: "42",
          SenderName: "Alice",
          SenderUsername: "alice",
        }),
      }),
    );
    expect(deliverReplies).not.toHaveBeenCalled();
  });

  it("sends a control-plane model receipt before the model reply", async () => {
    const bot = createBot();
    const sendMessage = vi.spyOn(bot.api, "sendMessage");
    const receipts = [{ id: "receipt-1", ref: "openrouter/deepseek/deepseek-v4-flash" }];
    readPendingModelChangeReceipts.mockResolvedValue(receipts);
    formatModelChangeReceiptNotice.mockReturnValue("OpenClaw model changed: Pro -> Flash");
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.deliver({ text: "Hello" }, { kind: "final" });
      return { queuedFinal: true };
    });
    deliverReplies.mockResolvedValue({ delivered: true });

    await dispatchWithContext({ context: createContext(), bot });

    expect(sendMessage).toHaveBeenCalledWith(123, "OpenClaw model changed: Pro -> Flash", {
      message_thread_id: 777,
    });
    expect(acknowledgeModelChangeReceipts).toHaveBeenCalledWith(["receipt-1"]);
    expect(dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalled();
  });

  it("passes configured Telegram responseSuffix into final dispatch normalization", async () => {
    createChannelMessageReplyPipeline.mockReturnValue({
      responsePrefix: undefined,
      responseSuffix: "\n\nEND",
      responsePrefixContextProvider: () => ({ identityName: undefined }),
      onModelSelected: () => undefined,
    });
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.deliver({ text: "Done" }, { kind: "final" });
      return { queuedFinal: true };
    });
    deliverReplies.mockResolvedValue({ delivered: true });

    await dispatchWithContext({ context: createContext() });

    expect(dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatcherOptions: expect.objectContaining({
          responseSuffix: "\n\nEND",
        }),
      }),
    );
  });

  it("queues media-only final Telegram replies through outbound delivery when available", async () => {
    deliverInboundReplyWithMessageSendContext.mockResolvedValue({
      status: "handled_visible",
      delivery: {
        messageIds: ["1002"],
        visibleReplySent: true,
      },
    });
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.deliver({ mediaUrl: "file:///tmp/final.png" }, { kind: "final" });
      return { queuedFinal: true };
    });

    await dispatchWithContext({
      context: createContext(),
      streamMode: "off",
      telegramDeps: telegramDepsForTest,
    });

    expect(deliverInboundReplyWithMessageSendContext).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "telegram",
        payload: expect.objectContaining({ mediaUrl: "file:///tmp/final.png" }),
        info: { kind: "final" },
        requiredCapabilities: expect.objectContaining({
          media: true,
          payload: true,
        }),
      }),
    );
    expect(deliverReplies).not.toHaveBeenCalled();
  });

  it("skips answer draft stream for same-chat selected quotes", async () => {
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.deliver({ text: "Hello", replyToId: "1001" }, { kind: "final" });
      return { queuedFinal: true };
    });
    deliverReplies.mockResolvedValue({ delivered: true });

    await dispatchWithContext({
      context: createContext({
        msg: {
          message_id: 1001,
        } as unknown as TelegramMessageContext["msg"],
        ctxPayload: {
          MessageSid: "1001",
          ReplyToId: "9001",
          ReplyToBody: "quoted slice",
          ReplyToQuoteText: " quoted slice\n",
          ReplyToIsQuote: true,
        } as unknown as TelegramMessageContext["ctxPayload"],
      }),
    });

    expect(createTelegramDraftStream).not.toHaveBeenCalled();
    expect(deliverReplies).toHaveBeenCalledWith(
      expect.objectContaining({
        replies: [expect.objectContaining({ replyToId: "9001" })],
        replyQuoteMessageId: 9001,
        replyQuoteText: " quoted slice\n",
      }),
    );
  });

  it("keeps answer draft stream for current message replies with native quote candidates", async () => {
    const draftStream = createDraftStream();
    createTelegramDraftStream.mockReturnValue(draftStream);
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.deliver({ text: "Hello", replyToId: "1001" }, { kind: "final" });
      return { queuedFinal: true };
    });
    deliverReplies.mockResolvedValue({ delivered: true });

    await dispatchWithContext({
      context: createContext({
        msg: {
          message_id: 1001,
          text: "Original current message",
          entities: [{ type: "bold", offset: 0, length: 8 }],
        } as unknown as TelegramMessageContext["msg"],
        ctxPayload: {
          MessageSid: "1001",
        } as unknown as TelegramMessageContext["ctxPayload"],
      }),
    });

    expect(createTelegramDraftStream).toHaveBeenCalledWith(
      expect.objectContaining({
        replyToMessageId: 1001,
      }),
    );
    expect(deliverReplies).toHaveBeenCalledWith(
      expect.objectContaining({
        replies: [expect.objectContaining({ replyToId: "1001" })],
        replyQuoteByMessageId: {
          "1001": {
            text: "Original current message",
            position: 0,
            entities: [{ type: "bold", offset: 0, length: 8 }],
          },
        },
      }),
    );
  });

  it("passes native quote candidates for explicit reply targets", async () => {
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.deliver({ text: "Hello", replyToId: "9001" }, { kind: "final" });
      return { queuedFinal: true };
    });
    deliverReplies.mockResolvedValue({ delivered: true });

    await dispatchWithContext({
      context: createContext({
        ctxPayload: {
          ReplyToId: "9001",
          ReplyToBody: "trimmed body",
          ReplyToQuoteSourceText: "  exact reply body",
          ReplyToQuoteSourceEntities: [{ type: "italic", offset: 2, length: 5 }],
        } as unknown as TelegramMessageContext["ctxPayload"],
      }),
    });

    expect(deliverReplies).toHaveBeenCalledWith(
      expect.objectContaining({
        replies: [expect.objectContaining({ replyToId: "9001" })],
        replyQuoteByMessageId: {
          "9001": {
            text: "  exact reply body",
            position: 0,
            entities: [{ type: "italic", offset: 2, length: 5 }],
          },
        },
      }),
    );
  });

  it("does not build native quote candidates when reply mode is off", async () => {
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.deliver({ text: "Hello", replyToId: "1001" }, { kind: "final" });
      return { queuedFinal: true };
    });
    deliverReplies.mockResolvedValue({ delivered: true });

    await dispatchWithContext({
      context: createContext({
        msg: {
          message_id: 1001,
          text: "Original current message",
        } as unknown as TelegramMessageContext["msg"],
        ctxPayload: {
          MessageSid: "1001",
        } as unknown as TelegramMessageContext["ctxPayload"],
      }),
      replyToMode: "off",
    });

    expect(deliverReplies.mock.calls[0]?.[0]).not.toHaveProperty("replyQuoteByMessageId.1001");
  });

  it("keeps answer draft stream for selected quotes when reply mode is off", async () => {
    const draftStream = createDraftStream();
    createTelegramDraftStream.mockReturnValue(draftStream);
    dispatchReplyWithBufferedBlockDispatcher.mockResolvedValue({ queuedFinal: true });

    await dispatchWithContext({
      context: createContext({
        msg: {
          message_id: 1001,
        } as unknown as TelegramMessageContext["msg"],
        ctxPayload: {
          MessageSid: "1001",
          ReplyToId: "9001",
          ReplyToBody: "quoted slice",
          ReplyToQuoteText: " quoted slice\n",
          ReplyToIsQuote: true,
        } as unknown as TelegramMessageContext["ctxPayload"],
      }),
      replyToMode: "off",
    });

    expect(createTelegramDraftStream).toHaveBeenCalledWith(
      expect.objectContaining({
        replyToMessageId: undefined,
      }),
    );
  });

  it("passes same-chat quoted reply target id with Telegram quote text", async () => {
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.deliver({ text: "Hello", replyToId: "1001" }, { kind: "final" });
      return { queuedFinal: true };
    });
    deliverReplies.mockResolvedValue({ delivered: true });

    await dispatchWithContext({
      context: createContext({
        ctxPayload: {
          MessageSid: "1001",
          ReplyToId: "9001",
          ReplyToBody: "quoted slice",
          ReplyToQuoteText: " quoted slice\n",
          ReplyToIsQuote: true,
          ReplyToQuotePosition: 12,
          ReplyToQuoteEntities: [{ type: "italic", offset: 0, length: 6 }],
        } as unknown as TelegramMessageContext["ctxPayload"],
      }),
      streamMode: "off",
    });

    expect(deliverReplies).toHaveBeenCalledWith(
      expect.objectContaining({
        replies: [expect.objectContaining({ replyToId: "9001" })],
        replyQuoteMessageId: 9001,
        replyQuoteText: " quoted slice\n",
        replyQuotePosition: 12,
        replyQuoteEntities: [{ type: "italic", offset: 0, length: 6 }],
      }),
    );
  });

  it("does not pass a native quote target for external replies", async () => {
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.deliver({ text: "Hello", replyToId: "1001" }, { kind: "final" });
      return { queuedFinal: true };
    });
    deliverReplies.mockResolvedValue({ delivered: true });

    await dispatchWithContext({
      context: createContext({
        ctxPayload: {
          MessageSid: "1001",
          ReplyToId: "9001",
          ReplyToBody: "external quoted slice",
          ReplyToQuoteText: " external quoted slice\n",
          ReplyToIsQuote: true,
          ReplyToIsExternal: true,
        } as unknown as TelegramMessageContext["ctxPayload"],
      }),
      streamMode: "off",
    });

    const params = deliverReplies.mock.calls[0]?.[0];
    expect(params).toEqual(
      expect.objectContaining({
        replies: [expect.objectContaining({ replyToId: "1001" })],
        replyQuoteText: " external quoted slice\n",
      }),
    );
    expect(params?.replyQuoteMessageId).toBeUndefined();
  });

  it("does not inject approval buttons in local dispatch once the monitor owns approvals", async () => {
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.deliver(
        {
          text: "Mode: foreground\nRun: /approve 117ba06d allow-once (or allow-always / deny).",
        },
        { kind: "final" },
      );
      return { queuedFinal: true };
    });
    deliverReplies.mockResolvedValue({ delivered: true });

    await dispatchWithContext({
      context: createContext(),
      streamMode: "off",
      cfg: {
        channels: {
          telegram: {
            execApprovals: {
              enabled: true,
              approvers: ["123"],
              target: "dm",
            },
          },
        },
      },
    });

    expect(deliverReplies).toHaveBeenCalledWith(
      expect.objectContaining({
        replies: [
          expect.objectContaining({
            text: "Mode: foreground\nRun: /approve 117ba06d allow-once (or allow-always / deny).",
          }),
        ],
      }),
    );
    const deliveredPayload = (deliverReplies.mock.calls[0]?.[0] as { replies?: Array<unknown> })
      ?.replies?.[0] as { channelData?: unknown } | undefined;
    expect(deliveredPayload?.channelData).toBeUndefined();
  });

  it("uses 30-char stream debounce for legacy block stream mode", async () => {
    const draftStream = createDraftStream();
    createTelegramDraftStream.mockReturnValue(draftStream);
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(
      async ({ dispatcherOptions, replyOptions }) => {
        await replyOptions?.onPartialReply?.({ text: "Hello" });
        await dispatcherOptions.deliver({ text: "Hello" }, { kind: "final" });
        return { queuedFinal: true };
      },
    );
    deliverReplies.mockResolvedValue({ delivered: true });

    await dispatchWithContext({ context: createContext(), streamMode: "block" });

    expect(createTelegramDraftStream).toHaveBeenCalledWith(
      expect.objectContaining({
        minInitialChars: 30,
      }),
    );
  });

  it("keeps canonical block mode on the Telegram draft stream path", async () => {
    const draftStream = createDraftStream();
    createTelegramDraftStream.mockReturnValue(draftStream);
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(
      async ({ dispatcherOptions, replyOptions }) => {
        await replyOptions?.onPartialReply?.({ text: "HelloWorld" });
        await dispatcherOptions.deliver({ text: "HelloWorld" }, { kind: "final" });
        return { queuedFinal: true };
      },
    );
    deliverReplies.mockResolvedValue({ delivered: true });

    await dispatchWithContext({
      context: createContext(),
      streamMode: "block",
      telegramCfg: { streaming: { mode: "block" } },
    });

    expect(createTelegramDraftStream).toHaveBeenCalled();
    expect(draftStream.update).toHaveBeenCalledWith("HelloWorld");
  });

  it("streams text-only finals into the answer message", async () => {
    const { answerDraftStream } = setupDraftStreams({ answerMessageId: 2001 });
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.deliver({ text: "Final answer" }, { kind: "final" });
      return { queuedFinal: true };
    });

    await dispatchWithContext({ context: createContext() });

    expect(answerDraftStream.update).toHaveBeenCalledWith("Final answer");
    expect(answerDraftStream.stop).toHaveBeenCalled();
    expect(deliverReplies).not.toHaveBeenCalled();
    expect(editMessageTelegram).not.toHaveBeenCalled();
    expect(emitInternalMessageSentHook).toHaveBeenCalledWith(
      expect.objectContaining({ content: "Final answer", messageId: 2001 }),
    );
  });

  it("streams block and final text through the same answer message", async () => {
    const { answerDraftStream } = setupDraftStreams({ answerMessageId: 2001 });
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(
      async ({ dispatcherOptions, replyOptions }) => {
        await replyOptions?.onPartialReply?.({ text: "Working" });
        await dispatcherOptions.deliver({ text: "Done" }, { kind: "final" });
        return { queuedFinal: true };
      },
    );

    await dispatchWithContext({ context: createContext() });

    expect(answerDraftStream.update).toHaveBeenNthCalledWith(1, "Working");
    expect(answerDraftStream.update).toHaveBeenNthCalledWith(2, "Done");
    expect(answerDraftStream.stop).toHaveBeenCalled();
    expect(deliverReplies).not.toHaveBeenCalled();
    expect(editMessageTelegram).not.toHaveBeenCalled();
  });

  it("rotates the answer stream only after a finalized assistant message", async () => {
    const { answerDraftStream } = setupDraftStreams({ answerMessageId: 2001 });
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(
      async ({ dispatcherOptions, replyOptions }) => {
        await dispatcherOptions.deliver({ text: "Message A final" }, { kind: "final" });
        await replyOptions?.onAssistantMessageStart?.();
        await replyOptions?.onPartialReply?.({ text: "Message B partial" });
        await dispatcherOptions.deliver({ text: "Message B final" }, { kind: "final" });
        return { queuedFinal: true };
      },
    );

    await dispatchWithContext({ context: createContext() });

    expect(answerDraftStream.forceNewMessage).toHaveBeenCalledTimes(1);
    expect(answerDraftStream.update).toHaveBeenNthCalledWith(1, "Message A final");
    expect(answerDraftStream.update).toHaveBeenNthCalledWith(2, "Message B partial");
    expect(answerDraftStream.update).toHaveBeenNthCalledWith(3, "Message B final");
    expect(deliverReplies).not.toHaveBeenCalled();
  });

  it("keeps compaction replay on the same answer stream", async () => {
    const { answerDraftStream } = setupDraftStreams({ answerMessageId: 2001 });
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(
      async ({ dispatcherOptions, replyOptions }) => {
        await replyOptions?.onPartialReply?.({ text: "Partial before compaction" });
        await replyOptions?.onCompactionStart?.();
        await replyOptions?.onPartialReply?.({ text: "Partial before compaction" });
        await dispatcherOptions.deliver({ text: "Final after compaction" }, { kind: "final" });
        return { queuedFinal: true };
      },
    );

    await dispatchWithContext({ context: createContext() });

    expect(answerDraftStream.forceNewMessage).not.toHaveBeenCalled();
    expect(answerDraftStream.update).toHaveBeenNthCalledWith(1, "Partial before compaction");
    expect(answerDraftStream.update).toHaveBeenNthCalledWith(2, "Final after compaction");
    expect(deliverReplies).not.toHaveBeenCalled();
  });

  it("keeps progress updates in a draft and sends the final answer normally", async () => {
    const { answerDraftStream } = setupDraftStreams({ answerMessageId: 2001 });
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(
      async ({ dispatcherOptions, replyOptions }) => {
        await replyOptions?.onToolStart?.({ name: "exec", phase: "start" });
        await replyOptions?.onItemEvent?.({
          kind: "command",
          name: "exec",
          progressText: "git rev-parse --abbrev-ref HEAD",
        });
        await dispatcherOptions.deliver({ text: "Branch is up to date" }, { kind: "final" });
        return { queuedFinal: true };
      },
    );

    await dispatchWithContext({
      context: createContext(),
      streamMode: "progress",
      telegramCfg: { streaming: { mode: "progress" } },
    });

    expect(createTelegramDraftStream).toHaveBeenCalledWith(
      expect.objectContaining({
        replyToMessageId: undefined,
      }),
    );
    expect(answerDraftStream.update).toHaveBeenCalledWith(
      expect.stringMatching(workingDraftRegex("🛠️ Exec")),
    );
    expect(answerDraftStream.update).not.toHaveBeenCalledWith(
      expect.stringContaining("git rev-parse"),
    );
    expect(answerDraftStream.update).not.toHaveBeenCalledWith("Branch is up to date");
    expect(answerDraftStream.discard).toHaveBeenCalledTimes(1);
    expect(answerDraftStream.clear).not.toHaveBeenCalled();
    expect(deliverReplies).toHaveBeenCalledWith(
      expect.objectContaining({
        replies: [expect.objectContaining({ text: "Branch is up to date" })],
      }),
    );
    expect(editMessageTelegram).not.toHaveBeenCalled();
  });

  it("wraps partial-mode tool progress previews in working draft code blocks", async () => {
    const { answerDraftStream } = setupDraftStreams({ answerMessageId: 2001 });
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ replyOptions }) => {
      await replyOptions?.onToolStart?.({ name: "exec", phase: "start" });
      await replyOptions?.onItemEvent?.({
        kind: "command",
        name: "exec",
        progressText: "git rev-parse --abbrev-ref HEAD",
      });
      return { queuedFinal: false };
    });

    await dispatchWithContext({
      context: createContext(),
      streamMode: "partial",
      telegramCfg: { streaming: { mode: "partial", progress: { label: "Snapping..." } } },
    });

    expect(answerDraftStream.update).toHaveBeenLastCalledWith(
      workingDraftPreview("Snapping...\n🛠️ Exec"),
    );
    expect(answerDraftStream.update).not.toHaveBeenCalledWith(
      expect.stringContaining("git rev-parse"),
    );
  });

  it("streams the first long final chunk and sends follow-up chunks", async () => {
    const { answerDraftStream } = setupDraftStreams({ answerMessageId: 2001 });
    const longText = "one ".repeat(80);
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.deliver({ text: longText }, { kind: "final" });
      return { queuedFinal: true };
    });

    await dispatchWithContext({ context: createContext(), textLimit: 80 });

    const firstChunk = answerDraftStream.update.mock.calls.at(-1)?.[0] ?? "";
    expect(firstChunk.length).toBeLessThanOrEqual(80);
    expect(deliverReplies).toHaveBeenCalled();
    const followUpTexts = deliverReplies.mock.calls.flatMap((call: unknown[]) =>
      ((call[0] as { replies?: Array<{ text?: string }> }).replies ?? []).map(
        (reply) => reply.text ?? "",
      ),
    );
    expect(followUpTexts.join("")).toContain("one");
    expect(editMessageTelegram).not.toHaveBeenCalled();
  });

  it("falls back to normal send for media and retains the pending stream", async () => {
    const { answerDraftStream } = setupDraftStreams({ answerMessageId: 2001 });
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.deliver(
        { text: "Photo", mediaUrl: "https://example.com/a.png" },
        { kind: "final" },
      );
      return { queuedFinal: true };
    });

    await dispatchWithContext({ context: createContext() });

    expect(answerDraftStream.discard).toHaveBeenCalled();
    expect(answerDraftStream.clear).not.toHaveBeenCalled();
    expect(answerDraftStream.update).not.toHaveBeenCalledWith("Photo");
    expect(deliverReplies).toHaveBeenCalledWith(
      expect.objectContaining({
        replies: [
          expect.objectContaining({ text: "Photo", mediaUrl: "https://example.com/a.png" }),
        ],
      }),
    );
  });

  it("shows Telegram progress drafts immediately for explicit tool starts", async () => {
    const draftStream = createSequencedDraftStream(2001);
    createTelegramDraftStream.mockReturnValue(draftStream);
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ replyOptions }) => {
      await replyOptions?.onReplyStart?.();
      await replyOptions?.onAssistantMessageStart?.();
      await replyOptions?.onToolStart?.({ name: "exec", phase: "start" });
      return { queuedFinal: false };
    });

    await dispatchWithContext({
      context: createContext(),
      streamMode: "progress",
      telegramCfg: { streaming: { mode: "progress", progress: { label: "Shelling" } } },
    });

    expect(draftStream.update).toHaveBeenCalledWith(
      expect.stringMatching(workingDraftRegex("🛠️ Exec")),
    );
    expect(draftStream.flush).toHaveBeenCalled();
  });

  it("starts and retains Telegram progress drafts at reply start when no final arrives", async () => {
    const draftStream = createSequencedDraftStream(2001);
    createTelegramDraftStream.mockReturnValue(draftStream);
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ replyOptions }) => {
      await replyOptions?.onReplyStart?.();
      return { queuedFinal: false };
    });

    await dispatchWithContext({
      context: createContext(),
      streamMode: "progress",
      telegramCfg: { streaming: { mode: "progress", progress: { label: "Shelling" } } },
    });

    expect(draftStream.update).toHaveBeenCalledWith(
      expect.stringMatching(workingDraftRegex("Working\\.\\.\\.")),
    );
    expect(draftStream.flush).toHaveBeenCalled();
    expect(draftStream.discard).toHaveBeenCalledTimes(1);
    expect(draftStream.clear).not.toHaveBeenCalled();
    expect(deliverReplies).not.toHaveBeenCalled();
  });

  it("retains streamed assistant draft details in the progress working draft", async () => {
    const draftStream = createSequencedDraftStream(2001);
    createTelegramDraftStream.mockReturnValue(draftStream);
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(
      async ({ dispatcherOptions, replyOptions }) => {
        await replyOptions?.onReplyStart?.();
        await replyOptions?.onPartialReply?.({ text: "I found the migration note in setup.md." });
        await replyOptions?.onPartialReply?.({
          text: "I found the migration note in setup.md.\nThe important detail is rollback flag X.",
        });
        await dispatcherOptions.deliver({ text: "Final summary." }, { kind: "final" });
        return { queuedFinal: true };
      },
    );

    await dispatchWithContext({
      context: createContext(),
      streamMode: "progress",
      telegramCfg: { streaming: { mode: "progress", progress: { label: "Shelling" } } },
    });

    expect(draftStream.update).toHaveBeenCalledWith(
      expect.stringContaining("Draft:\nI found the migration note in setup.md."),
    );
    expect(draftStream.update).toHaveBeenCalledWith(
      expect.stringContaining("The important detail is rollback flag X."),
    );
    expect(draftStream.update).not.toHaveBeenCalledWith(
      expect.stringContaining("assistant draft continued:"),
    );
    expect(draftStream.update).not.toHaveBeenCalledWith(expect.stringContaining("reply started"));
    expect(draftStream.discard).toHaveBeenCalledTimes(1);
    expect(draftStream.clear).not.toHaveBeenCalled();
    expect(deliverReplies).toHaveBeenCalledWith(
      expect.objectContaining({
        replies: [expect.objectContaining({ text: "Final summary." })],
      }),
    );
  });

  it("keeps non-cumulative assistant draft snapshots in the progress working draft", async () => {
    const draftStream = createSequencedDraftStream(2001);
    createTelegramDraftStream.mockReturnValue(draftStream);
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(
      async ({ dispatcherOptions, replyOptions }) => {
        await replyOptions?.onReplyStart?.();
        await replyOptions?.onPartialReply?.({
          text: "WORKING DRAFT\n- Read EMAIL_LOG.md\n- Found 15 email entries",
        });
        await replyOptions?.onPartialReply?.({
          text: "WORKING DRAFT\n- Read GPU_DEALS.md\n- Found Tesla K80 pricing",
        });
        await dispatcherOptions.deliver({ text: "Final summary." }, { kind: "final" });
        return { queuedFinal: true };
      },
    );

    await dispatchWithContext({
      context: createContext(),
      streamMode: "progress",
      telegramCfg: { streaming: { mode: "progress", progress: { label: "Working" } } },
    });

    const lastUpdate = draftStream.update.mock.calls.at(-1)?.[0] ?? "";
    expect(lastUpdate).toContain("- Read EMAIL_LOG.md");
    expect(lastUpdate).toContain("- Found 15 email entries");
    expect(lastUpdate).toContain("- Read GPU_DEALS.md");
    expect(lastUpdate).toContain("- Found Tesla K80 pricing");
    expect(deliverReplies).toHaveBeenCalledWith(
      expect.objectContaining({
        replies: [expect.objectContaining({ text: "Final summary." })],
      }),
    );
  });

  it("folds model-emitted working draft final payloads into the progress draft", async () => {
    const draftStream = createSequencedDraftStream(2001);
    createTelegramDraftStream.mockReturnValue(draftStream);
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(
      async ({ dispatcherOptions, replyOptions }) => {
        await replyOptions?.onReplyStart?.();
        await dispatcherOptions.deliver(
          {
            text: "WORKING DRAFT\n- Read EMAIL_LOG.md\n- Checked HEARTBEAT.md",
            replyToId: "456",
          },
          { kind: "final" },
        );
        await dispatcherOptions.deliver(
          { text: "Final summary.\nEND", replyToId: "456" },
          { kind: "final" },
        );
        return { queuedFinal: true };
      },
    );

    await dispatchWithContext({
      context: createContext(),
      streamMode: "progress",
      telegramCfg: { streaming: { mode: "progress", progress: { label: "Working" } } },
    });

    expect(draftStream.update).toHaveBeenCalledWith(expect.stringContaining("- Read EMAIL_LOG.md"));
    const sentTexts = deliverReplies.mock.calls.flatMap((call: unknown[]) =>
      ((call[0] as { replies?: Array<{ text?: string }> }).replies ?? []).map(
        (reply) => reply.text ?? "",
      ),
    );
    expect(sentTexts).toEqual(["Final summary.\nEND"]);
  });

  it("keeps Telegram progress working drafts compact without raw labels", async () => {
    const draftStream = createSequencedDraftStream(2001);
    createTelegramDraftStream.mockReturnValue(draftStream);
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(
      async ({ dispatcherOptions, replyOptions }) => {
        await replyOptions?.onReplyStart?.();
        await replyOptions?.onPartialReply?.({
          text: [
            "assistant draft:",
            "Here's my honest assessment of each based on company size, stock, and buying department.",
            "assistant draft continued:",
            "Strongest leverage: they explicitly say they buy old server parts.",
            "assistant draft continued:",
            "This should stay compact instead of one raw token per line.",
          ].join("\n"),
        });
        await replyOptions?.onPartialReply?.({
          text: [
            "assistant draft:",
            "Here's my honest assessment of each based on company size, stock, and buying department.",
            "assistant draft continued:",
            "Strongest leverage: they explicitly say they buy old server parts.",
            "assistant draft continued:",
            "This should stay compact instead of one raw token per line.",
            "assistant draft continued:",
            "Next: rank targets by likelihood and contact path.",
          ].join("\n"),
        });
        await dispatcherOptions.deliver({ text: "Final summary." }, { kind: "final" });
        return { queuedFinal: true };
      },
    );

    await dispatchWithContext({
      context: createContext(),
      streamMode: "progress",
      telegramCfg: { streaming: { mode: "progress", progress: { label: "Working" } } },
    });

    const streamParams = createTelegramDraftStream.mock.calls[0]?.[0] as Parameters<
      NonNullable<TelegramBotDeps["createTelegramDraftStream"]>
    >[0];
    expect(streamParams.allowNonAppendEdit).toBe(true);

    const updates = draftStream.update.mock.calls.map((call) => call[0]);
    expect(updates.length).toBeGreaterThan(0);
    for (const update of updates) {
      expect(update).toMatch(/^```text\nWORKING DRAFT\n/s);
      expect(update).not.toContain("assistant draft continued:");
      expect(update).not.toContain("assistant draft:");
      expect(update).not.toContain("reply started");
      expect(update.length).toBeLessThan(950);
    }
    expect(draftStream.forceNewMessage).not.toHaveBeenCalled();
  });

  it("keeps Telegram progress working drafts inside small stream budgets", async () => {
    const draftStream = createSequencedDraftStream(2001);
    createTelegramDraftStream.mockReturnValue(draftStream);
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(
      async ({ dispatcherOptions, replyOptions }) => {
        await replyOptions?.onReplyStart?.();
        for (let index = 0; index < 8; index += 1) {
          await replyOptions?.onPartialReply?.({
            text: [
              "assistant draft:",
              "Power Ranking",
              "assistant draft continued:",
              `Option ${index + 1}: long server listing with CPUs, RAM, storage, PSU notes, and price math.`,
              "assistant draft continued:",
              "This must not become a tall raw-token Telegram wall.",
            ].join("\n"),
          });
        }
        await dispatcherOptions.deliver({ text: "Final summary." }, { kind: "final" });
        return { queuedFinal: true };
      },
    );

    await dispatchWithContext({
      context: createContext(),
      streamMode: "progress",
      textLimit: 700,
      telegramCfg: { streaming: { mode: "progress", progress: { label: "Working" } } },
    });

    const updates = draftStream.update.mock.calls.map((call) => call[0]);
    expect(updates.length).toBeGreaterThan(0);
    for (const update of updates) {
      expect(update).toMatch(/^```text\nWORKING DRAFT\n/s);
      expect(update.length).toBeLessThanOrEqual(700);
      expect(update).not.toContain("assistant draft continued:");
      expect(update).not.toContain("assistant draft:");
      expect(update).not.toContain("reply started");
    }
    expect(draftStream.forceNewMessage).not.toHaveBeenCalled();
  });

  it("renders Telegram progress drafts before slow status reactions resolve", async () => {
    const draftStream = createSequencedDraftStream(2001);
    createTelegramDraftStream.mockReturnValue(draftStream);
    let releaseSetTool: (() => void) | undefined;
    const statusReactionController = createStatusReactionController();
    statusReactionController.setTool.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseSetTool = resolve;
        }),
    );
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ replyOptions }) => {
      const pendingToolStart = replyOptions?.onToolStart?.({ name: "exec", phase: "start" });
      await Promise.resolve();
      await Promise.resolve();
      const updateBeforeStatusReaction = draftStream.update.mock.calls.at(-1)?.[0];
      releaseSetTool?.();
      await pendingToolStart;
      expect(updateBeforeStatusReaction).toMatch(workingDraftRegex("🛠️ Exec"));
      return { queuedFinal: false };
    });

    await dispatchWithContext({
      context: createContext({
        statusReactionController: statusReactionController as never,
      }),
      streamMode: "progress",
      telegramCfg: { streaming: { mode: "progress", progress: { label: "Shelling" } } },
    });

    expect(statusReactionController.setTool).toHaveBeenCalledWith("exec");
  });

  it("keeps non-command Telegram progress draft lines across post-tool assistant boundaries", async () => {
    const draftStream = createSequencedDraftStream(2001);
    createTelegramDraftStream.mockReturnValue(draftStream);
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(
      async ({ dispatcherOptions, replyOptions }) => {
        await replyOptions?.onReplyStart?.();
        await replyOptions?.onAssistantMessageStart?.();
        await replyOptions?.onItemEvent?.({ kind: "search", progressText: "docs lookup" });
        await replyOptions?.onItemEvent?.({ progressText: "tests passed" });
        await replyOptions?.onAssistantMessageStart?.();
        await dispatcherOptions.deliver({ text: "Final after tool" }, { kind: "final" });
        return { queuedFinal: true };
      },
    );

    await dispatchWithContext({
      context: createContext(),
      streamMode: "progress",
      telegramCfg: { streaming: { mode: "progress", progress: { label: "Shelling" } } },
    });

    expect(draftStream.update).toHaveBeenCalledWith(
      expect.stringMatching(workingDraftRegex("🔎 Web Search: docs lookup\\ntests passed")),
    );
    expect(draftStream.forceNewMessage).not.toHaveBeenCalled();
    expect(draftStream.materialize).not.toHaveBeenCalled();
    expect(draftStream.discard).toHaveBeenCalledTimes(1);
    expect(draftStream.clear).not.toHaveBeenCalled();
    expect(deliverReplies).toHaveBeenCalledWith(
      expect.objectContaining({
        replies: [expect.objectContaining({ text: "Final after tool" })],
      }),
    );
    expect(editMessageTelegram).not.toHaveBeenCalled();
  });

  it("falls back to normal send for error payloads and retains the pending stream", async () => {
    const { answerDraftStream } = setupDraftStreams({ answerMessageId: 2001 });
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.deliver({ text: "Boom", isError: true }, { kind: "final" });
      return { queuedFinal: true };
    });

    await dispatchWithContext({ context: createContext() });

    expect(answerDraftStream.discard).toHaveBeenCalled();
    expect(answerDraftStream.clear).not.toHaveBeenCalled();
    expect(deliverReplies).toHaveBeenCalledWith(
      expect.objectContaining({ replies: [expect.objectContaining({ text: "Boom" })] }),
    );
  });

  it("streams button-bearing text into the same message", async () => {
    const { answerDraftStream } = setupDraftStreams({ answerMessageId: 2001 });
    const buttons = [[{ text: "OK", callback_data: "ok" }]];
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.deliver(
        { text: "Choose", channelData: { telegram: { buttons } } },
        { kind: "final" },
      );
      return { queuedFinal: true };
    });

    await dispatchWithContext({ context: createContext() });

    expect(answerDraftStream.update).toHaveBeenCalledWith("Choose");
    expect(editMessageTelegram).toHaveBeenCalledWith(
      123,
      2001,
      "Choose",
      expect.objectContaining({ buttons }),
    );
    expect(deliverReplies).not.toHaveBeenCalled();
  });

  it("streams reasoning and answer text on separate lanes", async () => {
    const { answerDraftStream, reasoningDraftStream } = setupDraftStreams({
      answerMessageId: 2001,
      reasoningMessageId: 3001,
    });
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(
      async ({ dispatcherOptions, replyOptions }) => {
        await replyOptions?.onReasoningStream?.({ text: "<think>Thinking</think>" });
        await dispatcherOptions.deliver({ text: "Answer" }, { kind: "final" });
        return { queuedFinal: true };
      },
    );

    await dispatchWithContext({ context: createReasoningStreamContext() });

    expect(reasoningDraftStream.update).toHaveBeenCalledWith("Reasoning:\n_Thinking_");
    expect(answerDraftStream.update).toHaveBeenCalledWith("Answer");
    expect(deliverReplies).not.toHaveBeenCalled();
  });

  it("streams reasoning from configured defaults", async () => {
    const { answerDraftStream, reasoningDraftStream } = setupDraftStreams({
      answerMessageId: 2001,
      reasoningMessageId: 3001,
    });
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(
      async ({ dispatcherOptions, replyOptions }) => {
        await replyOptions?.onReasoningStream?.({ text: "<think>Thinking</think>" });
        await dispatcherOptions.deliver({ text: "Answer" }, { kind: "final" });
        return { queuedFinal: true };
      },
    );

    await dispatchWithContext({
      context: createReasoningDefaultContext(),
      cfg: {
        agents: {
          defaults: { reasoningDefault: "off" },
          list: [{ id: "Ops", reasoningDefault: "stream" }],
        },
      },
    });

    expect(reasoningDraftStream.update).toHaveBeenCalledWith("Reasoning:\n_Thinking_");
    expect(answerDraftStream.update).toHaveBeenCalledWith("Answer");
  });

  it("suppresses reasoning-only finals without raw text fallback", async () => {
    setupDraftStreams({ answerMessageId: 2001, reasoningMessageId: 3001 });
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.deliver({ text: "<think>hidden</think>" }, { kind: "final" });
      return { queuedFinal: true };
    });

    await dispatchWithContext({ context: createContext() });

    expect(deliverReplies).not.toHaveBeenCalled();
    expect(editMessageTelegram).not.toHaveBeenCalled();
  });

  it("does not add silent fallback when source delivery is message-tool-only", async () => {
    setupDraftStreams({ answerMessageId: 2001, reasoningMessageId: 3001 });
    dispatchReplyWithBufferedBlockDispatcher.mockResolvedValue({
      queuedFinal: false,
      counts: { block: 0, final: 0, tool: 0 },
      sourceReplyDeliveryMode: "message_tool_only",
    });

    await dispatchWithContext({
      context: createContext({
        ctxPayload: {
          SessionKey: "agent:main:telegram:direct:123",
        } as unknown as TelegramMessageContext["ctxPayload"],
      }),
      cfg: {
        agents: {
          defaults: {
            silentReply: {
              direct: "disallow",
              group: "allow",
              internal: "allow",
            },
            silentReplyRewrite: {
              direct: true,
            },
          },
        },
      },
    });

    expect(deliverReplies).not.toHaveBeenCalled();
    expect(editMessageTelegram).not.toHaveBeenCalled();
    expect(sendMessageTelegram).not.toHaveBeenCalled();
  });

  it("shows compacting reaction during auto-compaction and resumes thinking", async () => {
    const statusReactionController = {
      setThinking: vi.fn(async () => {}),
      setCompacting: vi.fn(async () => {}),
      setTool: vi.fn(async () => {}),
      setDone: vi.fn(async () => {}),
      setError: vi.fn(async () => {}),
      setQueued: vi.fn(async () => {}),
      cancelPending: vi.fn(() => {}),
      clear: vi.fn(async () => {}),
      restoreInitial: vi.fn(async () => {}),
    };
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ replyOptions }) => {
      await replyOptions?.onCompactionStart?.();
      await replyOptions?.onCompactionEnd?.();
      return { queuedFinal: true };
    });
    deliverReplies.mockResolvedValue({ delivered: true });

    await dispatchWithContext({
      context: createContext({
        statusReactionController: statusReactionController as never,
      }),
      streamMode: "off",
    });

    expect(statusReactionController.setCompacting).toHaveBeenCalledTimes(1);
    expect(statusReactionController.cancelPending).toHaveBeenCalledTimes(1);
    expect(statusReactionController.setThinking).toHaveBeenCalledTimes(2);
    expect(statusReactionController.setCompacting.mock.invocationCallOrder[0]).toBeLessThan(
      statusReactionController.cancelPending.mock.invocationCallOrder[0],
    );
    expect(statusReactionController.cancelPending.mock.invocationCallOrder[0]).toBeLessThan(
      statusReactionController.setThinking.mock.invocationCallOrder[1],
    );
  });

  it("does not supersede the same session for unauthorized abort-looking commands", async () => {
    let releaseFirstFinal: (() => void) | undefined;
    const firstFinalGate = new Promise<void>((resolve) => {
      releaseFirstFinal = resolve;
    });
    let resolveStreamVisible: (() => void) | undefined;
    const streamVisible = new Promise<void>((resolve) => {
      resolveStreamVisible = resolve;
    });

    const firstAnswerDraft = createTestDraftStream({
      messageId: 1001,
      onUpdate: (text) => {
        if (text === "Old reply partial") {
          if (!resolveStreamVisible) {
            throw new Error("Expected Telegram stream-visible resolver to be initialized");
          }
          resolveStreamVisible();
        }
      },
    });
    const firstReasoningDraft = createDraftStream();
    const unauthorizedAnswerDraft = createDraftStream();
    const unauthorizedReasoningDraft = createDraftStream();
    createTelegramDraftStream
      .mockImplementationOnce(() => firstAnswerDraft)
      .mockImplementationOnce(() => firstReasoningDraft)
      .mockImplementationOnce(() => unauthorizedAnswerDraft)
      .mockImplementationOnce(() => unauthorizedReasoningDraft);
    dispatchReplyWithBufferedBlockDispatcher
      .mockImplementationOnce(async ({ dispatcherOptions, replyOptions }) => {
        await replyOptions?.onPartialReply?.({ text: "Old reply partial" });
        await firstFinalGate;
        await dispatcherOptions.deliver({ text: "Old reply final" }, { kind: "final" });
        return { queuedFinal: true };
      })
      .mockImplementationOnce(async ({ dispatcherOptions }) => {
        await dispatcherOptions.deliver({ text: "Unauthorized stop" }, { kind: "final" });
        return { queuedFinal: true };
      });
    const unauthorizedReplyDelivered = observeDeliveredReply("Unauthorized stop");
    const firstPromise = dispatchWithContext({
      context: createContext({
        ctxPayload: {
          SessionKey: "s1",
          Body: "earlier request",
          RawBody: "earlier request",
        } as never,
      }),
    });

    await streamVisible;

    const unauthorizedPromise = dispatchWithContext({
      context: createContext({
        ctxPayload: {
          SessionKey: "s1",
          Body: "/stop",
          RawBody: "/stop",
          CommandBody: "/stop",
          CommandAuthorized: false,
        } as never,
      }),
    });

    await unauthorizedReplyDelivered;

    if (!releaseFirstFinal) {
      throw new Error("Expected first Telegram final release callback to be initialized");
    }
    releaseFirstFinal();
    await Promise.all([firstPromise, unauthorizedPromise]);

    expect(firstAnswerDraft.update).toHaveBeenCalledWith("Old reply final");
    expect(editMessageTelegram).not.toHaveBeenCalled();
  });

  it("uses configured doneHoldMs when clearing Telegram status reactions after reply", async () => {
    vi.useFakeTimers();
    const reactionApi = vi.fn(async () => true);
    const statusReactionController = createStatusReactionController();
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.deliver({ text: "Done" }, { kind: "final" });
      return { queuedFinal: true };
    });
    deliverReplies.mockResolvedValue({ delivered: true });

    try {
      await dispatchWithContext({
        context: createContext({
          reactionApi: reactionApi as never,
          removeAckAfterReply: true,
          statusReactionController: statusReactionController as never,
        }),
        cfg: {
          messages: {
            statusReactions: {
              timing: {
                doneHoldMs: 250,
              },
            },
          },
        },
        streamMode: "off",
      });

      expect(statusReactionController.setDone).toHaveBeenCalledTimes(1);
      expect(statusReactionController.restoreInitial).not.toHaveBeenCalled();
      expect(reactionApi).not.toHaveBeenCalledWith(123, 456, []);

      await vi.advanceTimersByTimeAsync(249);
      expect(reactionApi).not.toHaveBeenCalledWith(123, 456, []);

      await vi.advanceTimersByTimeAsync(1);
      expect(reactionApi).toHaveBeenCalledWith(123, 456, []);
    } finally {
      vi.useRealTimers();
    }
  });

  it("restores the initial Telegram status reaction after reply when removeAckAfterReply is disabled", async () => {
    const reactionApi = vi.fn(async () => true);
    const statusReactionController = createStatusReactionController();
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.deliver({ text: "Done" }, { kind: "final" });
      return { queuedFinal: true };
    });
    deliverReplies.mockResolvedValue({ delivered: true });

    await dispatchWithContext({
      context: createContext({
        reactionApi: reactionApi as never,
        removeAckAfterReply: false,
        statusReactionController: statusReactionController as never,
      }),
      streamMode: "off",
    });

    await vi.waitFor(() => {
      expect(statusReactionController.setDone).toHaveBeenCalledTimes(1);
      expect(statusReactionController.restoreInitial).toHaveBeenCalledTimes(1);
    });
    expect(statusReactionController.setError).not.toHaveBeenCalled();
    expect(reactionApi).not.toHaveBeenCalledWith(123, 456, []);
  });

  it("uses configured errorHoldMs to clear Telegram status reactions after an error fallback", async () => {
    vi.useFakeTimers();
    const reactionApi = vi.fn(async () => true);
    const statusReactionController = createStatusReactionController();
    dispatchReplyWithBufferedBlockDispatcher.mockRejectedValue(new Error("dispatcher exploded"));
    deliverReplies.mockResolvedValue({ delivered: true });

    try {
      await dispatchWithContext({
        context: createContext({
          reactionApi: reactionApi as never,
          removeAckAfterReply: true,
          statusReactionController: statusReactionController as never,
        }),
        cfg: {
          messages: {
            statusReactions: {
              timing: {
                errorHoldMs: 320,
              },
            },
          },
        },
        streamMode: "off",
      });

      expect(statusReactionController.setError).toHaveBeenCalledTimes(1);
      expect(statusReactionController.setDone).not.toHaveBeenCalled();
      expect(statusReactionController.restoreInitial).not.toHaveBeenCalled();
      expect(reactionApi).not.toHaveBeenCalledWith(123, 456, []);

      await vi.advanceTimersByTimeAsync(319);
      expect(reactionApi).not.toHaveBeenCalledWith(123, 456, []);

      await vi.advanceTimersByTimeAsync(1);
      expect(reactionApi).toHaveBeenCalledWith(123, 456, []);
    } finally {
      vi.useRealTimers();
    }
  });

  it("restores the initial Telegram status reaction after an error when no final reply is sent", async () => {
    vi.useFakeTimers();
    const reactionApi = vi.fn(async () => true);
    const statusReactionController = createStatusReactionController();
    dispatchReplyWithBufferedBlockDispatcher.mockRejectedValue(new Error("dispatcher exploded"));
    deliverReplies.mockResolvedValue({ delivered: false });

    try {
      await dispatchWithContext({
        context: createContext({
          reactionApi: reactionApi as never,
          removeAckAfterReply: true,
          statusReactionController: statusReactionController as never,
        }),
        cfg: {
          messages: {
            statusReactions: {
              timing: {
                errorHoldMs: 320,
              },
            },
          },
        },
        streamMode: "off",
      });

      expect(statusReactionController.setError).toHaveBeenCalledTimes(1);
      expect(statusReactionController.restoreInitial).not.toHaveBeenCalled();
      expect(reactionApi).not.toHaveBeenCalledWith(123, 456, []);

      await vi.advanceTimersByTimeAsync(319);
      expect(statusReactionController.restoreInitial).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(statusReactionController.restoreInitial).toHaveBeenCalledTimes(1);
      expect(reactionApi).not.toHaveBeenCalledWith(123, 456, []);
    } finally {
      vi.useRealTimers();
    }
  });

  it("restores the initial Telegram status reaction after an error fallback when removeAckAfterReply is disabled", async () => {
    const reactionApi = vi.fn(async () => true);
    const statusReactionController = createStatusReactionController();
    dispatchReplyWithBufferedBlockDispatcher.mockRejectedValue(new Error("dispatcher exploded"));
    deliverReplies.mockResolvedValue({ delivered: true });

    await dispatchWithContext({
      context: createContext({
        reactionApi: reactionApi as never,
        removeAckAfterReply: false,
        statusReactionController: statusReactionController as never,
      }),
      streamMode: "off",
    });

    await vi.waitFor(() => {
      expect(statusReactionController.setError).toHaveBeenCalledTimes(1);
      expect(statusReactionController.restoreInitial).toHaveBeenCalledTimes(1);
    });
    expect(statusReactionController.setDone).not.toHaveBeenCalled();
    expect(reactionApi).not.toHaveBeenCalledWith(123, 456, []);
  });

  it("uses resolved DM config for auto-topic-label overrides", async () => {
    dispatchReplyWithBufferedBlockDispatcher.mockResolvedValue({ queuedFinal: true });
    loadSessionStore.mockReturnValue({ s1: {} });
    const bot = createBot();

    await dispatchWithContext({
      bot,
      context: createContext({
        ctxPayload: {
          SessionKey: "s1",
          RawBody: "Need help with invoices",
        } as TelegramMessageContext["ctxPayload"],
        groupConfig: {
          autoTopicLabel: false,
        } as TelegramMessageContext["groupConfig"],
      }),
      telegramCfg: { autoTopicLabel: true },
      cfg: {
        channels: {
          telegram: {
            direct: {
              "123": { autoTopicLabel: true },
            },
          },
        },
      },
    });

    expect(generateTopicLabel).not.toHaveBeenCalled();
    expect(bot.api.editForumTopic).not.toHaveBeenCalled();
  });
});
