import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PillowCouncilHeader } from "../../../../../apps/web/components/council/PillowCouncilHeader";
import { getUiCopy } from "../../../../../apps/web/lib/i18n";

describe("PillowCouncilHeader branding", () => {
  it("renders the PillowCouncil logo and badge in the app header", () => {
    const html = renderToStaticMarkup(
      createElement(PillowCouncilHeader, {
        copy: getUiCopy("ko"),
        uiLocale: "ko",
        onOpenSettings: vi.fn(),
        onUiLocaleChange: vi.fn()
      })
    );

    expect(html).toContain("PillowCouncil");
    expect(html).toContain("PillowCouncil logo");
    expect(html).toContain("/logo.svg");
    expect(html).toContain("PillowCouncil MVP");
  });
});
