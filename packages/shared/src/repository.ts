import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { getDb, getSQLite } from "./db";
import { appSettings, decisions, messages, rounds, sessionRuns, sessions, todos } from "./schema";
import type {
  AgentDefinition,
  AppSettings,
  DebateIntensity,
  DecisionRecord,
  PresetDefinition,
  DecisionSummary,
  MessageRecord,
  RoundRecord,
  RunStage,
  SessionCreateInput,
  SessionDetailResponse,
  SessionLanguage,
  SessionRecord,
  SessionRunRecord,
  SessionSummary,
  ThinkingIntensity,
  TodoRecord,
  UsageSummary
} from "./types";
import {
  agentDefinitionSchema,
  DEBATE_INTENSITY_DEFAULT,
  DEBATE_INTENSITY_MAX,
  DEBATE_INTENSITY_MIN,
  THINKING_INTENSITIES
} from "./types";
import { createId, nowIso, parseList, serializeList } from "./utils";

type RunArtifacts = {
  rounds: Array<RoundRecord & { messages: MessageRecord[] }>;
  decision: DecisionSummary;
  usage: UsageSummary;
};

export const RUN_STOPPED_BY_USER_MESSAGE = "Run stopped by user.";

function isUserStoppedRun(run: SessionRunRecord | null): boolean {
  return run?.status === "failed" && run.errorMessage === RUN_STOPPED_BY_USER_MESSAGE;
}

function normalizeDebateIntensity(value: string | number | null | undefined): DebateIntensity {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numeric)) {
    return Math.min(DEBATE_INTENSITY_MAX, Math.max(DEBATE_INTENSITY_MIN, Math.trunc(numeric)));
  }

  if (value === "light") {
    return 1;
  }
  if (value === "intense") {
    return 3;
  }

  return DEBATE_INTENSITY_DEFAULT;
}

function normalizeThinkingIntensity(value: string | null | undefined): ThinkingIntensity {
  const normalized = value?.trim();
  if (normalized) {
    return normalized;
  }

  return "balanced";
}

function mapSession(row: typeof sessions.$inferSelect): SessionRecord {
  const customPreset =
    row.presetName && row.presetDescription && row.presetAgents
      ? parseCustomPreset({
          id: row.presetId,
          name: row.presetName,
          description: row.presetDescription,
          agents: row.presetAgents
        })
      : null;

  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    presetId: row.presetId,
    customPreset,
    provider: row.provider,
    model: row.model,
    thinkingIntensity: normalizeThinkingIntensity(row.thinkingIntensity),
    debateIntensity: normalizeDebateIntensity(row.debateIntensity),
    roundCount: row.roundCount,
    language: row.language as SessionLanguage,
    status: row.status as SessionRecord["status"],
    currentRunId: row.currentRunId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function parseCustomPreset(input: {
  id: string;
  name: string;
  description: string;
  agents: string;
}): PresetDefinition | null {
  try {
    const parsed = JSON.parse(input.agents);
    const agentList = agentDefinitionSchema.array().parse(parsed);

    return {
      id: input.id,
      name: input.name,
      description: input.description,
      agents: agentList
    };
  } catch {
    return null;
  }
}

function serializeCustomPresetAgents(agents: AgentDefinition[]): string {
  return JSON.stringify(agents);
}

function mapRun(row: typeof sessionRuns.$inferSelect | undefined): SessionRunRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    sessionId: row.sessionId,
    status: row.status as SessionRunRecord["status"],
    workerId: row.workerId,
    claimedAt: row.claimedAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    errorMessage: row.errorMessage,
    totalPromptTokens: row.totalPromptTokens,
    totalCompletionTokens: row.totalCompletionTokens,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapRound(row: typeof rounds.$inferSelect): RoundRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    runId: row.runId,
    roundNumber: row.roundNumber,
    stage: row.stage as RunStage,
    title: row.title,
    summary: row.summary,
    createdAt: row.createdAt
  };
}

function mapMessage(row: typeof messages.$inferSelect): MessageRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    runId: row.runId,
    roundId: row.roundId,
    agentKey: row.agentKey,
    agentName: row.agentName,
    role: row.role as MessageRecord["role"],
    kind: row.kind as MessageRecord["kind"],
    content: row.content,
    createdAt: row.createdAt
  };
}

