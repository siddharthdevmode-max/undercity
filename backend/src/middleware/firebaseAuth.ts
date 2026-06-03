import { Request, Response, NextFunction } from "express";
import { authAdmin } from "../config/firebase";
import { logger } from "../utils/logger";

export const verifyFirebaseToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = header.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Malformed token" });
  }

  try {
    const decoded    = await authAdmin.verifyIdToken(token);
    req.firebaseUser = {
      uid:   decoded.uid,
      email: decoded.email,
      name:  decoded.name,
    };
    next();
  } catch (err: unknown) {
    const error = err as { message?: string; code?: string };
    logger.warn("🔐 Firebase token verification failed", {
      error: error.message,
      code:  error.code,
      path:  req.path,
    });
    return res.status(401).json({ message: "Invalid token" });
  }
};
