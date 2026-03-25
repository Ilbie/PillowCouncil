import type { MemorySearchResult, MessageRecord, SessionRecord } from "@pillow-council/shared";

import { buildMemoryQuery } from "../prompts";
import type { ContextState } from "./types";

const RETRIEVED_MEMORY_LIMIT = 3;

export async function loadRetrievedMemories(input: {
  session: SessionRecord;
  runId: string;
  agentKey: string;
  agentName: string;
  kind: MessageRecord["kind"];
  state: ContextState;
  retrieveMemories?: (input: {
    session: SessionRecord;
    runId: string;
    agentKey: string;
    agentName: string;
    kind: MessageRecord["kind"];
    query: string;
    excludeMessageIds: string[];
  }) => Promise<MemorySearchResult[]> | MemorySearchResult[];
}): Promise<MemorySearchResult[]> {
  if (!input.retrieveMemories) {
    return [];
  }

  const query = buildMemoryQuery(input.session, input.state.recentMessages);
  if (!query) {
    return [];
  }

  const memories = await input.retrieveMemories({
    session: input.session,
    runId: input.runId,
    agentKey: input.agentKey,
    agentName: input.agentName,
    kind: input.kind,
    query,
    excludeMessageIds: input.state.recentMessages.map((message) => message.id)
  });

  return memories.slice(0, RETRIEVED_MEMORY_LIMIT);
}
