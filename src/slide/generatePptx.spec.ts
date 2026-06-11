import { afterEach, describe, expect, it, vi } from "vitest";
import { resolvePptxImageSource } from "./generatePptx";

describe("PPTX image source resolution", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps valid base64 data URIs as image data", async () => {
    await expect(
      resolvePptxImageSource("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="),
    ).resolves.toEqual({
      data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
    });
  });

  it("converts URL images to base64 data URIs for pptxgenjs", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      headers: { get: () => "image/png" },
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }));

    await expect(
      resolvePptxImageSource("https://cdn.example.com/taco.png"),
    ).resolves.toEqual({
      data: "data:image/png;base64,AQID",
    });
  });

  it("uses a remote image resolver before browser fetch for http URLs", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await expect(
      resolvePptxImageSource("https://cdn.example.com/taco.png", {
        resolveRemoteImage: async () => "data:image/jpeg;base64,AQID",
      }),
    ).resolves.toEqual({
      data: "data:image/jpeg;base64,AQID",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to path without browser fetch when a remote resolver cannot read a URL", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await expect(
      resolvePptxImageSource("https://cdn.example.com/taco.png", {
        resolveRemoteImage: async () => null,
      }),
    ).resolves.toEqual({
      path: "https://cdn.example.com/taco.png",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("converts non-base64 SVG data URIs to base64 data URIs", async () => {
    const source = await resolvePptxImageSource(
      "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C%2Fsvg%3E",
    );

    expect(source).toEqual({
      data: `data:image/svg+xml;base64,${Buffer.from("<svg></svg>").toString(
        "base64",
      )}`,
    });
  });

  it("falls back to path for URLs when fetching is unavailable", async () => {
    vi.stubGlobal("fetch", undefined);

    await expect(
      resolvePptxImageSource("https://cdn.example.com/taco.png"),
    ).resolves.toEqual({
      path: "https://cdn.example.com/taco.png",
    });
  });
});
