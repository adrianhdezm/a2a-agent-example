export type SortDirection = 'ASC' | 'DESC';

/** One page of a list, sorted: what every list read takes. */
export interface ListParams<SortField extends string> {
  page: number;
  pageSize: number;
  sortField: SortField;
  sortDirection: SortDirection;
}

/** The REST API list envelope. */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
