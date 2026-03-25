import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DecisionSidebar } from "../../../../../apps/web/components/council/DecisionSidebar";
import { getUiCopy } from "../../../../../apps/web/lib/i18n";

const copy = getUiCopy("ko");

describe("DecisionSidebar stop control", () => {
  it("renders a stop button wired to onStop while a run is active", async () => {
    const onRerun = vi.fn();
    const onStop = vi.fn();

    const element = createElement(DecisionSidebar, {
      copy,
      uiLocale: "ko",
      detail: null,
      selectedId: "session_1",
      isSubmitting: false,
      isStoppingRun: false,
      isSelectedSessionRunning: true,
      onRerun,
      onStop
    });

    const markup = renderToStaticMarkup(element);
    expect(markup).toContain(copy.decision.stop);
    expect(markup).toContain("bg-red-500/10");
  });
});
