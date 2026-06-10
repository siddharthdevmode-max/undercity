// ============================================================
// PAGINATION UTILITY — UNDERCITY
// Two strategies: OFFSET (admin/search) and CURSOR (feeds/chat)
// ============================================================

import { Request } from "express";

export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT:     100,
  MAX_PAGE:      1_000,
  MIN_LIMIT:     1,
} as const;

export interface PaginationParams {
  page:   number;
  limit:  number;
  offset: number;
}

export interface SortParams {
  field:     string;
  direction: "ASC" | "DESC";
}

export interface PaginatedResponse<T> {
  data:       T[];
  pagination: {
    page:       number;
    limit:      number;
    total:      number;
    totalPages: number;
    hasNext:    boolean;
    hasPrev:    boolean;
  };
}

export interface CursorPaginationParams {
  limit:  number;
  cursor: string | null;
}

export interface CursorPaginatedResponse<T> {
  data:       T[];
  pagination: {
    limit:      number;
    nextCursor: string | null;
    hasPrev:    boolean;
    hasNext:    boolean;
  };
}

// BUG FIX: handle array query params — take first element only
function extractString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

function safeInt(
  value:    unknown,
  fallback: number,
  min:      number,
  max:      number
): number {
  const n = parseInt(extractString(value) || String(fallback), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function getPagination(req: Request): PaginationParams {
  const page   = safeInt(req.query["page"],  1,                        1,                   PAGINATION.MAX_PAGE);
  const limit  = safeInt(req.query["limit"], PAGINATION.DEFAULT_LIMIT, PAGINATION.MIN_LIMIT, PAGINATION.MAX_LIMIT);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function buildPaginatedResponse<T>(
  data:   T[],
  total:  number,
  params: PaginationParams
): PaginatedResponse<T> {
  const totalPages = total > 0 ? Math.ceil(total / params.limit) : 0;
  return {
    data,
    pagination: {
      page:       params.page,
      limit:      params.limit,
      total,
      totalPages,
      hasNext:    params.page < totalPages,
      hasPrev:    params.page > 1,
    },
  };
}

export function getSort(
  req:           Request,
  allowedFields: readonly string[],
  defaultField:  string          = "created_at",
  defaultDir:    "ASC" | "DESC" = "DESC"
): SortParams {
  const rawField = extractString(req.query["sort"]).toLowerCase() || defaultField;
  const rawDir   = extractString(req.query["order"]).toUpperCase() || defaultDir;

  const field     = allowedFields.includes(rawField) ? rawField : defaultField;
  const direction = rawDir === "ASC" ? "ASC" : "DESC";
  return { field, direction };
}

export function getCursorPagination(req: Request): CursorPaginationParams {
  const limit     = safeInt(req.query["limit"], PAGINATION.DEFAULT_LIMIT, PAGINATION.MIN_LIMIT, PAGINATION.MAX_LIMIT);
  const rawCursor = extractString(req.query["cursor"]);

  let cursor: string | null = null;
  if (rawCursor.length > 0 && rawCursor.length <= 512 && /^[A-Za-z0-9+/=_-]+$/.test(rawCursor)) {
    cursor = rawCursor;
  }

  return { limit, cursor };
}

export function encodeCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeCursor(cursor: string): Record<string, unknown> | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    const parsed  = JSON.parse(decoded) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function buildCursorResponse<T>(
  data:           T[],
  params:         CursorPaginationParams,
  getCursorValue: (item: T) => Record<string, unknown>
): CursorPaginatedResponse<T> {
  const hasNext  = data.length > params.limit;
  const pageData = hasNext ? data.slice(0, params.limit) : data;
  const lastItem = pageData.at(-1);
  const nextCursor = hasNext && lastItem ? encodeCursor(getCursorValue(lastItem)) : null;

  return {
    data: pageData,
    pagination: {
      limit:      params.limit,
      nextCursor,
      hasPrev:    params.cursor !== null,
      hasNext,
    },
  };
}

export function toOrderByClause(sort: SortParams): string {
  const safeField = sort.field.replace(/[^a-z0-9_]/gi, "");
  const safeDir   = sort.direction === "ASC" ? "ASC" : "DESC";
  return `ORDER BY ${safeField} ${safeDir}`;
}

export function toLimitOffsetClause(params: PaginationParams): {
  clause: string;
  values: [number, number];
} {
  return {
    clause: "LIMIT $1 OFFSET $2",
    values: [params.limit, params.offset],
  };
}
