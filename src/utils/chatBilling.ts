/** Parse balance/price from numbers, strings, or nested API shapes. */
export function coerceBillingNumber(raw: unknown): number | undefined {
  if (raw == null || raw === '') {
    return undefined;
  }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? raw : undefined;
  }
  if (typeof raw === 'string') {
    const n = Number(raw.trim());
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return (
      coerceBillingNumber(o.balance) ??
      coerceBillingNumber(o.userBalance) ??
      coerceBillingNumber(o.totalAvailable) ??
      coerceBillingNumber(o.amount) ??
      coerceBillingNumber(o.price) ??
      coerceBillingNumber(o.astroPrice) ??
      coerceBillingNumber(o.pricePerMinute)
    );
  }
  return undefined;
}

export function computeChatRemainingSeconds(
  balance: number | undefined,
  pricePerMinute: number | undefined,
): number {
  if (balance == null || pricePerMinute == null || pricePerMinute <= 0) {
    return 0;
  }
  return Math.max(0, Math.floor((balance / pricePerMinute) * 60));
}
