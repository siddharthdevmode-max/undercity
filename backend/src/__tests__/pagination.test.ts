import { describe, it, expect } from "vitest";
import type { Request } from "express";
import {
  getPagination,
  buildPaginatedResponse,
  getSort,
  getCursorPagination,
  encodeCursor,
  decodeCursor,
  buildCursorResponse,
  toOrderByClause,
  toLimitOffsetClause,
  PAGINATION,
} from "../utils/pagination";

function mockReq(query: Record<string, string> = {}): Request {
  return { query } as unknown as Request;
}

// ── getPagination ──────────────────────────────────────────

describe("getPagination", () => {
  it("returns defaults when no query params", () => {
    const result = getPagination(mockReq());
    expect(result.page).toBe(1);
    expect(result.limit).toBe(PAGINATION.DEFAULT_LIMIT);
    expect(result.offset).toBe(0);
  });

  it("parses page and limit correctly", () => {
    const result = getPagination(mockReq({ page: "3", limit: "50" }));
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(100);
  });

  it("clamps limit to MAX_LIMIT", () => {
    const result = getPagination(mockReq({ limit: "9999" }));
    expect(result.limit).toBe(PAGINATION.MAX_LIMIT);
  });

  it("clamps limit to MIN_LIMIT", () => {
    const result = getPagination(mockReq({ limit: "0" }));
    expect(result.limit).toBe(PAGINATION.MIN_LIMIT);
  });

  it("clamps page to MAX_PAGE", () => {
    const result = getPagination(mockReq({ page: "99999" }));
    expect(result.page).toBe(PAGINATION.MAX_PAGE);
  });

  it("clamps page to min 1", () => {
    const result = getPagination(mockReq({ page: "-5" }));
    expect(result.page).toBe(1);
  });

  it("handles NaN page gracefully", () => {
    const result = getPagination(mockReq({ page: "abc" }));
    expect(result.page).toBe(1);
  });

  it("handles NaN limit gracefully", () => {
    const result = getPagination(mockReq({ limit: "abc" }));
    expect(result.limit).toBe(PAGINATION.DEFAULT_LIMIT);
  });

  it("calculates offset correctly", () => {
    const result = getPagination(mockReq({ page: "5", limit: "10" }));
    expect(result.offset).toBe(40);
  });
});

// ── buildPaginatedResponse ─────────────────────────────────

describe("buildPaginatedResponse", () => {
  const params = { page: 1, limit: 10, offset: 0 };

  it("builds correct response", () => {
    const result = buildPaginatedResponse([1, 2, 3], 25, params);
    expect(result.data).toEqual([1, 2, 3]);
    expect(result.pagination.total).toBe(25);
    expect(result.pagination.totalPages).toBe(3);
    expect(result.pagination.hasNext).toBe(true);
    expect(result.pagination.hasPrev).toBe(false);
  });

  it("handles zero total", () => {
    const result = buildPaginatedResponse([], 0, params);
    expect(result.pagination.totalPages).toBe(0);
    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(false);
  });

  it("hasNext false on last page", () => {
    const p = { page: 3, limit: 10, offset: 20 };
    const result = buildPaginatedResponse([1], 25, p);
    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(true);
  });

  it("hasPrev true when page > 1", () => {
    const p = { page: 2, limit: 10, offset: 10 };
    const result = buildPaginatedResponse([1], 25, p);
    expect(result.pagination.hasPrev).toBe(true);
  });
});

// ── getSort ────────────────────────────────────────────────

describe("getSort", () => {
  const allowed = ["created_at", "username", "level"];

  it("returns defaults when no query", () => {
    const result = getSort(mockReq(), allowed);
    expect(result.field).toBe("created_at");
    expect(result.direction).toBe("DESC");
  });

  it("accepts valid field and direction", () => {
    const result = getSort(mockReq({ sort: "username", order: "ASC" }), allowed);
    expect(result.field).toBe("username");
    expect(result.direction).toBe("ASC");
  });

  it("falls back to default for invalid field", () => {
    // "injection; DROP TABLE" is not in allowed list → falls back to default
    const result = getSort(mockReq({ sort: "injection; DROP TABLE" }), allowed);
    expect(result.field).toBe("created_at");
  });

  it("falls back to DESC for invalid direction", () => {
    const result = getSort(mockReq({ order: "SIDEWAYS" }), allowed);
    expect(result.direction).toBe("DESC");
  });

  it("uses custom defaults", () => {
    const result = getSort(mockReq(), allowed, "level", "ASC");
    expect(result.field).toBe("level");
    expect(result.direction).toBe("ASC");
  });
});

// ── getCursorPagination ────────────────────────────────────

