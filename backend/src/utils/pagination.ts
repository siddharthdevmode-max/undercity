import { Request } from "express";

// ============================================================
// PAGINATION UTILITY
// Consistent pagination across all list endpoints
// Usage: const { limit, offset, page } = getPagination(req);
// ============================================================

export interface PaginationParams {
  page:   number;
  limit:  number;
  offset: number;
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

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;

export function getPagination(req: Request): PaginationParams {
  const page  = Math.max(1, parseInt(String(req.query.page  ?? "1"),  10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(String(req.query.limit ?? String(DEFAULT_LIMIT)), 10) || DEFAULT_LIMIT)
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

export function buildPaginatedResponse<T>(
  data:    T[],
  total:   number,
  params:  PaginationParams
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.limit);

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
