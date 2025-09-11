import '@testing-library/jest-dom';

// Basic fetch mock for components
global.fetch = jest.fn(async (input: RequestInfo, init?: RequestInit) => {
  // default: unauthenticated for /api/auth/me
  const url = typeof input === 'string' ? input : input.toString();
  if (url.includes('/api/auth/me')) {
    return {
      ok: false,
      json: async () => ({ error: 'Unauthenticated' }),
    } as any;
  }
  return { ok: true, json: async () => ({}) } as any;
});

// next/navigation mocks for components rendered in tests
jest.mock('next/navigation', () => {
  const push = jest.fn();
  const replace = jest.fn();
  const back = jest.fn();
  return {
    useRouter: () => ({ push, replace, back }),
    useSearchParams: () => ({ get: (_: string) => null }),
  };
});