describe("getCursorPagination", () => {
  it("returns defaults", () => {
    const result = getCursorPagination(mockReq());
    expect(result.limit).toBe(PAGINATION.DEFAULT_LIMIT);
    expect(result.cursor).toBeNull();
  });

  it("parses valid cursor", () => {
    const cursor = encodeCursor({ id: 1, ts: 123 });
    const result = getCursorPagination(mockReq({ cursor }));
    expect(result.cursor).toBe(cursor);
  });

  it("ignores invalid cursor characters", () => {
    const result = getCursorPagination(mockReq({ cursor: "!!!invalid!!!" }));
    expect(result.cursor).toBeNull();
  });

  it("ignores cursor over 512 chars", () => {
    const result = getCursorPagination(mockReq({ cursor: "a".repeat(513) }));
    expect(result.cursor).toBeNull();
  });

  it("clamps limit", () => {
    const result = getCursorPagination(mockReq({ limit: "999" }));
    expect(result.limit).toBe(PAGINATION.MAX_LIMIT);
  });
});

// ── encodeCursor / decodeCursor ────────────────────────────

describe("encodeCursor / decodeCursor", () => {
  it("round trips correctly", () => {
    const data    = { id: 42, ts: 1234567890 };
    const encoded = encodeCursor(data);
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual(data);
  });

  it("returns null for invalid base64", () => {
    expect(decodeCursor("!!!")).toBeNull();
  });

  it("returns null for non-object JSON", () => {
    const encoded = Buffer.from(JSON.stringify([1, 2, 3])).toString("base64url");
    expect(decodeCursor(encoded)).toBeNull();
  });

  it("returns null for null JSON", () => {
    const encoded = Buffer.from("null").toString("base64url");
    expect(decodeCursor(encoded)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    const encoded = Buffer.from("{bad json}").toString("base64url");
    expect(decodeCursor(encoded)).toBeNull();
  });
});

// ── buildCursorResponse ────────────────────────────────────

describe("buildCursorResponse", () => {
  const params         = { limit: 3, cursor: null };
  const getCursorValue = (item: { id: number }) => ({ id: item.id });

  it("returns data and no next cursor when under limit", () => {
    const data   = [{ id: 1 }, { id: 2 }];
    const result = buildCursorResponse(data, params, getCursorValue);
    expect(result.data).toHaveLength(2);
    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.nextCursor).toBeNull();
    expect(result.pagination.hasPrev).toBe(false);
  });

  it("returns next cursor when data length > limit", () => {
    const data   = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const result = buildCursorResponse(data, params, getCursorValue);
    expect(result.data).toHaveLength(3);
    expect(result.pagination.hasNext).toBe(true);
    expect(result.pagination.nextCursor).not.toBeNull();
  });

  it("hasPrev true when cursor provided", () => {
    const p      = { limit: 3, cursor: "somecursor" };
    const data   = [{ id: 1 }];
    const result = buildCursorResponse(data, p, getCursorValue);
    expect(result.pagination.hasPrev).toBe(true);
  });

  it("handles empty data", () => {
    const result = buildCursorResponse([], params, getCursorValue);
    expect(result.data).toHaveLength(0);
    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.nextCursor).toBeNull();
  });
});

// ── SQL helpers ────────────────────────────────────────────

describe("toOrderByClause", () => {
  it("generates correct ORDER BY clause", () => {
    expect(toOrderByClause({ field: "created_at", direction: "DESC" }))
      .toBe("ORDER BY created_at DESC");
  });

  it("sanitizes field name — strips non-alphanumeric chars except underscore", () => {
    // "user; DROP TABLE" → strip [^a-z0-9_] → "userDROPTABLE"
    // This is MORE secure than the old test expected ("user DROP TABLE")
    // Spaces and semicolons are stripped — SQL injection impossible
    expect(toOrderByClause({ field: "user; DROP TABLE", direction: "ASC" }))
      .toBe("ORDER BY userDROPTABLE ASC");
  });

  it("only allows ASC or DESC direction", () => {
    expect(toOrderByClause({ field: "level", direction: "ASC" }))
      .toBe("ORDER BY level ASC");
  });

  it("strips all SQL-dangerous characters", () => {
    const result = toOrderByClause({ field: "level'; --", direction: "DESC" });
    // Single quotes, semicolons, dashes all stripped
    expect(result).not.toContain("'");
    expect(result).not.toContain(";");
    expect(result).not.toContain("--");
    expect(result).toMatch(/^ORDER BY [a-z0-9_]+ (ASC|DESC)$/);
  });
});

describe("toLimitOffsetClause", () => {
  it("generates correct LIMIT OFFSET clause", () => {
    const result = toLimitOffsetClause({ page: 2, limit: 10, offset: 10 });
    expect(result.clause).toBe("LIMIT $1 OFFSET $2");
    expect(result.values).toEqual([10, 10]);
  });
});
