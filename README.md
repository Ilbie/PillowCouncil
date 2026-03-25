# PillowCouncil

PillowCouncil is a local/self-hosted MVP that runs a 4-round council discussion, then saves the final decision and TODO list.

The provider layer now follows OpenCode directly:

- provider/model catalog from OpenCode
- login methods from OpenCode
- model execution through the OpenCode SDK/server
- no custom provider/account auth adapters in this app

## Workspace

- `apps/web`: Next.js App Router UI + API
- `packages/shared`: SQLite/Drizzle schema, repository, shared types
- `packages/agents`: panel presets and agent definitions
- `packages/orchestration`: 4-round council flow
- `packages/providers`: OpenCode catalog/auth/runtime bridge
- `packages/exports`: Markdown/JSON export

## How It Works

1. The web app starts an OpenCode server through the SDK.
2. It loads providers, login methods, connected state, and models from OpenCode.
3. In the UI you save a reusable connection:
   - provider
   - login method
   - model
4. If the selected login method is API key based, `Save Connection` writes the key into the OpenCode auth store.
5. If the selected login method is browser based, `Open Login` starts the OpenCode browser flow.
6. New sessions reuse the saved connection and only ask for title, topic, panel, and debate intensity.
7. The `run` API executes the discussion immediately and stores results in SQLite.

## Quick Start

1. Run `npm install`
2. Run `npm run dev`
3. Open `http://127.0.0.1:3000`
4. In the web UI choose provider, login method, and model
5. Save the connection or complete browser login
6. Create a session

## Connection Model

The connection form is separate from the session form.

- login methods are derived from OpenCode provider metadata
- API keys are stored in OpenCode, not in PillowCouncil's SQLite DB
- browser login is started by OpenCode and the resulting credential is reused by PillowCouncil
- PillowCouncil stores the selected provider, login method, and model in SQLite
- PillowCouncil reuses the standard OpenCode credential store, so browser logins and saved API keys stay in the same place OpenCode already uses

## Configuration

- no project `.env` file is required
- the app database lives at `data/pillow-council.db`
- provider, login method, and model are changed in the web settings UI
- provider API keys can be entered in the web settings UI instead of a local `.env`

## Testing

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:e2e`
