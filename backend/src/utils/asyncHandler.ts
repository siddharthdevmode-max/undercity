// ============================================================
// ASYNC HANDLER — UNDERCITY
// ============================================================

import {
  Request,
  Response,
  NextFunction,
  RequestHandler,
  ErrorRequestHandler,
} from "express";

// ── Fixed: accepts handlers that return Response OR void ──
export type AsyncRequestHandler = (
  req:  Request,
  res:  Response,
  next: NextFunction
) => Promise<void | Response>;

export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  const named = {
    [fn.name || "asyncHandler"]: function (
      req:  Request,
      res:  Response,
      next: NextFunction
    ): void {
      Promise.resolve(fn(req, res, next)).catch(next);
    },
  };
  return named[fn.name || "asyncHandler"] as RequestHandler;
}

type AsyncErrorHandler = (
  err:  Error,
  req:  Request,
  res:  Response,
  next: NextFunction
) => Promise<void>;

export function asyncErrorHandler(fn: AsyncErrorHandler): ErrorRequestHandler {
  const named = {
    [fn.name || "asyncErrorHandler"]: function (
      err:  Error,
      req:  Request,
      res:  Response,
      next: NextFunction
    ): void {
      fn(err, req, res, next).catch(next);
    },
  };
  return named[fn.name || "asyncErrorHandler"] as ErrorRequestHandler;
}

export function wrap<T>(
  instance: T,
  method:   (this: T, req: Request, res: Response, next: NextFunction) => Promise<void | Response>
): RequestHandler {
  return asyncHandler(method.bind(instance) as AsyncRequestHandler);
}
