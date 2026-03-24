import { createId, nowIso, type MessageRecord, type RoundRecord } from "@ship-council/shared";

export function createRound(
  sessionId: string,
  runId: string,
  roundNumber: number,
  stage: RoundRecord["stage"],
  title: string,
  summary: string | null = null
): RoundRecord {
  return {
    id: createId("round"),
    sessionId,
    runId,
    roundNumber,
    stage,
    title,
    summary,
    createdAt: nowIso()
  };
}

export function createMessage(input: Omit<MessageRecord, "id" | "createdAt">): MessageRecord {
  return {
    ...input,
    id: createId("message"),
    createdAt: nowIso()
  };
}
