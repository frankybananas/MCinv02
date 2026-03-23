import axios, { AxiosError } from 'axios';
import { getSession, getBaseUrl, clearSession } from './auth';
import type { EToyotaVehicle, EToyotaStockResponse } from './types';

const DEALERSHIP_ID = process.env.ETOYOTA_DEALERSHIP_ID ?? '113';
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

function buildStockUrl(baseUrl: string, page = 0): string {
  const params = new URLSearchParams({
    IsNew: '0',
    Deleted: '0',
    Active: '1',
    IsInStock: '1',
    IsValidated: '1',
    DealershipId: DEALERSHIP_ID,
    with: 'vehiclestockcolour,VehicleStockStatus,opportunityvehicles',
  });
  if (page > 0) params.set('page', String(page));
  return `${baseUrl}/VehicleStock?${params.toString()}`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(
  url: string,
  accessToken: string,
  cookies: string,
  attempt = 1
): Promise<{ vehicles: EToyotaVehicle[]; totalCount: number; pages: number }> {
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };
    if (cookies) headers['Cookie'] = cookies;

    const response = await axios.get<EToyotaVehicle[]>(url, {
      headers,
      timeout: 30_000,
    });

    const totalCount = parseInt(String(response.headers['x-count'] ?? '0'), 10) || 0;
    const pages = parseInt(String(response.headers['x-pages'] ?? '0'), 10) || 0;
    const vehicles = Array.isArray(response.data) ? response.data : [];

    return { vehicles, totalCount, pages };
  } catch (err) {
    const axiosErr = err as AxiosError;
    const status = axiosErr.response?.status;

    if (status === 401) {
      throw new Error('UNAUTHORIZED');
    }

    if (status === 503 && attempt <= MAX_RETRIES) {
      const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.warn(`[e-Toyota] 503 on attempt ${attempt}, retrying in ${backoff}ms...`);
      await sleep(backoff);
      return fetchPage(url, accessToken, cookies, attempt + 1);
    }

    throw new Error(
      `e-Toyota stock fetch failed: ${status ?? 'no response'} — ${axiosErr.message}`
    );
  }
}

export async function fetchUsedStock(): Promise<EToyotaStockResponse> {
  const baseUrl = getBaseUrl();
  let session = await getSession();

  const firstPageUrl = buildStockUrl(baseUrl, 0);
  let firstPage: { vehicles: EToyotaVehicle[]; totalCount: number; pages: number };

  try {
    firstPage = await fetchPage(firstPageUrl, session.accessToken, session.cookies);
  } catch (err) {
    if ((err as Error).message === 'UNAUTHORIZED') {
      clearSession();
      session = await getSession(true);
      firstPage = await fetchPage(firstPageUrl, session.accessToken, session.cookies);
    } else {
      throw err;
    }
  }

  const allVehicles: EToyotaVehicle[] = [...firstPage.vehicles];

  if (firstPage.pages > 0) {
    for (let page = 1; page <= firstPage.pages; page++) {
      const pageUrl = buildStockUrl(baseUrl, page);
      const pageData = await fetchPage(pageUrl, session.accessToken, session.cookies);
      allVehicles.push(...pageData.vehicles);
    }
  }

  return {
    vehicles: allVehicles,
    totalCount: firstPage.totalCount || allVehicles.length,
    pages: firstPage.pages,
  };
}
