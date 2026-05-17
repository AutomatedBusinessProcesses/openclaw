import type { ReplyToMode } from "../config/config.js";
import type { DmPolicy, OpenClawConfig, TelegramAccountConfig } from "../config/types.js";
import type { RuntimeEnv } from "../runtime.js";
import {
  buildTelegramMessageContext,
  type BuildTelegramMessageContextParams,
  type TelegramMediaRef,
} from "./bot-message-context.js";
import { dispatchTelegramMessage } from "./bot-message-dispatch.js";
import type { TelegramBotOptions } from "./bot.js";
import type { TelegramContext, TelegramStreamMode } from "./bot/types.js";

/** Dependencies injected once when creating the message processor. */
export type TelegramMessageRuntimeState = {
  cfg: OpenClawConfig;
  account: { accountId: string };
  telegramCfg: TelegramAccountConfig;
  historyLimit: number;
  dmPolicy: DmPolicy;
  allowFrom?: Array<string | number>;
  groupAllowFrom?: Array<string | number>;
  ackReactionScope: "off" | "none" | "group-mentions" | "group-all" | "direct" | "all";
  replyToMode: ReplyToMode;
  streamMode: TelegramStreamMode;
  textLimit: number;
};

type TelegramMessageProcessorDeps = Omit<
  BuildTelegramMessageContextParams,
  "primaryCtx" | "allMedia" | "storeAllowFrom" | "options"
> & {
  telegramCfg: TelegramAccountConfig;
  runtime: RuntimeEnv;
  replyToMode: ReplyToMode;
  streamMode: TelegramStreamMode;
  textLimit: number;
  opts: Pick<TelegramBotOptions, "token">;
  resolveMessageRuntimeState?: () => TelegramMessageRuntimeState;
};

export const createTelegramMessageProcessor = (deps: TelegramMessageProcessorDeps) => {
  const {
    bot,
    cfg,
    account,
    telegramCfg,
    historyLimit,
    groupHistories,
    dmPolicy,
    allowFrom,
    groupAllowFrom,
    ackReactionScope,
    logger,
    resolveGroupActivation,
    resolveGroupRequireMention,
    resolveTelegramGroupConfig,
    sendChatActionHandler,
    runtime,
    replyToMode,
    streamMode,
    textLimit,
    opts,
    resolveMessageRuntimeState,
  } = deps;

  return async (
    primaryCtx: TelegramContext,
    allMedia: TelegramMediaRef[],
    storeAllowFrom: string[],
    options?: { messageIdOverride?: string; forceWasMentioned?: boolean },
    replyMedia?: TelegramMediaRef[],
  ) => {
    const runtimeState = resolveMessageRuntimeState?.() ?? {
      cfg,
      account,
      telegramCfg,
      historyLimit,
      dmPolicy,
      allowFrom,
      groupAllowFrom,
      ackReactionScope,
      replyToMode,
      streamMode,
      textLimit,
    };
    const context = await buildTelegramMessageContext({
      primaryCtx,
      allMedia,
      replyMedia,
      storeAllowFrom,
      options,
      bot,
      cfg: runtimeState.cfg,
      account: runtimeState.account,
      historyLimit: runtimeState.historyLimit,
      groupHistories,
      dmPolicy: runtimeState.dmPolicy,
      allowFrom: runtimeState.allowFrom,
      groupAllowFrom: runtimeState.groupAllowFrom,
      ackReactionScope: runtimeState.ackReactionScope,
      logger,
      resolveGroupActivation,
      resolveGroupRequireMention,
      resolveTelegramGroupConfig,
      sendChatActionHandler,
    });
    if (!context) {
      return;
    }
    await dispatchTelegramMessage({
      context,
      bot,
      cfg: runtimeState.cfg,
      runtime,
      replyToMode: runtimeState.replyToMode,
      streamMode: runtimeState.streamMode,
      textLimit: runtimeState.textLimit,
      telegramCfg: runtimeState.telegramCfg,
      opts,
    });
  };
};
