import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Auth: accept CRON_SECRET or skip in dev
  const authHeader = request.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: 'Unauthorized — use Bearer CRON_SECRET' }, { status: 401 });
  }

  const baseUrl = (process.env.ETOYOTA_BASE_URL ?? '').replace(/\/$/, '');
  const username = process.env.ETOYOTA_USERNAME ?? '';
  const password = process.env.ETOYOTA_PASSWORD ?? '';
  const dealershipId = process.env.ETOYOTA_DEALERSHIP_ID ?? '113';

  const results: Record<string, unknown> = {};

  // Step 1: env vars
  results.envVars = {
    ETOYOTA_BASE_URL: baseUrl || 'MISSING',
    ETOYOTA_USERNAME: username ? `${username.substring(0, 3)}***` : 'MISSING',
    ETOYOTA_PASSWORD: password ? `${password.length} chars` : 'MISSING',
    ETOYOTA_DEALERSHIP_ID: dealershipId,
  };

  if (!baseUrl || !username || !password) {
    return NextResponse.json({ results, error: 'Missing env vars' });
  }

  // Step 2: Probe base URL
  try {
    const r = await axios.get(baseUrl, { timeout: 15000, maxRedirects: 5, validateStatus: () => true });
    results.baseUrlProbe = {
      status: r.status,
      contentType: r.headers['content-type'],
      bodySnippet: String(r.data).substring(0, 500),
      setCookie: r.headers['set-cookie'] ? 'YES' : 'NO',
      location: r.headers['location'] ?? null,
    };
  } catch (err) {
    results.baseUrlProbe = { error: (err as Error).message };
  }

  // Step 3: Try many auth strategies
  const authProbes: Record<string, unknown> = {};

  // 3a: OAuth form-urlencoded on various paths
  const oauthPaths = ['/connect/token', '/token', '/oauth/token', '/api/token', '/api/auth/token', '/auth/login', '/api/login', '/api/v1/login', '/api/v1/auth/token', '/Account/Login'];
  for (const path of oauthPaths) {
    const key = `POST_form_${path}`;
    try {
      const form = new URLSearchParams();
      form.append('grant_type', 'password');
      form.append('username', username);
      form.append('password', password);
      const r = await axios.post(`${baseUrl}${path}`, form.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        timeout: 10000,
        validateStatus: () => true,
        maxRedirects: 0,
      });
      authProbes[key] = {
        status: r.status,
        contentType: r.headers['content-type'],
        bodySnippet: String(r.data).substring(0, 300),
        hasAccessToken: String(r.data).includes('access_token'),
      };
    } catch (err) {
      authProbes[key] = { error: (err as Error).message };
    }
  }

  // 3b: JSON login on various paths
  const jsonPaths = ['/api/login', '/api/auth/login', '/api/v1/login', '/auth/login', '/login', '/api/authenticate', '/api/v1/authenticate'];
  for (const path of jsonPaths) {
    const key = `POST_json_${path}`;
    try {
      const r = await axios.post(`${baseUrl}${path}`, { username, password }, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 10000,
        validateStatus: () => true,
        maxRedirects: 0,
      });
      authProbes[key] = {
        status: r.status,
        contentType: r.headers['content-type'],
        bodySnippet: String(r.data).substring(0, 300),
        hasAccessToken: String(r.data).includes('access_token'),
        setCookie: r.headers['set-cookie'] ? String(r.headers['set-cookie']).substring(0, 200) : null,
      };
    } catch (err) {
      authProbes[key] = { error: (err as Error).message };
    }
  }

  // 3c: JSON login with email field
  for (const path of ['/api/login', '/api/auth/login', '/login']) {
    const key = `POST_json_email_${path}`;
    try {
      const r = await axios.post(`${baseUrl}${path}`, { email: username, password }, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 10000,
        validateStatus: () => true,
        maxRedirects: 0,
      });
      authProbes[key] = {
        status: r.status,
        contentType: r.headers['content-type'],
        bodySnippet: String(r.data).substring(0, 300),
      };
    } catch (err) {
      authProbes[key] = { error: (err as Error).message };
    }
  }

  // 3d: Basic Auth on stock endpoint directly
  const basicAuthToken = Buffer.from(`${username}:${password}`).toString('base64');
  try {
    const r = await axios.get(`${baseUrl}/VehicleStock?DealershipId=${dealershipId}&IsNew=0`, {
      headers: { Authorization: `Basic ${basicAuthToken}`, Accept: 'application/json' },
      timeout: 10000,
      validateStatus: () => true,
    });
    authProbes['GET_basic_auth_/VehicleStock'] = {
      status: r.status,
      contentType: r.headers['content-type'],
      bodySnippet: String(r.data).substring(0, 300),
      isArray: Array.isArray(r.data),
    };
  } catch (err) {
    authProbes['GET_basic_auth_/VehicleStock'] = { error: (err as Error).message };
  }

  // 3e: Try GET on various stock-like endpoints without auth to see what we get
  const stockPaths = ['/VehicleStock', '/api/VehicleStock', '/api/v1/VehicleStock', '/api/vehicles', '/api/stock', '/api/v1/stock'];
  for (const path of stockPaths) {
    const key = `GET_noauth_${path}`;
    try {
      const r = await axios.get(`${baseUrl}${path}?DealershipId=${dealershipId}&IsNew=0`, {
        headers: { Accept: 'application/json' },
        timeout: 10000,
        validateStatus: () => true,
      });
      authProbes[key] = {
        status: r.status,
        contentType: r.headers['content-type'],
        bodySnippet: String(r.data).substring(0, 200),
      };
    } catch (err) {
      authProbes[key] = { error: (err as Error).message };
    }
  }

  results.authProbes = authProbes;

  // Summarize: find any successful auth
  const successfulAuths = Object.entries(authProbes).filter(
    ([, v]) => {
      const val = v as any;
      return val.status === 200 || val.hasAccessToken;
    }
  );
  results.summary = successfulAuths.length > 0
    ? { found: true, methods: successfulAuths.map(([k, v]) => ({ key: k, ...(v as object) })) }
    : { found: false, message: 'No successful auth method found. Check probe results for clues.' };

  return NextResponse.json(results);
}
