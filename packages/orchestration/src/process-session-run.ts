import { createCouncilProvider } from "@ship-council/providers";
import {
  appendMessageRecord,
  appendRoundRecord,
  accumulateRunUsage,
  assertRunIsActive,
  completeRunRecord,
  failRun,
  getRunById,
  getSession,
  RUN_STOPPED_BY_USER_MESSAGE,
  searchRunMessageMemories,
  saveDecisionArtifacts,
  saveSessionRuntimePreset,
  startSessionRun,
  updateRunDebateState,
  updateRoundSummary,
  type SessionRunRecord
} from "@ship-council/shared";

import { runCouncilSession } from "./run-session";
import { publishRunStreamEvent, resetRunStream } from "./run-stream-bus";

export async function processSessionRun(sessionId: string): Promise<SessionRunRecord> {
  const session = getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const run = startSessionRun(sessionId);
  resetRunStream(sessionId);

  void (async () => {
    try {
      const provider = createCouncilProvider();
      const artifacts = await runCouncilSession({
        session,
        runId: run.id,
        provider,
        assertActive() {
          assertRunIsActive(run.id);
        },
        callbacks: {
          onRoundCreated(round) {
            appendRoundRecord(round);
          },
          onRoundSummary(roundId, summary) {
            updateRoundSummary(roundId, summary);
          },
          onMessageCreated(message, usage) {
            appendMessageRecord(message, usage);
          },
          onDebateStateUpdated(state) {
            updateRunDebateState(run.id, state);
          },
          onRuntimePresetCompiled(preset) {
            saveSessionRuntimePreset(session.id, preset);
          },
          onUsage(usage) {
            accumulateRunUsage(run.id, usage);
          },
          onStreamEvent(event) {
            publishRunStreamEvent(event);
          }
        },
        retrieveMemories({ query, excludeMessageIds }) {
          return searchRunMessageMemories({
            sessionId: session.id,
            runId: run.id,
            query,
            limit: 3,
            excludeMessageIds
          });
        }
      });

      assertRunIsActive(run.id);
      saveDecisionArtifacts(run.id, session.id, artifacts.decision);
      assertRunIsActive(run.id);
      completeRunRecord(run.id);
      publishRunStreamEvent({
        type: "run-complete",
        sessionId: session.id,
        runId: run.id,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown run error";
      failRun(run.id, message);
      publishRunStreamEvent({
        type: "run-error",
        sessionId: session.id,
        runId: run.id,
        error: message,
        createdAt: new Date().toISOString()
      });
    }
  })();

  return run;
}
