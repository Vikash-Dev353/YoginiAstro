export type MonthlyPayoutStatus = 'paid' | 'pending';

export type MonthlyPayoutItem = {
  id: string;
  monthLabel: string;
  amount: number;
  status: MonthlyPayoutStatus;
  downloadUrl?: string | null;
  month?: number;
  year?: number;
};
