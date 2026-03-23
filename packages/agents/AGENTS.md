# AGENTS PACKAGE GUIDE

## OVERVIEW
`packages/agents` defines panel presets and persona prompts. It is tiny in code size but high-risk semantically because prompt edits change debate quality without type errors.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Preset data and lookup | `src/presets.ts` | Core file for all panels and agent definitions |
| Public export | `src/index.ts` | Barrel only |

## CONVENTIONS
- Keep preset IDs stable; sessions store `panelId` and orchestration resolves it at runtime.
- Each agent definition should stay coherent across `name`, `role`, `goal`, `bias`, `style`, and `systemPrompt`.
- Existing presets deliberately include a skeptic/reviewer voice; preserve balance when adding panels.
- Prompt tone is product-specific, not generic boilerplate.

## ANTI-PATTERNS
- Do not rename preset IDs casually; stored sessions depend on them.
- Do not edit system prompts for style alone without checking how the panel balance changes.
- Do not move persona logic into orchestration; orchestration consumes these definitions as input.

## SAFE EDITING
- Prefer duplicating an existing preset structure when adding a new panel.
- Keep agent keys unique within a panel.
- Re-read the full preset after edits; the main risk is semantic drift, not syntax.
