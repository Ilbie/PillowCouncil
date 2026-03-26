import fs from "node:fs/promises";
import path from "node:path";

import type { McpLocalConfig, McpRemoteConfig, McpStatus } from "@opencode-ai/sdk/v2";
import { getPillowCouncilHomeDir, getAppSettings, saveAppSettings, type AppSettings } from "@pillow-council/shared";
import { z } from "zod";

import { getOpencodeClient, getOpencodeDirectory, disposeOpencodeHandle } from "./opencode";

const skillNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const mcpServerDraftSchema = z.discriminatedUnion("type", [
  z.object({
    name: z.string().trim().min(1).max(120),
    enabled: z.boolean().default(true),
    type: z.literal("local"),
    command: z.array(z.string().min(1)).min(1),
    environment: z.record(z.string(), z.string()).optional(),
    timeout: z.number().int().positive().optional()
  }),
  z.object({
    name: z.string().trim().min(1).max(120),
    enabled: z.boolean().default(true),
    type: z.literal("remote"),
    url: z.string().url(),
    headers: z.record(z.string(), z.string()).optional(),
    timeout: z.number().int().positive().optional()
  })
]);

export type McpServerDraft = z.infer<typeof mcpServerDraftSchema> & {
  status?: McpStatus["status"];
  error?: string | null;
  resourceCount?: number;
};

export const mcpSettingsPayloadSchema = z.object({
  enabled: z.boolean(),
  servers: z.array(mcpServerDraftSchema)
});

export type McpSettingsPayload = z.infer<typeof mcpSettingsPayloadSchema>;

export type McpSettingsState = {
  enabled: boolean;
  servers: McpServerDraft[];
};

export const managedSkillSchema = z.object({
  name: z.string().trim().min(1).max(64).regex(skillNamePattern),
  description: z.string().trim().min(1).max(1024),
  content: z.string().min(1),
  enabled: z.boolean().default(true)
});

export type ManagedSkill = z.infer<typeof managedSkillSchema> & {
  managed: true;
  location: string;
};

export type AvailableSkill = {
  name: string;
  description: string;
  enabled: boolean;
  managed: boolean;
  location: string;
};

export const skillsSettingsPayloadSchema = z.object({
  enabled: z.boolean(),
  managed: z.array(managedSkillSchema)
});

export type SkillsSettingsPayload = z.infer<typeof skillsSettingsPayloadSchema>;

export type SkillsSettingsState = {
  enabled: boolean;
  managed: ManagedSkill[];
  available: AvailableSkill[];
};

export type DefaultInstallableSkill = {
  id: string;
  name: string;
  description: string;
  sourceUrl: string;
  sourceLabel: string;
};

export type DefaultInstallableMcp = {
  id: string;
  name: string;
  description: string;
  command: string[];
  sourceUrl: string;
  sourceLabel: string;
};

export type DefaultInstallCatalog = {
  skills: DefaultInstallableSkill[];
  mcpServers: DefaultInstallableMcp[];
};

