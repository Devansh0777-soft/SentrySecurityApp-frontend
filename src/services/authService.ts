import { apiRequest } from './apiClient';
import { session, type StoredUser } from './session';
import { registrationDraft, type RegistrationDraft } from './registrationDraft';

type AuthUser = {
  id: number;
  full_name?: string;
  email?: string;
  mobile_number?: string;
  account_type: string;
};

type AuthResponse = {
  message?: string;
  token?: string;
  approval_status?: 'pending' | 'approved';
  admin?: AuthUser;
  user?: AuthUser;
};

const formatPhoneNumber = (mobile: string) =>
  `+91${mobile.replace(/\D/g, '').slice(-10)}`;

/** Extract the authenticated user from either response shape (admin | user). */
const pickUser = (response: AuthResponse): AuthUser | null =>
  response.user ?? response.admin ?? null;

/**
 * Persist the token together with the minimal, non-sensitive user profile so
 * the session can be restored after the app is closed, swiped away, or the
 * device is rebooted. Never stores passwords.
 */
const persistSession = async (response: AuthResponse) => {
  const user = pickUser(response);
  if (response.token && user) {
    await session.setAuth(response.token, user as StoredUser);
  }
};

export const authService = {
  async login(identifier: string, password: string) {
    const email = identifier.trim().toLowerCase();
    const response = await apiRequest<AuthResponse>('/login', {
      method: 'POST',
      // The current unified API authenticates both roles with an email address.
      body: { email, password },
    });
    if (!response.token)
      throw new Error(response.message || 'Login could not be completed.');
    await persistSession(response);
    return response;
  },
  startRegistration: async (
    payload: Omit<RegistrationDraft, 'profile' | 'origin'>,
    origin: RegistrationDraft['origin'] = 'self',
  ) => {
    registrationDraft.setAccount(payload, origin);
  },
  // Temporary development bypass: no SMS is sent until Firebase OTP is enabled.
  async sendMobileOtp(_mobile: string) {
    return undefined;
  },
  async verifyMobileOtp(mobile: string, code: string) {
    const draft = registrationDraft.get();
    if (!draft?.profile) {
      throw new Error(
        'Your registration details are missing. Please start again.',
      );
    }
    const { origin, ...registration } = draft;
    const response = await apiRequest<AuthResponse>('/complete-registration', {
      method: 'POST',
      body: {
        ...registration,
        otp: code,
        mobile_number: formatPhoneNumber(mobile),
      },
    });
    if (origin !== 'superAdmin') {
      if (response.token && response.approval_status !== 'pending')
        await persistSession(response);
      else await session.clearAuth();
    }
    registrationDraft.clear();
    return { ...response, returnToSuperAdmin: origin === 'superAdmin' };
  },
  /**
   * Manual logout. The backend currently has no token-revocation endpoint (JWT
   * based, stateless), so we clear all persisted auth data locally and reset
   * state. The token simply expires naturally on the server.
   */
  async logout() {
    await session.clearAuth();
  },
  async requestPasswordReset(identifier: string) {
    await session.setPendingIdentifier(identifier);
    return apiRequest('/forgot-password', {
      method: 'POST',
      body: { identifier },
    });
  },
  verifyForgotPasswordOtp: (identifier: string, otp: string) =>
    apiRequest('/verify-forgot-password-otp', {
      method: 'POST',
      body: { identifier, otp },
    }),
  resetPassword: (
    identifier: string,
    new_password: string,
    confirm_password: string,
  ) =>
    apiRequest('/reset-password', {
      method: 'POST',
      body: { identifier, new_password, confirm_password },
    }),
};

