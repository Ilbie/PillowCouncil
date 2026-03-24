import { beforeEach, describe, expect, it, vi } from "vitest";

const getSkillsSettingsState = vi.fn();
const saveSkillsSettingsState = vi.fn();

vi.mock("@ship-council/providers", async () => {
  const actual = await vi.importActual<typeof import("@ship-council/providers")>("@ship-council/providers");

  return {
    ...actual,
    getSkillsSettingsState,
    saveSkillsSettingsState
  };
});

describe("/api/settings/skills", () => {
  const routeModulePath = "../../../../../../apps/web/app/api/settings/skills/route" + ".ts";

  beforeEach(() => {
    getSkillsSettingsState.mockReset();
    saveSkillsSettingsState.mockReset();
  });

  it("returns the skills tab state", async () => {
    getSkillsSettingsState.mockResolvedValue({
      enabled: true,
      managed: [
        {
          name: "release-checklist",
          description: "Project release checklist",
          content: "# release-checklist",
          enabled: true,
          managed: true,
          location: ".opencode/skills/release-checklist/SKILL.md"
        }
      ],
      available: [
        {
          name: "release-checklist",
          description: "Project release checklist",
          enabled: true,
          managed: true,
          location: ".opencode/skills/release-checklist/SKILL.md"
        }
      ]
    });

    const { GET } = await import(routeModulePath);
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      enabled: true,
      managed: [
        {
          name: "release-checklist",
          description: "Project release checklist",
          content: "# release-checklist",
          enabled: true,
          managed: true,
          location: ".opencode/skills/release-checklist/SKILL.md"
        }
      ],
      available: [
        {
          name: "release-checklist",
          description: "Project release checklist",
          enabled: true,
          managed: true,
          location: ".opencode/skills/release-checklist/SKILL.md"
        }
      ]
    });
  }, 10000);

  it("saves the skills tab state", async () => {
    saveSkillsSettingsState.mockResolvedValue({ enabled: false, managed: [], available: [] });

    const { POST } = await import(routeModulePath);
    const response = await POST(
      new Request("http://localhost/api/settings/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: false,
          managed: [
            {
              name: "release-checklist",
              description: "Project release checklist",
              content: "# release-checklist",
              enabled: false
            }
          ]
        })
      })
    );

    expect(saveSkillsSettingsState).toHaveBeenCalledWith({
      enabled: false,
      managed: [
        {
          name: "release-checklist",
          description: "Project release checklist",
          content: "# release-checklist",
          enabled: false
        }
      ]
    });
    expect(response.status).toBe(200);
  }, 10000);
});
