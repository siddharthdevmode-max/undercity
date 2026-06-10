// ============================================================
// EXPRESS TYPE AUGMENTATION — UNDERCITY
// ============================================================

import type { Server as SocketServer } from "socket.io";

// BUG FIX: import TrustTier from trustEngine (not defined inline)
// Previous version defined a different type — caused type conflicts
import type { TrustTier } from "../services/trustEngine";

declare global {
  namespace Express {
    interface Request {
      requestId: string;

      firebaseUser?: {
        uid:           string;
        email?:        string;
        name?:         string;
        emailVerified: boolean;
      };

      trustInfo?: {
        isShadowBanned: boolean;
        trustScore:     number;
        tier:           TrustTier;
        isHardBanned:   boolean;
      };

      userRoles?: {
        is_admin:     boolean;
        is_developer: boolean;
        is_moderator: boolean;
      };

      rawBody?: Buffer;
    }

    interface Application {
      get(name: "io"): SocketServer;
      get(name: string): unknown;
    }
  }
}

export {};
