import type { ProviderUsage } from "@ship-council/providers";
import type { MessageRecord, UsageSummary } from "@ship-council/shared";

import type { ContextState, OrchestratedRound, RunSessionCallbacks } from "./types";

const CONTEXT_RECENT_MESSAGE_COUNT = 8;

export async function persistMessage(input: {
  round: OrchestratedRound;
  state: ContextState;
  usage: UsageSummary;
  callbacks?: RunSessionCallbacks;
  message: MessageRecord;
  usageDelta: ProviderUsage;
}): Promise<void> {
  input.round.messages.push(input.message);
  input.state.recentMessages.push(input.message);
  input.state.recentMessages = input.state.recentMessages.slice(-CONTEXT_RECENT_MESSAGE_COUNT);
  input.usage.totalPromptTokens += input.usageDelta.promptTokens;
  input.usage.totalCompletionTokens += input.usageDelta.completionTokens;
  await input.callbacks?.onMessageCreated?.(input.message, input.usageDelta);
}