const DEFAULT_INSTALL_CATALOG: DefaultInstallCatalog = {
  skills: [
    {
      id: "deep-research-core",
      name: "research",
      description: "Core deep-research outline workflow from Weizhena's Deep-Research-skills repository.",
      sourceUrl: "https://raw.githubusercontent.com/Weizhena/Deep-Research-skills/master/skills/research-en/research/SKILL.md",
      sourceLabel: "Weizhena/Deep-Research-skills"
    },
    {
      id: "deep-research-deep",
      name: "research-deep",
      description: "Parallel deep investigation workflow from Weizhena's Deep-Research-skills repository.",
      sourceUrl: "https://raw.githubusercontent.com/Weizhena/Deep-Research-skills/master/skills/research-en/research-deep/SKILL.md",
      sourceLabel: "Weizhena/Deep-Research-skills"
    },
    {
      id: "pm-deliver-prd",
      name: "deliver-prd",
      description: "Production-ready PRD workflow from product-on-purpose/pm-skills.",
      sourceUrl: "https://raw.githubusercontent.com/product-on-purpose/pm-skills/main/skills/deliver-prd/SKILL.md",
      sourceLabel: "product-on-purpose/pm-skills"
    },
    {
      id: "context-fundamentals",
      name: "context-fundamentals",
      description: "Foundational context engineering skill from Agent-Skills-for-Context-Engineering.",
      sourceUrl: "https://raw.githubusercontent.com/muratcankoylan/Agent-Skills-for-Context-Engineering/main/skills/context-fundamentals/SKILL.md",
      sourceLabel: "muratcankoylan/Agent-Skills-for-Context-Engineering"
    },
    {
      id: "project-development",
      name: "project-development",
      description: "LLM product-development planning skill from Agent-Skills-for-Context-Engineering.",
      sourceUrl: "https://raw.githubusercontent.com/muratcankoylan/Agent-Skills-for-Context-Engineering/main/skills/project-development/SKILL.md",
      sourceLabel: "muratcankoylan/Agent-Skills-for-Context-Engineering"
    }
  ],
  mcpServers: [
    {
      id: "sequential-thinking",
      name: "sequential-thinking",
      description: "Official MCP sequential thinking server for stepwise analysis.",
      command: ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"],
      sourceUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking",
      sourceLabel: "modelcontextprotocol/servers"
    },
    {
      id: "pm-skills-mcp",
      name: "pm-skills",
      description: "Product-on-Purpose PM skills MCP server for instant PM workflow access.",
      command: ["npx", "-y", "pm-skills-mcp"],
      sourceUrl: "https://github.com/product-on-purpose/pm-skills",
      sourceLabel: "product-on-purpose/pm-skills"
    }
  ]
};

export function getDefaultInstallCatalog(): DefaultInstallCatalog {
  return DEFAULT_INSTALL_CATALOG;
}

function getEnabledSkillsDir(): string {
  return path.join(getPillowCouncilHomeDir(), "skills");
}

function getDisabledSkillsDir(): string {
  return path.join(getPillowCouncilHomeDir(), "skills-disabled");
}

export function getManagedSkillDirectoriesForTests(): { enabled: string; disabled: string } {
  return {
    enabled: getEnabledSkillsDir(),
    disabled: getDisabledSkillsDir()
  };
}

function withRuntimeFlagPatch(patch: Pick<AppSettings, "enableMcp" | "enableSkills">): AppSettings {
  const current = getAppSettings();
  return saveAppSettings({
    providerId: current.providerId,
    modelId: current.modelId,
    authMode: current.authMode,
    enableMcp: patch.enableMcp,
    enableSkills: patch.enableSkills
  });
}

function parseSkillDocument(input: string): { description: string; content: string } {
  const frontmatterMatch = input.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!frontmatterMatch) {
    return { description: "", content: input.trim() };
  }

  const frontmatter = frontmatterMatch[1];
  const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);

  return {
    description: descriptionMatch?.[1]?.trim() ?? "",
    content: frontmatterMatch[2].trim()
  };
}

function renderSkillDocument(skill: z.infer<typeof managedSkillSchema>): string {
  return `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.content.trim()}\n`;
}

async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function listSkillDirectories(rootDir: string): Promise<Array<{ name: string; location: string }>> {
  try {
    const entries = await fs.readdir(rootDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        name: entry.name,
        location: path.join(rootDir, entry.name, "SKILL.md")
      }));
  } catch {
    return [];
  }
}

async function readManagedSkillsFrom(rootDir: string, enabled: boolean): Promise<ManagedSkill[]> {
  const directories = await listSkillDirectories(rootDir);
  const skills = await Promise.all(
    directories.map(async (entry) => {
      const content = await fs.readFile(entry.location, "utf8");
      const parsed = parseSkillDocument(content);
      return {
        name: entry.name,
        description: parsed.description || entry.name,
        content: parsed.content,
        enabled,
        managed: true as const,
        location: entry.location
      };
    })
  );

  return skills;
}

