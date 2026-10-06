import { API_BASE_URL } from '../config/api';
import { session } from './session';

export class ApiError extends Error {
  status?: number;
  /** Machine-readable business error code (e.g. SITE_CAPACITY_REACHED). */
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: object | FormData;
  authenticated?: boolean;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, authenticated = false } = options;
  const token = authenticated ? await session.getToken() : null;
  const isFormData = body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: isFormData ? body : JSON.stringify(body) } : {}),
    });
  } catch {
    // React Native rejects with a bare TypeError ("Network request failed") for
    // any transport-level failure — the request may or may not have been
    // processed by the server. Normalise it into an ApiError with a stable
    // code so screens can show one meaningful message (and reconcile state
    // with a read-only status call before reporting failure).
    throw new ApiError(
      'Unable to connect to the server. Please check your connection and try again.',
      undefined,
      'NETWORK_ERROR',
    );
  }
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      payload.error ||
        payload.message ||
        'Something went wrong. Please try again.',
      response.status,
      typeof payload.code === 'string' ? payload.code : undefined,
    );
  }
  return payload as T;
}
