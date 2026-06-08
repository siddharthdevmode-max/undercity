// ============================================================
// CLIENT INTEGRITY CHECK
// Detects common tamper / cheat attempts on the client side
// Results are sent to backend via x-fp-visitor header
// Server makes all real decisions — this is just early detection
// ============================================================

export interface IntegrityReport {
  passed:   boolean;
  flags:    string[];
  score:    number; // 0 = clean, 100 = definitely cheating
}

// ============================================================
// CHECK: DevTools open detection
// Many cheaters use DevTools to modify variables
// ============================================================
function checkDevTools(): boolean {
  // Method 1: window size difference
  const widthThreshold  = window.outerWidth  - window.innerWidth  > 160;
  const heightThreshold = window.outerHeight - window.innerHeight > 160;

  // Method 2: Firebug legacy
  const hasFirebug =
    typeof (window as unknown as Record<string, unknown>).console === "object" &&
    !!(window as unknown as Record<string, unknown>).console;

  // Only flag if BOTH size check and console check agree
  // Reduces false positives from browser zoom
  return (widthThreshold || heightThreshold) && hasFirebug;
}

// ============================================================
// CHECK: Console was tampered with
// Automation tools often override console methods
// ============================================================
function checkConsoleTampered(): boolean {
  try {
    // Native console.log toString contains "native code"
    const consoleStr = Function.prototype.toString.call(console.log);
    return !consoleStr.includes("native code");
  } catch {
    return true; // If we can't check, assume tampered
  }
}

// ============================================================
// CHECK: Automation framework detection
// Selenium, Puppeteer, Playwright leave traces
// ============================================================
function checkAutomation(): boolean {
  const win = window as unknown as Record<string, unknown>;

  const automationFlags = [
    "_selenium",
    "__selenium_unwrapped",
    "__webdriver_evaluate",
    "__selenium_evaluate",
    "__webdriver_script_func",
    "__webdriver_script_fn",
    "__$webdriverAsyncExecutor",
    "__lastWatirAlert",
    "__lastWatirConfirm",
    "__lastWatirPrompt",
    "_Selenium_IDE_Recorder",
    "_selenium_metro",
    "callSelenium",
    "__webdriver_unwrapped",
    "__nightmarejs",
    "nightmare",
    "callPhantom",
    "_phantom",
    "__phantom",
    "phantom",
    "domAutomation",
    "domAutomationController",
    "__puppeteer_evaluation_script__",
    "cdc_adoQpoasnfa76pfcZLmcfl_Array",
    "cdc_adoQpoasnfa76pfcZLmcfl_Promise",
    "cdc_adoQpoasnfa76pfcZLmcfl_Symbol",
  ];

  return automationFlags.some(
    (flag) => win[flag] !== undefined
  );
}

// ============================================================
// CHECK: navigator.webdriver
// Set to true by Puppeteer/Selenium
// ============================================================
function checkWebDriver(): boolean {
  return navigator.webdriver === true;
}

// ============================================================
// CHECK: Time consistency
// Bots sometimes have mismatched system time
// A game action should never take 0ms
// ============================================================
let pageLoadTime = 0;

export function markPageLoad(): void {
  pageLoadTime = Date.now();
}

function checkTimeConsistency(): boolean {
  if (pageLoadTime === 0) return false;
  const elapsed = Date.now() - pageLoadTime;
  // If less than 500ms since page load, likely automated
  return elapsed < 500;
}

// ============================================================
// CHECK: User agent consistency
// Bots sometimes have mismatched user agents
// ============================================================
function checkUserAgentConsistency(): boolean {
  const ua = navigator.userAgent.toLowerCase();

  // Headless browsers
  if (ua.includes("headless"))          return true;
  if (ua.includes("phantomjs"))         return true;

  // Bot signatures
  if (ua.includes("selenium"))          return true;
  if (ua.includes("webdriver"))         return true;

  return false;
}

// ============================================================
// MAIN INTEGRITY CHECK
// Runs all checks and returns a report
// ============================================================
export function runIntegrityCheck(): IntegrityReport {
  const flags: string[] = [];

  try {
    if (checkWebDriver())           flags.push("WEBDRIVER_DETECTED");
    if (checkAutomation())          flags.push("AUTOMATION_DETECTED");
    if (checkConsoleTampered())     flags.push("CONSOLE_TAMPERED");
    if (checkUserAgentConsistency()) flags.push("SUSPICIOUS_USER_AGENT");
    if (checkTimeConsistency())     flags.push("SUSPICIOUS_TIMING");
    // DevTools check last — highest false positive rate
    if (checkDevTools())            flags.push("DEVTOOLS_OPEN");
  } catch {
    // If checks throw, something weird is going on
    flags.push("CHECK_ERROR");
  }

  // Score: each flag adds weight, automation flags weigh more
  const WEIGHTS: Record<string, number> = {
    WEBDRIVER_DETECTED:    80,
    AUTOMATION_DETECTED:   80,
    CONSOLE_TAMPERED:       0, // disabled — false positive in production builds
    SUSPICIOUS_USER_AGENT: 60,
    SUSPICIOUS_TIMING:     20,
    DEVTOOLS_OPEN:         10, // low weight — common false positive
    CHECK_ERROR:           30,
  };

  const score = Math.min(
    100,
    flags.reduce((total, flag) => total + (WEIGHTS[flag] ?? 10), 0)
  );

  return {
    passed: score < 60,
    flags,
    score,
  };
}

// ============================================================
// ENCODE FOR HEADER
// Compact format to pass via x-fp-visitor header
// Backend decodes this alongside the fingerprint
// ============================================================
export function encodeIntegrityReport(report: IntegrityReport): string {
  return btoa(
    JSON.stringify({
      p: report.passed ? 1 : 0,
      f: report.flags,
      s: report.score,
    })
  );
}
