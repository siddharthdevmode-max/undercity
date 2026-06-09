// ============================================================
// SANITIZE TESTS
// ============================================================

import { describe, it, expect } from "vitest";
import {
  sanitizeString,
  sanitizeObject,
  sanitizeValue,
  safeUsername,
  safeCrimeKey,
  safeEmail,
  safeText,
  safePositiveInt,
  safeNonNegativeInt,
} from "../utils/sanitize";

// ── sanitizeString ────────────────────────────────────────

describe("sanitizeString", () => {
  it("strips HTML tags", () => {
    expect(sanitizeString("<script>alert(1)</script>")).toBe("alert(1)");
  });

  it("strips malformed tags", () => {
    expect(sanitizeString("<img src=x onerror=alert(1)>")).toBe("");
  });

  it("strips null bytes", () => {
    expect(sanitizeString("hello\0world")).toBe("helloworld");
  });

  it("strips BiDi override characters", () => {
    expect(sanitizeString("hello\u202Eworld")).toBe("helloworld");
  });

  it("strips HTML entities — leaves decoded text", () => {
    // &lt;script&gt; → after stripping entities → "script"
    // The entity stripper removes the entity markers but the text between remains.
    // This is correct — we strip the encoding, not the underlying word.
    // A word like "script" is not dangerous — only the tag <script> is.
    const result = sanitizeString("&lt;script&gt;");
    expect(result).not.toContain("&lt;");
    expect(result).not.toContain("&gt;");
  });

  it("strips actual script tags entirely", () => {
    // The real XSS vector is <script>...</script> — not &lt;script&gt;
    // Tag stripping handles this correctly
    expect(sanitizeString("<script>alert(1)</script>")).toBe("alert(1)");
  });

  it("trims whitespace", () => {
    expect(sanitizeString("  hello  ")).toBe("hello");
  });

  it("returns empty string for non-string input", () => {
    expect(sanitizeString(123)).toBe("");
    expect(sanitizeString(null)).toBe("");
    expect(sanitizeString(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(sanitizeString("")).toBe("");
  });

  it("passes clean strings through unchanged", () => {
    expect(sanitizeString("clean input 123")).toBe("clean input 123");
  });

  it("handles nested XSS attempt", () => {
    const result = sanitizeString("<<script>>alert(1)<</script>>");
    expect(result).not.toContain("<script>");
  });

  it("strips amp entity", () => {
    const result = sanitizeString("hello &amp; world");
    expect(result).not.toContain("&amp;");
  });
});

// ── sanitizeObject ────────────────────────────────────────

describe("sanitizeObject", () => {
  it("sanitizes string values", () => {
    const result = sanitizeObject({ name: "<b>bold</b>", value: "clean" });
    expect(result.name).toBe("bold");
    expect(result.value).toBe("clean");
  });

  it("passes through non-string primitives", () => {
    const result = sanitizeObject(
      { count: 42, flag: true, nothing: null } as Record<string, unknown>
    );
    expect(result.count).toBe(42);
    expect(result.flag).toBe(true);
    expect(result.nothing).toBeNull();
  });

  it("sanitizes nested objects", () => {
    const input  = { user: { name: "<script>x</script>", age: 25 } };
    const result = sanitizeObject(input as Record<string, unknown>) as typeof input;
    expect((result.user as Record<string, unknown>).name).toBe("x");
  });

  it("sanitizes arrays of strings", () => {
    const input  = { tags: ["<b>tag1</b>", "clean"] };
    const result = sanitizeObject(input as Record<string, unknown>) as typeof input;
    expect((result.tags as string[])[0]).toBe("tag1");
    expect((result.tags as string[])[1]).toBe("clean");
  });

  it("handles empty object", () => {
    expect(sanitizeObject({})).toEqual({});
  });
});

// ── sanitizeValue ─────────────────────────────────────────

describe("sanitizeValue", () => {
  it("sanitizes strings", () => {
    expect(sanitizeValue("<b>hi</b>")).toBe("hi");
  });

  it("sanitizes arrays recursively", () => {
    const result = sanitizeValue(["<b>a</b>", "b"]) as string[];
    expect(result[0]).toBe("a");
    expect(result[1]).toBe("b");
  });

  it("sanitizes objects recursively", () => {
    const result = sanitizeValue({ x: "<script>y</script>" }) as Record<string, string>;
    expect(result.x).toBe("y");
  });

  it("passes through numbers", () => {
    expect(sanitizeValue(42)).toBe(42);
  });

  it("passes through booleans", () => {
    expect(sanitizeValue(true)).toBe(true);
  });

  it("passes through null", () => {
    expect(sanitizeValue(null)).toBeNull();
  });

  it("does not throw at MAX_DEPTH", () => {
    let deep: Record<string, unknown> = { val: "<script>x</script>" };
    for (let i = 0; i < 12; i++) deep = { nested: deep };
    expect(() => sanitizeValue(deep)).not.toThrow();
  });
});

// ── Zod schemas ───────────────────────────────────────────

describe("safeUsername", () => {
  it("accepts valid username", () => {
    expect(safeUsername.parse("Player_123")).toBe("Player_123");
  });

  it("rejects too short", () => {
    expect(() => safeUsername.parse("ab")).toThrow();
  });

  it("rejects too long", () => {
    expect(() => safeUsername.parse("a".repeat(21))).toThrow();
  });

  it("rejects special characters", () => {
    expect(() => safeUsername.parse("user<script>")).toThrow();
  });

  it("rejects spaces", () => {
    expect(() => safeUsername.parse("user name")).toThrow();
  });
});

describe("safeCrimeKey", () => {
  it("accepts valid crime key", () => {
    expect(safeCrimeKey.parse("bank_heist")).toBe("bank_heist");
  });

  it("rejects uppercase", () => {
    expect(() => safeCrimeKey.parse("Bank_Heist")).toThrow();
  });

  it("rejects spaces", () => {
    expect(() => safeCrimeKey.parse("bank heist")).toThrow();
  });

  it("rejects empty", () => {
    expect(() => safeCrimeKey.parse("")).toThrow();
  });
});

describe("safeEmail", () => {
  it("accepts valid email and lowercases it", () => {
    expect(safeEmail.parse("USER@EXAMPLE.COM")).toBe("user@example.com");
  });

  it("rejects invalid email", () => {
    expect(() => safeEmail.parse("notanemail")).toThrow();
  });

  it("rejects email over 254 chars", () => {
    expect(() => safeEmail.parse("a".repeat(250) + "@b.com")).toThrow();
  });
});

describe("safeText", () => {
  it("accepts text under max length", () => {
    expect(safeText(100).parse("hello world")).toBe("hello world");
  });

  it("rejects text over max length", () => {
    expect(() => safeText(10).parse("a".repeat(11))).toThrow();
  });

  it("strips HTML from text", () => {
    expect(safeText(100).parse("<b>bold</b>")).toBe("bold");
  });
});

describe("safePositiveInt", () => {
  it("accepts positive integers", () => {
    expect(safePositiveInt().parse(1)).toBe(1);
  });

  it("rejects zero", () => {
    expect(() => safePositiveInt().parse(0)).toThrow();
  });

  it("rejects negative", () => {
    expect(() => safePositiveInt().parse(-1)).toThrow();
  });

  it("rejects float", () => {
    expect(() => safePositiveInt().parse(1.5)).toThrow();
  });
});

describe("safeNonNegativeInt", () => {
  it("accepts zero", () => {
    expect(safeNonNegativeInt().parse(0)).toBe(0);
  });

  it("rejects negative", () => {
    expect(() => safeNonNegativeInt().parse(-1)).toThrow();
  });
});
