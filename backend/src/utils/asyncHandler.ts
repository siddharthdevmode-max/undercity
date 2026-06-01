import { Request, Response, NextFunction } from "express";

// ============================================================
// asyncHandler wrapper
// Wraps async controllers so errors auto-flow to errorHandler
// No more try/catch in every controller!
// ============================================================

type AsyncFunction = (req: Request, res: Response, next: NextFunction) => Promise<any>;

export const asyncHandler = (fn: AsyncFunction) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