function mapDecision(row: typeof decisions.$inferSelect | undefined): DecisionRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    sessionId: row.sessionId,
    runId: row.runId,
    topRecommendation: row.topRecommendation,
    alternatives: parseList(row.alternatives),
    risks: parseList(row.risks),
    assumptions: parseList(row.assumptions),
    openQuestions: parseList(row.openQuestions),
    nextActions: parseList(row.nextActions),
    finalSummary: row.finalSummary,
    createdAt: row.createdAt
  };
}

function mapTodo(row: typeof todos.$inferSelect): TodoRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    runId: row.runId,
    title: row.title,
    description: row.description,
    priority: row.priority as TodoRecord["priority"],
    status: row.status as TodoRecord["status"],
    createdAt: row.createdAt
  };
}

export function getDefaultAppSettings(): AppSettings {
  return {
    providerId: "",
    modelId: "",
    authMode: "",
    updatedAt: nowIso()
  };
}

export function getAppSettings(): AppSettings {
  const db = getDb();
  const defaults = getDefaultAppSettings();
  const row = db.select().from(appSettings).where(eq(appSettings.key, "default")).get();

  if (!row) {
    return defaults;
  }

  return {
    providerId: row.providerId || defaults.providerId,
    modelId: row.modelId || defaults.modelId,
    authMode: row.authMode || defaults.authMode,
    updatedAt: row.updatedAt
  };
}

export function saveAppSettings(input: Omit<AppSettings, "updatedAt">): AppSettings {
  const db = getDb();
  const updatedAt = nowIso();

  db.insert(appSettings)
    .values({
      key: "default",
      proxyBaseUrl: "",
      providerId: input.providerId,
      modelId: input.modelId,
      authMode: input.authMode,
      updatedAt
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        proxyBaseUrl: "",
        providerId: input.providerId,
        modelId: input.modelId,
        authMode: input.authMode,
        updatedAt
      }
    })
    .run();

  return {
    providerId: input.providerId,
    modelId: input.modelId,
    authMode: input.authMode,
    updatedAt
  };
}

export function saveConnectionSettings(input: Pick<AppSettings, "providerId" | "authMode">): AppSettings {
  const current = getAppSettings();

  return saveAppSettings({
    providerId: input.providerId,
    modelId: current.modelId,
    authMode: input.authMode
  });
}

export function createSession(input: SessionCreateInput): SessionRecord {
  const db = getDb();
  const now = nowIso();
  const debateIntensity = normalizeDebateIntensity(input.debateIntensity);
  const roundCount = Math.max(input.roundCount, debateIntensity * 2 + 2);
  const session: typeof sessions.$inferInsert = {
    id: createId("session"),
    title: input.title?.trim() || input.prompt.slice(0, 48),
    prompt: input.prompt,
    presetId: input.presetId,
    presetName: input.customPreset?.name ?? null,
    presetDescription: input.customPreset?.description ?? null,
    presetAgents: input.customPreset ? serializeCustomPresetAgents(input.customPreset.agents) : null,
    provider: input.provider,
    model: input.model,
    thinkingIntensity: input.thinkingIntensity,
    debateIntensity: String(debateIntensity),
    roundCount,
    language: input.language,
    status: "draft",
    currentRunId: null,
    createdAt: now,
    updatedAt: now
  };

  db.insert(sessions).values(session).run();
  return mapSession({
    ...session,
    presetName: session.presetName ?? null,
    presetDescription: session.presetDescription ?? null,
    presetAgents: session.presetAgents ?? null,
    thinkingIntensity: session.thinkingIntensity ?? input.thinkingIntensity,
    debateIntensity: String(debateIntensity),
    currentRunId: session.currentRunId ?? null
  });
}

export function getSession(sessionId: string): SessionRecord | null {
  const db = getDb();
  const row = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  return row ? mapSession(row) : null;
}

