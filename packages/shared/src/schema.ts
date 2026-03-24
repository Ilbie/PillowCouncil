import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  presetId: text("panel_id").notNull(),
  presetName: text("preset_name"),
  presetDescription: text("preset_description"),
  presetAgents: text("preset_agents"),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  enableWebSearch: integer("enable_web_search", { mode: "boolean" }).notNull().default(false),
  thinkingIntensity: text("thinking_intensity").notNull().default("balanced"),
  debateIntensity: text("debate_intensity").notNull().default("2"),
  roundCount: integer("round_count").notNull(),
  language: text("language").notNull(),
  status: text("status").notNull(),
  currentRunId: text("current_run_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  proxyBaseUrl: text("proxy_base_url").notNull(),
  providerId: text("provider_id").notNull().default(""),
  modelId: text("model_id").notNull().default(""),
  authMode: text("auth_mode").notNull(),
  enableMcp: integer("enable_mcp", { mode: "boolean" }).notNull().default(true),
  enableSkills: integer("enable_skills", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull()
});

export const sessionRuns = sqliteTable("session_runs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  status: text("status").notNull(),
  workerId: text("worker_id"),
  claimedAt: text("claimed_at"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  errorMessage: text("error_message"),
  debateState: text("debate_state").notNull().default('{"agreedPoints":[],"activeConflicts":[],"pendingQuestions":[]}'),
  mcpCalls: integer("mcp_calls").notNull().default(0),
  skillUses: integer("skill_uses").notNull().default(0),
  webSearches: integer("web_searches").notNull().default(0),
  totalPromptTokens: integer("total_prompt_tokens").notNull().default(0),
  totalCompletionTokens: integer("total_completion_tokens").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const rounds = sqliteTable("rounds", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  runId: text("run_id").notNull(),
  roundNumber: integer("round_number").notNull(),
  stage: text("stage").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  createdAt: text("created_at").notNull()
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  runId: text("run_id").notNull(),
  roundId: text("round_id"),
  agentKey: text("agent_key").notNull(),
  agentName: text("agent_name").notNull(),
  role: text("role").notNull(),
  kind: text("kind").notNull(),
  targetAgentKey: text("target_agent_key"),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull()
});

export const decisions = sqliteTable("decisions", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  runId: text("run_id").notNull(),
  topRecommendation: text("top_recommendation").notNull(),
  alternatives: text("alternatives").notNull(),
  risks: text("risks").notNull(),
  assumptions: text("assumptions").notNull(),
  openQuestions: text("open_questions").notNull(),
  nextActions: text("next_actions").notNull(),
  finalSummary: text("final_summary").notNull(),
  createdAt: text("created_at").notNull()
});

export const todos = sqliteTable("todos", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  runId: text("run_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: text("priority").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull()
});
