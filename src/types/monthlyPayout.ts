export type MonthlyPayoutStatus = 'paid' | 'pending';

/** Replace mock list with API response when endpoint is ready. */
export type MonthlyPayoutItem = {
  id: string;
  monthLabel: string;
  amount: number;
  status: MonthlyPayoutStatus;
  downloadUrl?: string | null;
};
