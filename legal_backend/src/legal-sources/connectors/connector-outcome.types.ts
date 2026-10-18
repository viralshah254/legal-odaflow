/** Structured outcome from a live legal-source connector search. */
export type ConnectorSearchStatus =
  | 'not_configured'
  | 'searched'
  | 'no_hits'
  | 'timeout'
  | 'rate_limited'
  | 'unauthorized'
  | 'circuit_open'
  | 'error';

export interface ConnectorSearchOutcome<T> {
  status: ConnectorSearchStatus;
  results: T[];
  /** Raw hit count before relevance filtering. */
  hitCount: number;
  errorMessage?: string;
  httpStatus?: number;
  fromCache?: boolean;
}

export function emptyConnectorOutcome<T>(
  status: ConnectorSearchStatus,
  errorMessage?: string,
): ConnectorSearchOutcome<T> {
  return { status, results: [], hitCount: 0, errorMessage };
}
