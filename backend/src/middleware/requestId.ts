import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

// Attaches a unique ID to every request for tracing
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const id = (req.headers["x-request-id"] as string) || uuidv4();
  req.requestId = id;
  res.setHeader("x-request-id", id);
  next();
};
