import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { validate, validateBody, validateQuery, validateParams } from "../middleware/validate";
import type { Request, Response, NextFunction } from "express";
import { ValidationError } from "../utils/errors";

const testSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    age:  z.number().int().positive(),
  }),
});

let req: Partial<Request>;
let res: Partial<Response>;
let next: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  req = { body: {}, params: {}, query: {} };
  res = {};
  next = vi.fn();
});

describe("validate", () => {
  it("passes valid input through", () => {
    req.body = { name: "Alice", age: 25 };
    const middleware = validate(testSchema);
    middleware(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it("returns ValidationError for invalid input", () => {
    req.body = { name: "", age: -1 };
    const middleware = validate(testSchema);
    middleware(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("returns ValidationError for missing required fields", () => {
    req.body = {};
    const middleware = validate(testSchema);
    middleware(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("returns ValidationError when body exceeds max keys", () => {
    const largeBody: Record<string, number> = {};
    for (let i = 0; i < 250; i++) largeBody[`key${i}`] = i;
    req.body = largeBody;
    const middleware = validate(testSchema);
    middleware(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("replaces req.body with parsed values", () => {
    req.body = { name: "  Bob  ", age: 30 };
    const schema = z.object({
      body: z.object({
        name: z.string().trim(),
        age:  z.number(),
      }),
    });
    const middleware = validate(schema);
    middleware(req as Request, res as Response, next as NextFunction);
    expect(req.body).toEqual({ name: "Bob", age: 30 });
  });

  it("passes through with empty body if schema allows it", () => {
    const emptyOkSchema = z.object({
      body: z.object({}).optional(),
    });
    req.body = undefined;
    const middleware = validate(emptyOkSchema);
    middleware(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("validateBody", () => {
  it("passes valid body", () => {
    req.body = { value: 42 };
    const middleware = validateBody(z.object({ value: z.number() }));
    middleware(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid body", () => {
    req.body = { value: "not-a-number" };
    const middleware = validateBody(z.object({ value: z.number() }));
    middleware(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });
});

describe("validateQuery", () => {
  it("passes valid query", () => {
    req.query = { page: "1" };
    const middleware = validateQuery(z.object({ page: z.coerce.number() }));
    middleware(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("validateParams", () => {
  it("passes valid params", () => {
    req.params = { id: "42" };
    const middleware = validateParams(z.object({ id: z.coerce.number() }));
    middleware(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