async function readManagedSkills(): Promise<ManagedSkill[]> {
  const [enabledSkills, disabledSkills] = await Promise.all([
    readManagedSkillsFrom(getEnabledSkillsDir(), true),
    readManagedSkillsFrom(getDisabledSkillsDir(), false)
  ]);

  return [...enabledSkills, ...disabledSkills].sort((left, right) => left.name.localeCompare(right.name));
}

async function removeDirectoryIfExists(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { recursive: true, force: true }).catch(() => undefined);
}

async function syncManagedSkills(skills: z.infer<typeof managedSkillSchema>[]): Promise<void> {
  const enabledSkillsDir = getEnabledSkillsDir();
  const disabledSkillsDir = getDisabledSkillsDir();

  await ensureDirectory(enabledSkillsDir);
  await ensureDirectory(disabledSkillsDir);

  const existing = await readManagedSkills();
  const desiredNames = new Set(skills.map((skill) => skill.name));

  await Promise.all(
    existing
      .filter((skill) => !desiredNames.has(skill.name))
      .map((skill) => removeDirectoryIfExists(path.dirname(skill.location)))
  );

  await Promise.all(
    skills.map(async (skill) => {
      const targetRoot = skill.enabled ? enabledSkillsDir : disabledSkillsDir;
      const otherRoot = skill.enabled ? disabledSkillsDir : enabledSkillsDir;
      const targetDir = path.join(targetRoot, skill.name);
      await removeDirectoryIfExists(path.join(otherRoot, skill.name));
      await ensureDirectory(targetDir);
      await fs.writeFile(path.join(targetDir, "SKILL.md"), renderSkillDocument(skill), "utf8");
    })
  );
}

