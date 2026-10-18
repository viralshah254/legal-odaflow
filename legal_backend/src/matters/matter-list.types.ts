export interface MatterListFilters {
  status?: string;
  assignee?: string;
  stage?: string;
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface MatterListPage {
  items: unknown[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
