// ============================================================
// AGE VERIFICATION HELPERS
// Separated so fast refresh works on AgeGate component
// ============================================================

const AGE_KEY = 'uc_age_verified';

export function isAgeVerified(): boolean {
  try { return localStorage.getItem(AGE_KEY) === 'true'; }
  catch { return false; }
}

export function setAgeVerified(): void {
  try { localStorage.setItem(AGE_KEY, 'true'); }
  catch { /* ignore */ }
}
