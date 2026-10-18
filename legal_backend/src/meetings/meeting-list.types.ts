import type { MeetingResponse } from './meetings.service';

export interface MeetingListFilters {
  matterId?: string;
  clientId?: string;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface MeetingListPage {
  items: MeetingResponse[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
