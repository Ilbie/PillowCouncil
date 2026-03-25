import type { ProviderUsage } from "@ship-council/providers";
import type {
  DebateState,
  DecisionSummary,
  MessageRecord,
  PresetDefinition,
  RoundRecord,
  RunStreamEvent,
  UsageSummary
} from "@ship-council/shared";

export type OrchestratedRound = RoundRecord & {
  messages: MessageRecord[];
};

export type RunSessionResult = {
  rounds: OrchestratedRound[];
  decision: DecisionSummary;
  usage: UsageSummary;
};

export type RunSessionCallbacks = {
  onRoundCreated?: (round: RoundRecord) => Promise<void> | void;
  onRoundSummary?: (roundId: string, summary: string | null) => Promise<void> | void;
  onMessageCreated?: (message: MessageRecord, usage: ProviderUsage) => Promise<void> | void;
  onDebateStateUpdated?: (state: DebateState) => Promise<void> | void;
  onRuntimePresetCompiled?: (preset: PresetDefinition) => Promise<void> | void;
  onUsage?: (usage: ProviderUsage) => Promise<void> | void;
  onStreamEvent?: (event: RunStreamEvent) => Promise<void> | void;
};

export type RunActivityGuard = () => Promise<void> | void;

export type ContextState = {
  debateState: DebateState;
  recentMessages: MessageRecord[];
};
