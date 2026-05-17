import type { MonthlyPayoutItem } from '../types/monthlyPayout';

/** Placeholder until monthly payout API is wired. */
export const MOCK_MONTHLY_PAYOUTS: MonthlyPayoutItem[] = [
  {
    id: '2026-01',
    monthLabel: 'January 2026',
    amount: 5044.35,
    status: 'paid',
    downloadUrl: null,
  },
  {
    id: '2025-12',
    monthLabel: 'December 2025',
    amount: 5044.35,
    status: 'pending',
    downloadUrl: null,
  },
  {
    id: '2025-11',
    monthLabel: 'November 2025',
    amount: 5044.35,
    status: 'pending',
    downloadUrl: null,
  },
  {
    id: '2025-10',
    monthLabel: 'October 2025',
    amount: 5044.35,
    status: 'pending',
    downloadUrl: null,
  },
  {
    id: '2025-09',
    monthLabel: 'September 2025',
    amount: 5044.35,
    status: 'paid',
    downloadUrl: null,
  },
];
