import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { databasePath, ensureParentDirectory } from "./utils";
import * as schema from "./schema";

let connection: Database.Database | null = null;

function createConnection(): Database.Database {
  const filePath = databasePath();
  ensureParentDirectory(filePath);
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      panel_id TEXT NOT NULL,
      preset_name TEXT,
      preset_description TEXT,
      preset_agents TEXT,
      provider TEXT NOT NULL DEFAULT 'openai',
      model TEXT NOT NULL,
      enable_web_search INTEGER NOT NULL DEFAULT 0,
      thinking_intensity TEXT NOT NULL DEFAULT 'balanced',
      debate_intensity TEXT NOT NULL DEFAULT '2',
      round_count INTEGER NOT NULL,
      language TEXT NOT NULL,
      status TEXT NOT NULL,
      current_run_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      proxy_base_url TEXT NOT NULL,
      provider_id TEXT NOT NULL DEFAULT '',
      model_id TEXT NOT NULL DEFAULT '',
      auth_mode TEXT NOT NULL,
      enable_mcp INTEGER NOT NULL DEFAULT 1,
      enable_skills INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_runs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      status TEXT NOT NULL,
      worker_id TEXT,
      claimed_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      error_message TEXT,
      debate_state TEXT NOT NULL DEFAULT '{"agreedPoints":[],"activeConflicts":[],"pendingQuestions":[]}',
      total_prompt_tokens INTEGER NOT NULL DEFAULT 0,
      total_completion_tokens INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS rounds (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      stage TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (run_id) REFERENCES session_runs(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      round_id TEXT,
      agent_key TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      role TEXT NOT NULL,
      kind TEXT NOT NULL,
      target_agent_key TEXT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (run_id) REFERENCES session_runs(id),
      FOREIGN KEY (round_id) REFERENCES rounds(id)
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      top_recommendation TEXT NOT NULL,
      alternatives TEXT NOT NULL,
      risks TEXT NOT NULL,
      assumptions TEXT NOT NULL,
      open_questions TEXT NOT NULL,
      next_actions TEXT NOT NULL,
      final_summary TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (run_id) REFERENCES session_runs(id)
    );

    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (run_id) REFERENCES session_runs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_current_run ON sessions(current_run_id);
    CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);
    CREATE INDEX IF NOT EXISTS idx_runs_session_created ON session_runs(session_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_runs_status_created ON session_runs(status, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_rounds_run_round ON rounds(run_id, round_number ASC);
    CREATE INDEX IF NOT EXISTS idx_messages_run_round ON messages(run_id, round_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_todos_run ON todos(run_id);

    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      message_id UNINDEXED,
      session_id UNINDEXED,
      run_id UNINDEXED,
      round_id UNINDEXED,
      round_number UNINDEXED,
      stage UNINDEXED,
      agent_key UNINDEXED,
      agent_name UNINDEXED,
      kind UNINDEXED,
      created_at UNINDEXED,
      content
    );

    CREATE TRIGGER IF NOT EXISTS messages_fts_after_insert
    AFTER INSERT ON messages
    BEGIN
      INSERT INTO messages_fts (
        message_id,
        session_id,
        run_id,
        round_id,
        round_number,
        stage,
        agent_key,
        agent_name,
        kind,
        created_at,
        content
      )
      VALUES (
        new.id,
        new.session_id,
        new.run_id,
        new.round_id,
        COALESCE((SELECT round_number FROM rounds WHERE id = new.round_id), 0),
        (SELECT stage FROM rounds WHERE id = new.round_id),
        new.agent_key,
        new.agent_name,
        new.kind,
        new.created_at,
        new.content
      );
    END;

    CREATE TRIGGER IF NOT EXISTS messages_fts_after_delete
    AFTER DELETE ON messages
    BEGIN
      DELETE FROM messages_fts WHERE message_id = old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS messages_fts_after_update
    AFTER UPDATE ON messages
    BEGIN
      DELETE FROM messages_fts WHERE message_id = old.id;

      INSERT INTO messages_fts (
        message_id,
        session_id,
        run_id,
        round_id,
        round_number,
        stage,
        agent_key,
        agent_name,
        kind,
        created_at,
        content
      )
      VALUES (
        new.id,
        new.session_id,
        new.run_id,
        new.round_id,
        COALESCE((SELECT round_number FROM rounds WHERE id = new.round_id), 0),
        (SELECT stage FROM rounds WHERE id = new.round_id),
        new.agent_key,
        new.agent_name,
        new.kind,
        new.created_at,
        new.content
      );
    END;
  `);

  const sessionColumns = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
  if (!sessionColumns.some((column) => column.name === "provider")) {
    db.exec(`ALTER TABLE sessions ADD COLUMN provider TEXT NOT NULL DEFAULT 'openai';`);
  }
  if (!sessionColumns.some((column) => column.name === "preset_name")) {
    db.exec(`ALTER TABLE sessions ADD COLUMN preset_name TEXT;`);
  }
  if (!sessionColumns.some((column) => column.name === "preset_description")) {
    db.exec(`ALTER TABLE sessions ADD COLUMN preset_description TEXT;`);
  }
  if (!sessionColumns.some((column) => column.name === "preset_agents")) {
    db.exec(`ALTER TABLE sessions ADD COLUMN preset_agents TEXT;`);
  }
  if (!sessionColumns.some((column) => column.name === "thinking_intensity")) {
    db.exec(`ALTER TABLE sessions ADD COLUMN thinking_intensity TEXT NOT NULL DEFAULT 'balanced';`);
  }
  if (!sessionColumns.some((column) => column.name === "enable_web_search")) {
    db.exec(`ALTER TABLE sessions ADD COLUMN enable_web_search INTEGER NOT NULL DEFAULT 0;`);
  }
  if (!sessionColumns.some((column) => column.name === "debate_intensity")) {
    db.exec(`ALTER TABLE sessions ADD COLUMN debate_intensity TEXT NOT NULL DEFAULT '2';`);
  }
  db.exec(`
    UPDATE sessions
    SET debate_intensity = CASE debate_intensity
      WHEN 'light' THEN '1'
      WHEN 'balanced' THEN '2'
      WHEN 'intense' THEN '3'
      ELSE debate_intensity
    END
    WHERE debate_intensity IN ('light', 'balanced', 'intense');
  `);

  const appSettingsColumns = db.prepare("PRAGMA table_info(app_settings)").all() as Array<{ name: string }>;
  if (!appSettingsColumns.some((column) => column.name === "enable_mcp")) {
    db.exec(`ALTER TABLE app_settings ADD COLUMN enable_mcp INTEGER NOT NULL DEFAULT 1;`);
  }
  if (!appSettingsColumns.some((column) => column.name === "enable_skills")) {
    db.exec(`ALTER TABLE app_settings ADD COLUMN enable_skills INTEGER NOT NULL DEFAULT 1;`);
  }
  if (!appSettingsColumns.some((column) => column.name === "provider_id")) {
    db.exec(`ALTER TABLE app_settings ADD COLUMN provider_id TEXT NOT NULL DEFAULT '';`);
  }
  if (!appSettingsColumns.some((column) => column.name === "model_id")) {
    db.exec(`ALTER TABLE app_settings ADD COLUMN model_id TEXT NOT NULL DEFAULT '';`);
  }

  const messageColumns = db.prepare("PRAGMA table_info(messages)").all() as Array<{ name: string }>;
  if (!messageColumns.some((column) => column.name === "target_agent_key")) {
    db.exec(`ALTER TABLE messages ADD COLUMN target_agent_key TEXT;`);
  }

  const runColumns = db.prepare("PRAGMA table_info(session_runs)").all() as Array<{ name: string }>;
  if (!runColumns.some((column) => column.name === "debate_state")) {
    db.exec(
      `ALTER TABLE session_runs ADD COLUMN debate_state TEXT NOT NULL DEFAULT '{"agreedPoints":[],"activeConflicts":[],"pendingQuestions":[]}';`
    );
  }

  db.exec(`
    INSERT INTO messages_fts (
      message_id,
      session_id,
      run_id,
      round_id,
      round_number,
      stage,
      agent_key,
      agent_name,
      kind,
      created_at,
      content
    )
    SELECT
      messages.id,
      messages.session_id,
      messages.run_id,
      messages.round_id,
      COALESCE(rounds.round_number, 0),
      rounds.stage,
      messages.agent_key,
      messages.agent_name,
      messages.kind,
      messages.created_at,
      messages.content
    FROM messages
    LEFT JOIN rounds ON rounds.id = messages.round_id
    WHERE messages.id NOT IN (SELECT message_id FROM messages_fts);
  `);

  return db;
}

export function getSQLite(): Database.Database {
  if (!connection) {
    connection = createConnection();
  }

  return connection;
}

export function getDb() {
  return drizzle(getSQLite(), { schema });
}

export function resetDatabaseForTests(): void {
  const filePath = databasePath();

  if (connection) {
    connection.close();
    connection = null;
  }

  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }

  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${filePath}${suffix}`;
    if (fs.existsSync(sidecar)) {
      fs.rmSync(sidecar, { force: true });
    }
  }
}
