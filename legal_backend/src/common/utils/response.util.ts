export interface PaginationMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  cursor?: string;
  hasMore?: boolean;
}

export function ok<T>(
  data: T,
  meta?: { requestId?: string; pagination?: PaginationMeta },
): { data: T; meta: { requestId?: string; pagination?: PaginationMeta } } {
  return { data, meta: meta ?? {} };
}

export function paginated<T>(
  data: T[],
  pagination: PaginationMeta,
  requestId?: string,
): { data: T[]; meta: { requestId?: string; pagination: PaginationMeta } } {
  return { data, meta: { requestId, pagination } };
}
