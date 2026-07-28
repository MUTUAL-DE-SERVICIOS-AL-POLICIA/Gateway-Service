export interface SalesReceiptData {
  sale: {
    code: string | null;
    state: string;
    personId: number;
    receptionist: string;
    createdAt: string | Date;
  };
  principalCustomer: {
    fullName: string;
    identityCard: string;
  };
  payer: {
    customer: string | null;
    identityCardCustomer: string | null;
    isThirdParty: boolean;
  };
  voucher: {
    receiptNumber: string | null;
    fileNumber: string | null;
    description: string | null;
    paymentTypeState: string;
    depositDate: string | Date | null;
    paymentLocation: string | null;
    createdAt: string | Date;
    total: string;
  };
  payment: {
    type: {
      name: string;
      shortened: string;
    } | null;
  };
  currency: {
    symbol: string | null;
  };
  products: SaleProducts[];
  totals: {
    productCount: number;
    quantity: number;
    amount: string;
  };
  metadata?: {
    source?: string;
    generatedFor?: string;
    generatedAt?: string;
  };
}

export interface SaleProducts {
  name: string;
  amount: number;
  price: string;
  total: string;
}
