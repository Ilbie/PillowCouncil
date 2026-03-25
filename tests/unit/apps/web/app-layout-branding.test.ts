import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Space_Grotesk: () => ({ variable: "font-display" }),
  Noto_Sans_KR: () => ({ variable: "font-body" })
}));

const { metadata } = await import("../../../../apps/web/app/layout");

describe("app layout branding metadata", () => {
  it("publishes the provided logo assets as icons and social image metadata", () => {
    expect(String(metadata.metadataBase)).toBe("http://localhost:3000/");

    expect(metadata.icons).toEqual(
      expect.objectContaining({
        icon: expect.arrayContaining([
          expect.objectContaining({ url: "/logo.svg" }),
          expect.objectContaining({ url: "/logo.ico" })
        ]),
        shortcut: [expect.objectContaining({ url: "/logo.ico" })],
        apple: [expect.objectContaining({ url: "/logo.png" })]
      })
    );

    expect(metadata.openGraph).toEqual(
      expect.objectContaining({
        images: [expect.objectContaining({ url: "/logo.png" })]
      })
    );
  });
});
