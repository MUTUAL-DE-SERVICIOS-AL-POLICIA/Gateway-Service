export interface SalesListData {
  sales: SalesListItem[];
  totalItems: number;
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  } | null;
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
  };
  metadata?: {
    source?: string;
    generatedFor?: string;
    generatedAt?: string;
    generatedBy?: string;
  };
}

export interface SalesListItem {
  code: string | null;
  receptionDate: string | Date | null;
  principalCustomer: string;
  service: string;
  amount: number;
  price: string;
  paymentType: string;
  total: string;
  receptionist: string;
}
