import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { runIntegrityCheck, encodeIntegrityReport, markPageLoad } from "../utils/integrityCheck";

// Mark page load time for timing checks
markPageLoad();

let cachedVisitorId:       string | null = null;
let cachedIntegrityHeader: string | null = null;
let fpPromise: ReturnType<typeof FingerprintJS.load> | null = null;

function getAgent() {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }
  return fpPromise;
}

export async function getVisitorId(): Promise<string> {
  if (cachedVisitorId) return cachedVisitorId;

  try {
    const agent  = await getAgent();
    const result = await agent.get();
    cachedVisitorId = result.visitorId;
    return cachedVisitorId;
  } catch {
    cachedVisitorId = `fallback-${Math.random().toString(36).substring(2)}`;
    return cachedVisitorId;
  }
}

// ============================================================
// GET INTEGRITY HEADER
// Returns encoded integrity report for x-integrity header
// Cached per page load — runs once per session
// ============================================================
export function getIntegrityHeader(): string {
  if (cachedIntegrityHeader) return cachedIntegrityHeader;

  const report = runIntegrityCheck();
  cachedIntegrityHeader = encodeIntegrityReport(report);
  return cachedIntegrityHeader;
}

// ============================================================
// GET ALL UAC HEADERS
// Call this when building request headers
// ============================================================
export async function getUACHeaders(): Promise<Record<string, string>> {
  const [visitorId] = await Promise.all([getVisitorId()]);

  return {
    "x-fp-visitor": visitorId,
    "x-integrity":  getIntegrityHeader(),
  };
}

export function clearFingerprintCache() {
  cachedVisitorId       = null;
  cachedIntegrityHeader = null;
}
