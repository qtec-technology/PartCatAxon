// ─── Standard API Response ───────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: PaginationMeta;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginationMeta {
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}
