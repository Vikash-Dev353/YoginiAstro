import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { apiClient } from '../services/api/client';
import { API_ROUTES } from '../services/api/routes';
import {
  extractMonthlyReportDownloadUrl,
  type GetMonthlyReportsResponse,
} from './monthlyPayoutMapper';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function pickBase64Pdf(response: GetMonthlyReportsResponse): string | null {
  const root = asRecord(response);
  if (!root) {
    return null;
  }
  const candidates: unknown[] = [
    root.pdf,
    root.base64,
    root.file,
    root.report,
    asRecord(root.data)?.pdf,
    asRecord(root.data)?.base64,
    asRecord(root.data)?.file,
    asRecord(root.data)?.report,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 32) {
      return candidate.replace(/^data:application\/pdf;base64,/, '').trim();
    }
  }
  return null;
}

function buildInvoiceReportUrl(
  astroId: string,
  month: number,
  year: number,
): string {
  const base = `${apiClient.defaults.baseURL ?? ''}`.replace(/\/$/, '');
  const path = API_ROUTES.auth.getAstrologerReport(astroId.trim().toUpperCase());
  return `${base}${path}?month=${month}&year=${year}`;
}

async function openLocalPdf(path: string): Promise<void> {
  if (Platform.OS === 'android') {
    await ReactNativeBlobUtil.android.actionViewIntent(path, 'application/pdf');
    return;
  }
  await ReactNativeBlobUtil.ios.openDocument(path);
}

async function downloadRemotePdf(
  url: string,
  token: string,
  fileName: string,
): Promise<void> {
  const normalizedUrl = url.startsWith('http://') && /yoginiastro\.com/i.test(url)
    ? url.replace(/^http:\/\//i, 'https://')
    : url;
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;
  const response = await ReactNativeBlobUtil.config({
    path,
    fileCache: true,
    appendExt: 'pdf',
  }).fetch('GET', normalizedUrl, {
    Authorization: `Bearer ${token}`,
  });
  await openLocalPdf(response.path());
}

async function saveBase64Pdf(base64: string, fileName: string): Promise<void> {
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;
  await ReactNativeBlobUtil.fs.writeFile(path, base64, 'base64');
  await openLocalPdf(path);
}

async function downloadInvoicePdfDirect(
  astroId: string,
  month: number,
  year: number,
  token: string,
  fileName: string,
): Promise<void> {
  const url = buildInvoiceReportUrl(astroId, month, year);
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;
  const response = await ReactNativeBlobUtil.config({
    path,
    fileCache: true,
    appendExt: 'pdf',
  }).fetch('GET', url, {
    Authorization: `Bearer ${token}`,
  });

  const contentType = `${response.info().headers['Content-Type'] ?? response.info().headers['content-type'] ?? ''}`.toLowerCase();

  if (contentType.includes('application/json')) {
    const text = await ReactNativeBlobUtil.fs.readFile(response.path(), 'utf8');
    const json = JSON.parse(text) as GetMonthlyReportsResponse;
    const remoteUrl = extractMonthlyReportDownloadUrl(json);
    if (remoteUrl) {
      await downloadRemotePdf(remoteUrl, token, fileName);
      return;
    }
    const base64 = pickBase64Pdf(json);
    if (base64) {
      await saveBase64Pdf(base64, fileName);
      return;
    }
    throw new Error('Report file not available in API response.');
  }

  await openLocalPdf(response.path());
}

/** Fetches invoice report for a month/year and opens the PDF on device. */
export async function downloadAstrologerMonthlyReport(options: {
  astroId: string;
  month: number;
  year: number;
  token: string;
}): Promise<void> {
  const { astroId, month, year, token } = options;
  const fileName = `payout-${astroId}-${year}-${String(month).padStart(2, '0')}.pdf`;

  try {
    const json = await apiClient
      .get<GetMonthlyReportsResponse>(
        API_ROUTES.auth.getAstrologerReport(astroId.trim().toUpperCase()),
        { params: { month, year } },
      )
      .then(response => response.data);

    const remoteUrl = extractMonthlyReportDownloadUrl(json);
    if (remoteUrl) {
      await downloadRemotePdf(remoteUrl, token, fileName);
      return;
    }

    const base64 = pickBase64Pdf(json);
    if (base64) {
      await saveBase64Pdf(base64, fileName);
      return;
    }
  } catch {
    /* Fall through — endpoint may return raw PDF instead of JSON. */
  }

  await downloadInvoicePdfDirect(astroId, month, year, token, fileName);
}
