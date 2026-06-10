import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { asyncHandler, asyncErrorHandler, wrap } from "../utils/asyncHandler";

function makeReq(): Request {
  return {} as Request;
}

function makeRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json:   vi.fn().mockReturnThis(),
  } as unknown as Response;
}

function makeNext(): NextFunction & ReturnType<typeof vi.fn> {
  return vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
}

describe("asyncHandler", () => {
  it("calls the handler and resolves normally", async () => {
    const handler = asyncHandler(async (_req, res) => {
      res.json({ ok: true });
    });

    const req  = makeReq();
    const res  = makeRes();
    const next = makeNext();

    await handler(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });

  it("catches async errors and passes to next", async () => {
    const error   = new Error("test error");
    const handler = asyncHandler(async () => {
      throw error;
    });

    const req  = makeReq();
    const res  = makeRes();
    const next = makeNext();

    await handler(req, res, next);

    // Need to wait for the promise rejection to propagate
    await new Promise((r) => setTimeout(r, 10));

    expect(next).toHaveBeenCalledWith(error);
  });

  it("catches sync errors thrown in async function", async () => {
    const handler = asyncHandler(async () => {
      throw new TypeError("sync in async");
    });

    const req  = makeReq();
    const res  = makeRes();
    const next = makeNext();

    await handler(req, res, next);
    await new Promise((r) => setTimeout(r, 10));

    expect(next).toHaveBeenCalledWith(expect.any(TypeError));
  });
});

describe("asyncErrorHandler", () => {
  it("handles error and passes to next on failure", async () => {
    const innerError = new Error("inner");
    const handler = asyncErrorHandler(async () => {
      throw innerError;
    });

    const err  = new Error("original");
    const req  = makeReq();
    const res  = makeRes();
    const next = makeNext();

    handler(err, req, res, next);
    await new Promise((r) => setTimeout(r, 10));

    expect(next).toHaveBeenCalledWith(innerError);
  });
});

describe("wrap", () => {
  it("binds method to instance and returns RequestHandler", async () => {
    class Controller {
      value = 42;
      async handle(_req: Request, res: Response) {
        res.json({ value: this.value });
      }
    }

    const ctrl    = new Controller();
    const handler = wrap(ctrl, ctrl.handle);

    const req  = makeReq();
    const res  = makeRes();
    const next = makeNext();

    await handler(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ value: 42 });
  });
});
