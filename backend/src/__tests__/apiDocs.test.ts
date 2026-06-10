import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Express, Request, Response } from "express";

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("setupApiDocs — enabled", () => {
  it("registers /api/docs route and returns OpenAPI spec", async () => {
    vi.doMock("../config", () => ({
      config: { features: { enableApiDocs: true } },
    }));

    const { setupApiDocs } = await import("../utils/apiDocs");

    const handlers: Array<{ path: string; fn: Function }> = [];
    const mockApp = {
      get: vi.fn((path: string, fn: Function) => handlers.push({ path, fn })),
    } as unknown as Express;

    setupApiDocs(mockApp);

    expect(mockApp.get).toHaveBeenCalledWith("/api/docs", expect.any(Function));

    const route = handlers.find((h) => h.path === "/api/docs");
    expect(route).toBeDefined();

    const mockRes = { json: vi.fn() } as unknown as Response;
    route!.fn({} as Request, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        openapi: "3.0.0",
        info:    expect.objectContaining({ title: "Undercity API" }),
      })
    );
  });
});

describe("setupApiDocs — disabled", () => {
  it("does not register any route when disabled", async () => {
    vi.doMock("../config", () => ({
      config: { features: { enableApiDocs: false } },
    }));

    const { setupApiDocs } = await import("../utils/apiDocs");

    const mockApp = { get: vi.fn() } as unknown as Express;
    setupApiDocs(mockApp);

    expect(mockApp.get).not.toHaveBeenCalled();
  });
});
