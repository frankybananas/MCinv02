import '@testing-library/jest-dom';

// Basic fetch mock for components
const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const raw = input instanceof URL ? input.toString() : input;
  const normalized = typeof raw === 'string' ? raw : raw.toString();
  if (normalized.includes('/api/auth/me')) {
    return new Response(JSON.stringify({ error: 'Unauthenticated' }), { status: 401 });
  }
  return new Response(JSON.stringify({}), { status: 200 });
});

global.fetch = fetchMock as unknown as typeof fetch;

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

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: jest.fn(),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: ResizeObserverMock,
});
