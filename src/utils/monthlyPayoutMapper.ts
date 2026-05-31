import type {
  MonthlyPayoutItem,
  MonthlyPayoutStatus,
} from '../types/monthlyPayout';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type MonthlyReportApiItem = Record<string, unknown>;

export type GetMonthlyReportsResponse = {
  status?: string;
  message?: string;
  reports?: MonthlyReportApiItem[];
  monthlyReports?: MonthlyReportApiItem[];
  payouts?: MonthlyReportApiItem[];
  data?: MonthlyReportApiItem[] | MonthlyReportApiItem | Record<string, unknown>;
  report?: MonthlyReportApiItem;
  [key: string]: unknown;
};

function asRecord(value: unknown): MonthlyReportApiItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as MonthlyReportApiItem;
}

function pickString(record: MonthlyReportApiItem, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function pickNumber(record: MonthlyReportApiItem, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value.replace(/[₹,\s]/g, ''));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function pickMonthYear(record: MonthlyReportApiItem): {
  month: number | null;
  year: number | null;
} {
  const month =
    pickNumber(record, ['month', 'reportMonth', 'payoutMonth']) ??
    (() => {
      const label = pickString(record, ['monthLabel', 'monthName', 'label']);
      if (!label) return null;
      const idx = MONTH_NAMES.findIndex(
        name => label.toLowerCase().includes(name.toLowerCase()),
      );
      return idx >= 0 ? idx + 1 : null;
    })();
  const year =
    pickNumber(record, ['year', 'reportYear', 'payoutYear']) ??
    (() => {
      const label = pickString(record, ['monthLabel', 'monthName', 'label']);
      if (!label) return null;
      const match = label.match(/\b(20\d{2})\b/);
      return match ? Number(match[1]) : null;
    })();
  return { month, year };
}

function toMonthLabel(month: number | null, year: number | null): string {
  if (month != null && month >= 1 && month <= 12 && year != null) {
    return `${MONTH_NAMES[month - 1]} ${year}`;
  }
  return '—';
}

function toStatus(record: MonthlyReportApiItem): MonthlyPayoutStatus {
  const raw = `${pickString(record, [
    'status',
    'paymentStatus',
    'payoutStatus',
    'payStatus',
  ]) ?? ''}`.toLowerCase();
  if (
    raw.includes('paid') ||
    raw.includes('complete') ||
    raw.includes('success') ||
    record.isPaid === true ||
    record.paid === true
  ) {
    return 'paid';
  }
  return 'pending';
}

function extractDownloadUrl(record: MonthlyReportApiItem): string | null {
  return pickString(record, [
    'downloadUrl',
    'reportUrl',
    'pdfUrl',
    'documentUrl',
    'fileUrl',
    'url',
    'payslipUrl',
    'payoutUrl',
    'invoiceUrl',
    'reportLink',
    'filePath',
  ]);
}

function mapReportItem(
  record: MonthlyReportApiItem,
  index: number,
): MonthlyPayoutItem | null {
  const { month, year } = pickMonthYear(record);
  const amount =
    pickNumber(record, [
      'amount',
      'payoutAmount',
      'totalAmount',
      'netAmount',
      'finalAmount',
      'finalPayable',
      'finalPayableToAstrologer',
    ]) ??
    pickNumber(asRecord(record.calculation) ?? {}, [
      'finalPayableToAstrologer',
      'finalPayable',
    ]);

  if (amount == null && month == null && year == null) {
    return null;
  }

  const id =
    pickString(record, ['id', '_id', 'reportId']) ??
    (month != null && year != null ? `${year}-${String(month).padStart(2, '0')}` : `report-${index}`);

  return {
    id,
    monthLabel:
      pickString(record, ['monthLabel', 'monthName', 'label']) ??
      toMonthLabel(month, year),
    amount: amount ?? 0,
    status: toStatus(record),
    downloadUrl: extractDownloadUrl(record),
    month: month ?? undefined,
    year: year ?? undefined,
  };
}

function extractReportArray(
  response: GetMonthlyReportsResponse,
): MonthlyReportApiItem[] {
  const candidates: unknown[] = [
    response.reports,
    response.monthlyReports,
    response.payouts,
    Array.isArray(response.data) ? response.data : null,
    (asRecord(response.data) ?? null)?.reports,
    (asRecord(response.data) ?? null)?.monthlyReports,
    (asRecord(response.data) ?? null)?.payouts,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate
        .map(item => asRecord(item))
        .filter((item): item is MonthlyReportApiItem => item != null);
    }
  }

  const single =
    asRecord(response.report) ??
    (Array.isArray(response) ? null : asRecord(response));
  if (single && (single.month != null || single.year != null || single.amount != null)) {
    return [single];
  }

  return [];
}

export function mapMonthlyReportsResponse(
  response: GetMonthlyReportsResponse,
): MonthlyPayoutItem[] {
  const items = extractReportArray(response)
    .map((record, index) => mapReportItem(record, index))
    .filter((item): item is MonthlyPayoutItem => item != null);

  return items.sort((a, b) => {
    const aKey = (a.year ?? 0) * 100 + (a.month ?? 0);
    const bKey = (b.year ?? 0) * 100 + (b.month ?? 0);
    return bKey - aKey;
  });
}

export function extractMonthlyReportDownloadUrl(
  response: GetMonthlyReportsResponse,
): string | null {
  const fromList = mapMonthlyReportsResponse(response)[0]?.downloadUrl;
  if (fromList?.trim()) {
    return fromList.trim();
  }

  const root = asRecord(response);
  if (!root) {
    return null;
  }

  return extractDownloadUrl(root);
}
