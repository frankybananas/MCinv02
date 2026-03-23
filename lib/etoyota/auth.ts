import axios, { AxiosError } from 'axios';
import type { EToyotaAuthResponse, EToyotaSession } from './types';

let cachedSession: EToyotaSession | null = null;

const AUTH_PATHS = ['/connect/token', '/token', '/auth/login'];

function getBaseUrl(): string {
  const url = process.env.ETOYOTA_BASE_URL;
  if (!url) throw new Error('ETOYOTA_BASE_URL environment variable is not set');
  return url.replace(/\/$/, '');
}

function getCredentials(): { username: string; password: string } {
  const username = process.env.ETOYOTA_USERNAME;
  const password = process.env.ETOYOTA_PASSWORD;
  if (!username) throw new Error('ETOYOTA_USERNAME environment variable is not set');
  if (!password) throw new Error('ETOYOTA_PASSWORD environment variable is not set');
  return { username, password };
}

function isSessionValid(session: EToyotaSession): boolean {
  return Date.now() < session.expiresAt - 60_000;
}

function extractCookies(setCookieHeaders: string | string[] | undefined): string {
  if (!setCookieHeaders) return '';
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  return headers
    .map((h) => h.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

async function tryAuthenticate(
  baseUrl: string,
  username: string,
  password: string
): Promise<EToyotaSession> {
  const lastError: Error[] = [];

  for (const path of AUTH_PATHS) {
    try {
      const url = `${baseUrl}${path}`;

      const formData = new URLSearchParams();
      formData.append('grant_type', 'password');
      formData.append('username', username);
      formData.append('password', password);
      formData.append('scope', 'openid profile email offline_access');

      const response = await axios.post<EToyotaAuthResponse>(url, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        timeout: 15_000,
        maxRedirects: 5,
      });

      const { access_token, expires_in } = response.data;
      if (!access_token) throw new Error('No access_token in response');

      const cookies = extractCookies(
        response.headers['set-cookie'] as string | string[] | undefined
      );

      const session: EToyotaSession = {
        accessToken: access_token,
        expiresAt: Date.now() + (expires_in ?? 3600) * 1000,
        cookies,
      };

      cachedSession = session;
      return session;
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      const message = axiosErr.message ?? String(err);
      lastError.push(new Error(`${path} → ${status ?? 'no response'}: ${message}`));
    }
  }

  throw new Error(
    `e-Toyota authentication failed on all paths:\n${lastError.map((e) => e.message).join('\n')}`
  );
}

export async function getSession(forceRefresh = false): Promise<EToyotaSession> {
  if (!forceRefresh && cachedSession && isSessionValid(cachedSession)) {
    return cachedSession;
  }

  const baseUrl = getBaseUrl();
  const { username, password } = getCredentials();
  return tryAuthenticate(baseUrl, username, password);
}

export function clearSession(): void {
  cachedSession = null;
}

export { getBaseUrl };