export function startSessionRun(sessionId: string): SessionRunRecord {
  const db = getDb();
  const session = getSession(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  const currentRun = getCurrentRun(sessionId);
  if (currentRun && (currentRun.status === "running" || currentRun.status === "queued")) {
    throw new Error("A run is already in progress");
  }

  const now = nowIso();
  const run: typeof sessionRuns.$inferInsert = {
    id: createId("run"),
    sessionId,
    status: "running",
    workerId: null,
    claimedAt: null,
    startedAt: now,
    completedAt: null,
    errorMessage: null,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    createdAt: now,
    updatedAt: now
  };

  db.transaction((tx) => {
    tx.insert(sessionRuns).values(run).run();
    tx.update(sessions)
      .set({
        currentRunId: run.id,
        status: "running",
        updatedAt: now
      })
      .where(eq(sessions.id, sessionId))
      .run();
  });

  return mapRun({
    ...run,
    workerId: run.workerId ?? null,
    claimedAt: run.claimedAt ?? null,
    startedAt: run.startedAt ?? null,
    completedAt: run.completedAt ?? null,
    errorMessage: run.errorMessage ?? null,
    totalPromptTokens: run.totalPromptTokens ?? 0,
    totalCompletionTokens: run.totalCompletionTokens ?? 0
  })!;
}

export function queueSessionRun(sessionId: string): SessionRunRecord {
  return startSessionRun(sessionId);
}

export function listSessions(): SessionSummary[] {
  const db = getDb();
  const sessionRows = db.select().from(sessions).orderBy(desc(sessions.updatedAt)).all();
  const runIds = sessionRows.map((session) => session.currentRunId).filter((value): value is string => Boolean(value));
  const runRows = runIds.length > 0
    ? db.select().from(sessionRuns).where(inArray(sessionRuns.id, runIds)).all()
    : [];

  const runMap = new Map(runRows.map((row) => [row.id, mapRun(row)]));

  return sessionRows.map((session) => ({
    session: mapSession(session),
    run: session.currentRunId ? runMap.get(session.currentRunId) ?? null : null
  }));
}

export function getCurrentRun(sessionId: string): SessionRunRecord | null {
  const session = getSession(sessionId);
  if (!session?.currentRunId) {
    return null;
  }

  const db = getDb();
  const row = db.select().from(sessionRuns).where(eq(sessionRuns.id, session.currentRunId)).get();
  return mapRun(row);
}

export function stopCurrentRun(sessionId: string): SessionRunRecord {
  const run = getCurrentRun(sessionId);
  if (!run || run.status !== "running") {
    throw new Error("No active run to stop");
  }

  failRun(run.id, RUN_STOPPED_BY_USER_MESSAGE);

  const stoppedRun = getRunById(run.id);
  if (!stoppedRun) {
    throw new Error("Run not found");
  }

  return stoppedRun;
}

export function assertRunIsActive(runId: string): SessionRunRecord {
  const run = getRunById(runId);
  if (!run) {
    throw new Error("Run not found");
  }

  if (isUserStoppedRun(run)) {
    throw new Error(RUN_STOPPED_BY_USER_MESSAGE);
  }

  if (run.status !== "running") {
    throw new Error(`Run ${runId} is no longer active`);
  }

  return run;
}

export function getRunById(runId: string): SessionRunRecord | null {
  const db = getDb();
  const row = db.select().from(sessionRuns).where(eq(sessionRuns.id, runId)).get();
  return mapRun(row);
}

export function getSessionDetail(sessionId: string): SessionDetailResponse | null {
  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  const run = getCurrentRun(sessionId);
  if (!run) {
    return {
      session,
      run: null,
      rounds: [],
      decision: null,
      todos: [],
      usage: {
        totalPromptTokens: 0,
        totalCompletionTokens: 0
      }
    };
  }

  const db = getDb();
  const roundRows = db
    .select()
    .from(rounds)
    .where(and(eq(rounds.sessionId, sessionId), eq(rounds.runId, run.id)))
    .orderBy(rounds.roundNumber)
    .all();

  const roundIds = roundRows.map((round) => round.id);
  const messageRows = db
    .select()
    .from(messages)
    .where(and(eq(messages.sessionId, sessionId), eq(messages.runId, run.id)))
    .orderBy(asc(messages.createdAt))
    .all();

  const messagesByRound = new Map<string, MessageRecord[]>();
  for (const row of messageRows) {
    const message = mapMessage(row);
    const key = row.roundId ?? "unassigned";
    const group = messagesByRound.get(key) ?? [];
    group.push(message);
    messagesByRound.set(key, group);
  }

  const groupedRounds = roundRows.map((row) => ({
    ...mapRound(row),
    messages: messagesByRound.get(row.id) ?? []
  }));

  const decisionRow = db
    .select()
    .from(decisions)
    .where(and(eq(decisions.sessionId, sessionId), eq(decisions.runId, run.id)))
    .get();

  const todoRows = db
    .select()
    .from(todos)
    .where(and(eq(todos.sessionId, sessionId), eq(todos.runId, run.id)))
    .all()
    .map(mapTodo);

  return {
    session,
    run,
    rounds: groupedRounds,
    decision: mapDecision(decisionRow),
    todos: todoRows,
    usage: {
      totalPromptTokens: run.totalPromptTokens,
      totalCompletionTokens: run.totalCompletionTokens
    }
  };
}

export function completeRun(runId: string, artifacts: RunArtifacts): void {
  const sqlite = getSQLite();
  const now = nowIso();
  const run = getRunById(runId);

  if (!run) {
    throw new Error("Run not found");
  }

  const session = getSession(run.sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  const save = sqlite.transaction(() => {
    for (const round of artifacts.rounds) {
      sqlite
        .prepare(
          `INSERT INTO rounds (id, session_id, run_id, round_number, stage, title, summary, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(round.id, round.sessionId, round.runId, round.roundNumber, round.stage, round.title, round.summary, round.createdAt);

      for (const message of round.messages) {
        sqlite
          .prepare(
            `INSERT INTO messages
              (id, session_id, run_id, round_id, agent_key, agent_name, role, kind, content, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            message.id,
            message.sessionId,
            message.runId,
            message.roundId,
            message.agentKey,
            message.agentName,
            message.role,
            message.kind,
            message.content,
            message.createdAt
          );
      }
    }

    const decisionId = createId("decision");
    sqlite
      .prepare(
        `INSERT INTO decisions
          (id, session_id, run_id, top_recommendation, alternatives, risks, assumptions, open_questions, next_actions, final_summary, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        decisionId,
        session.id,
        runId,
        artifacts.decision.topRecommendation,
        serializeList(artifacts.decision.alternatives),
        serializeList(artifacts.decision.risks),
        serializeList(artifacts.decision.assumptions),
        serializeList(artifacts.decision.openQuestions),
        serializeList(artifacts.decision.nextActions),
        artifacts.decision.finalSummary,
        now
      );

    for (const todo of artifacts.decision.todos) {
      sqlite
        .prepare(
          `INSERT INTO todos (id, session_id, run_id, title, description, priority, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(createId("todo"), session.id, runId, todo.title, todo.description, todo.priority, todo.status, now);
    }

    sqlite
      .prepare(
        `UPDATE session_runs
         SET status = 'completed',
             completed_at = ?,
             updated_at = ?,
             total_prompt_tokens = ?,
             total_completion_tokens = ?,
             error_message = NULL
         WHERE id = ?`
      )
      .run(
        now,
        now,
        artifacts.usage.totalPromptTokens,
        artifacts.usage.totalCompletionTokens,
        runId
      );

    sqlite
      .prepare(`UPDATE sessions SET status = 'completed', updated_at = ? WHERE id = ? AND current_run_id = ?`)
      .run(now, session.id, runId);
  });

  save();
}

export function appendRoundRecord(round: RoundRecord): void {
  const sqlite = getSQLite();
  const now = nowIso();

  sqlite
    .prepare(
      `INSERT INTO rounds (id, session_id, run_id, round_number, stage, title, summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(round.id, round.sessionId, round.runId, round.roundNumber, round.stage, round.title, round.summary, round.createdAt);

  sqlite.prepare(`UPDATE session_runs SET updated_at = ? WHERE id = ?`).run(now, round.runId);
}

export function appendMessageRecord(
  message: MessageRecord,
  usage?: {
    promptTokens: number;
    completionTokens: number;
  }
): void {
  const sqlite = getSQLite();
  const now = nowIso();

  sqlite
    .prepare(
      `INSERT INTO messages
        (id, session_id, run_id, round_id, agent_key, agent_name, role, kind, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      message.id,
      message.sessionId,
      message.runId,
      message.roundId,
      message.agentKey,
      message.agentName,
      message.role,
      message.kind,
      message.content,
      message.createdAt
    );

  sqlite
    .prepare(
      `UPDATE session_runs
       SET total_prompt_tokens = total_prompt_tokens + ?,
           total_completion_tokens = total_completion_tokens + ?,
           updated_at = ?
       WHERE id = ?`
    )
    .run(usage?.promptTokens ?? 0, usage?.completionTokens ?? 0, now, message.runId);
}

export function accumulateRunUsage(
  runId: string,
  usage: {
    promptTokens: number;
    completionTokens: number;
  }
): void {
  const sqlite = getSQLite();
  const now = nowIso();

  sqlite
    .prepare(
      `UPDATE session_runs
       SET total_prompt_tokens = total_prompt_tokens + ?,
           total_completion_tokens = total_completion_tokens + ?,
           updated_at = ?
       WHERE id = ?`
    )
    .run(usage.promptTokens, usage.completionTokens, now, runId);
}

export function updateRoundSummary(roundId: string, summary: string | null): void {
  const sqlite = getSQLite();
  sqlite.prepare(`UPDATE rounds SET summary = ? WHERE id = ?`).run(summary, roundId);
}

export function saveDecisionArtifacts(runId: string, sessionId: string, decision: DecisionSummary): void {
  const sqlite = getSQLite();
  const now = nowIso();
  const decisionId = createId("decision");

  sqlite
    .prepare(
      `INSERT INTO decisions
        (id, session_id, run_id, top_recommendation, alternatives, risks, assumptions, open_questions, next_actions, final_summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      decisionId,
      sessionId,
      runId,
      decision.topRecommendation,
      serializeList(decision.alternatives),
      serializeList(decision.risks),
      serializeList(decision.assumptions),
      serializeList(decision.openQuestions),
      serializeList(decision.nextActions),
      decision.finalSummary,
      now
    );

  for (const todo of decision.todos) {
    sqlite
      .prepare(
        `INSERT INTO todos (id, session_id, run_id, title, description, priority, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(createId("todo"), sessionId, runId, todo.title, todo.description, todo.priority, todo.status, now);
  }
}

export function completeRunRecord(runId: string): void {
  const sqlite = getSQLite();
  const now = nowIso();
  const run = getRunById(runId);

  if (!run) {
    throw new Error("Run not found");
  }

  sqlite
    .prepare(
      `UPDATE session_runs
       SET status = 'completed',
           completed_at = ?,
           updated_at = ?,
           error_message = NULL
       WHERE id = ?`
    )
    .run(now, now, runId);

  sqlite
    .prepare(`UPDATE sessions SET status = 'completed', updated_at = ? WHERE id = ? AND current_run_id = ?`)
    .run(now, run.sessionId, runId);
}

export function failRun(runId: string, errorMessage: string): void {
  const sqlite = getSQLite();
  const now = nowIso();
  const run = getRunById(runId);

  if (!run) {
    return;
  }

  const markFailed = sqlite.transaction(() => {
    sqlite
      .prepare(
        `UPDATE session_runs
         SET status = 'failed',
             completed_at = ?,
             updated_at = ?,
             error_message = ?
         WHERE id = ?`
      )
      .run(now, now, errorMessage, runId);

    sqlite
      .prepare(`UPDATE sessions SET status = 'failed', updated_at = ? WHERE id = ? AND current_run_id = ?`)
      .run(now, run.sessionId, runId);
  });

  markFailed();
}

export function seedCompletedRun(
  sessionId: string,
  runId: string,
  artifacts: RunArtifacts
): void {
  const session = getSession(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  const existingRun = getRunById(runId);
  if (!existingRun) {
    throw new Error("Run not found");
  }

  completeRun(runId, artifacts);
}
