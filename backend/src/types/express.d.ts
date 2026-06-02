// ============================================================
// EXPRESS REQUEST TYPE EXTENSIONS
// Adds typed properties set by middleware
// ============================================================

declare global {
  namespace Express {
    interface Request {
      firebaseUser?: {
        uid: string;
        email?: string;
        name?: string;
      };
      trustInfo?: {
        isShadowBanned: boolean;
        trustScore: number;
        tier?: string;
      };
      requestId?: string;
    }
  }
}

export {};