async function fetchDefaultSkillContent(sourceUrl: string): Promise<{ description: string; content: string }> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download default skill from ${sourceUrl}`);
  }

  const text = await response.text();
  const parsed = parseSkillDocument(text);
  return {
    description: parsed.description || "Imported skill",
    content: parsed.content
  };
}

function toMcpConfigMap(servers: z.infer<typeof mcpServerDraftSchema>[]): Record<string, McpLocalConfig | McpRemoteConfig> {
  return Object.fromEntries(
    servers.map((server) => {
      if (server.type === "local") {
        return [server.name, {
          type: "local",
          command: server.command,
          environment: server.environment,
          enabled: server.enabled,
          timeout: server.timeout
        } satisfies McpLocalConfig];
      }

      return [server.name, {
        type: "remote",
        url: server.url,
        headers: server.headers,
        enabled: server.enabled,
        timeout: server.timeout
      } satisfies McpRemoteConfig];
    })
  );
}

export async function getMcpSettingsState(): Promise<McpSettingsState> {
  const settings = getAppSettings();
  const client = await getOpencodeClient();
  const directory = getOpencodeDirectory();
  const [configResult, statusResult, resourcesResult] = await Promise.all([
    client.config.get({ directory }),
    client.mcp.status({ directory }),
    client.experimental.resource.list({ directory })
  ]);

  const configMcp = configResult.error || !configResult.data?.mcp ? {} : configResult.data.mcp;
  const statusMap = statusResult.error || !statusResult.data ? {} : statusResult.data;
  const resources = resourcesResult.error || !resourcesResult.data ? {} : resourcesResult.data;

  const resourceCountByClient = Object.values(resources).reduce<Record<string, number>>((accumulator, resource) => {
    accumulator[resource.client] = (accumulator[resource.client] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    enabled: settings.enableMcp,
    servers: Object.entries(configMcp).map(([name, config]) => ({
      name,
      ...(config as McpLocalConfig | McpRemoteConfig),
      enabled: "enabled" in config ? Boolean(config.enabled) : true,
      status: statusMap[name]?.status,
      error: "error" in (statusMap[name] ?? {}) ? (statusMap[name] as { error?: string }).error ?? null : null,
      resourceCount: resourceCountByClient[name] ?? 0
    }))
  };
}

export async function saveMcpSettingsState(input: McpSettingsPayload): Promise<McpSettingsState> {
  const payload = mcpSettingsPayloadSchema.parse(input);
  const client = await getOpencodeClient();
  const directory = getOpencodeDirectory();
  const configResult = await client.config.get({ directory });

  if (configResult.error || !configResult.data) {
    throw new Error("Failed to read OpenCode config");
  }

  const currentServerNames = new Set(Object.keys(configResult.data.mcp ?? {}));
  const nextServerNames = new Set(payload.servers.map((server) => server.name));
  const removedServerNames = [...currentServerNames].filter((name) => !nextServerNames.has(name));

  const nextConfig = {
    ...configResult.data,
    mcp: toMcpConfigMap(payload.servers)
  };
  const updateResult = await client.config.update({ directory, config: nextConfig });
  if (updateResult.error) {
    throw new Error("Failed to update MCP config");
  }

  await Promise.all(
    [...removedServerNames.map((name) => ({ name, enabled: false })), ...payload.servers].map((server) =>
      server.enabled && payload.enabled
        ? client.mcp.connect({ directory, name: server.name }).catch(() => undefined)
        : client.mcp.disconnect({ directory, name: server.name }).catch(() => undefined)
    )
  );

  withRuntimeFlagPatch({ enableMcp: payload.enabled, enableSkills: getAppSettings().enableSkills });
  return getMcpSettingsState();
}

export async function getSkillsSettingsState(): Promise<SkillsSettingsState> {
  const settings = getAppSettings();
  const client = await getOpencodeClient();
  const directory = getOpencodeDirectory();
  const [managed, availableResult] = await Promise.all([
    readManagedSkills(),
    client.app.skills({ directory })
  ]);

  const managedByLocation = new Map(managed.map((skill) => [skill.location, skill]));
  const available = (availableResult.error || !availableResult.data ? [] : availableResult.data).map((skill) => ({
    name: skill.name,
    description: skill.description,
    location: skill.location,
    managed: managedByLocation.has(skill.location),
    enabled: true
  }));

  return {
    enabled: settings.enableSkills,
    managed,
    available
  };
}

export async function saveSkillsSettingsState(input: SkillsSettingsPayload): Promise<SkillsSettingsState> {
  const payload = skillsSettingsPayloadSchema.parse(input);
  await syncManagedSkills(payload.managed);
  withRuntimeFlagPatch({ enableMcp: getAppSettings().enableMcp, enableSkills: payload.enabled });
  await disposeOpencodeHandle();
  return getSkillsSettingsState();
}

export async function installDefaultSkill(skillId: string): Promise<SkillsSettingsState> {
  const preset = DEFAULT_INSTALL_CATALOG.skills.find((item) => item.id === skillId);
  if (!preset) {
    throw new Error("Unknown default skill");
  }

  const current = await getSkillsSettingsState();
  if (current.managed.some((skill) => skill.name === preset.name)) {
    return current;
  }

  const fetched = await fetchDefaultSkillContent(preset.sourceUrl);
  return saveSkillsSettingsState({
    enabled: current.enabled,
    managed: [
      ...current.managed.map((skill) => ({
        name: skill.name,
        description: skill.description,
        content: skill.content,
        enabled: skill.enabled
      })),
      {
        name: preset.name,
        description: fetched.description || preset.description,
        content: fetched.content,
        enabled: true
      }
    ]
  });
}

export async function installDefaultMcpServer(serverId: string): Promise<McpSettingsState> {
  const preset = DEFAULT_INSTALL_CATALOG.mcpServers.find((item) => item.id === serverId);
  if (!preset) {
    throw new Error("Unknown default MCP server");
  }

  const current = await getMcpSettingsState();
  if (current.servers.some((server) => server.name === preset.name)) {
    return current;
  }

  return saveMcpSettingsState({
    enabled: current.enabled,
    servers: [
      ...current.servers,
      {
        name: preset.name,
        enabled: true,
        type: "local",
        command: preset.command
      }
    ]
  });
}
