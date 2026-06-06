import type { TrustTier } from "../services/trustEngine";

declare global {
  namespace Express {
    interface Request {
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
      requestId?: string;
      userRoles?: {
        is_admin:     boolean;
        is_developer: boolean;
        is_moderator: boolean;
      };
    }
  }
}

export {};
