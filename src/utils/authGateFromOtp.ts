import type { AuthGateSnapshot } from './storage';

/** Maps OTP verify `approvalStatus` (+ flow) to profile / main-app gates. */
export function resolveAuthGateAfterOtpVerify(options: {
  flow: 'login' | 'register';
  isNewAstrologer?: boolean;
  approvalStatus?: string;
}): AuthGateSnapshot {
  const status = options.approvalStatus?.trim().toLowerCase() ?? '';
  const isRegisterFlow =
    options.flow === 'register' || Boolean(options.isNewAstrologer);
  const isApproved =
    status === 'approved' ||
    (status.includes('approved') && !status.includes('pending')) ||
    status === 'active' ||
    status === 'verified';
  const isPending =
    status.includes('pending') || status.includes('await');

  if (isApproved) {
    return {
      pendingProfileCompletion: false,
      pendingAdminApproval: false,
    };
  }

  /** New registration + pending: fill Complete Profile first, then admin approval. */
  if (isPending && isRegisterFlow) {
    return {
      pendingProfileCompletion: true,
      pendingAdminApproval: false,
    };
  }

  /** Returning login while admin approval still pending. */
  if (isPending) {
    return {
      pendingProfileCompletion: false,
      pendingAdminApproval: true,
    };
  }

  if (isRegisterFlow) {
    return {
      pendingProfileCompletion: true,
      pendingAdminApproval: false,
    };
  }

  return {
    pendingProfileCompletion: false,
    pendingAdminApproval: false,
  };
}
