import FingerprintJS from "@fingerprintjs/fingerprintjs";

let cachedVisitorId: string | null = null;
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

export function clearFingerprintCache() {
  cachedVisitorId = null;
}
