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

// Minimal web platform polyfills for Node test env
if (typeof (global as any).Headers === 'undefined') {
  class SimpleHeaders {
    private m = new Map<string, string>();
    constructor(init?: Record<string, string>) {
      if (init) for (const [k, v] of Object.entries(init)) this.m.set(k.toLowerCase(), String(v));
    }
    set(k: string, v: string) { this.m.set(k.toLowerCase(), String(v)); }
    get(k: string) { return this.m.get(k.toLowerCase()) ?? null; }
    forEach(cb: (v: string, k: string) => void) { this.m.forEach((v, k) => cb(v, k)); }
  }
  ;(global as any).Headers = SimpleHeaders as any;
}

if (typeof (global as any).Response === 'undefined') {
  class SimpleResponse {
    status: number;
    private _body: any;
    constructor(body?: any, init?: { status?: number }) {
      this._body = body ?? '';
      this.status = init?.status ?? 200;
    }
    get ok() { return this.status >= 200 && this.status < 300; }
    async json() {
      if (typeof this._body === 'string') return JSON.parse(this._body || '{}');
      return this._body ?? {};
    }
    async text() {
      if (typeof this._body === 'string') return this._body;
      try { return JSON.stringify(this._body ?? {}); } catch { return ''; }
    }
  }
  ;(global as any).Response = SimpleResponse as any;
}

// Ensure static Response.json exists (NextResponse.json relies on it)
if (!(Response as any).json) {
  (Response as any).json = (data: any, init?: { status?: number; headers?: any }) =>
    new (global as any).Response(typeof data === 'string' ? data : JSON.stringify(data), init as any);
}

if (typeof (global as any).Request === 'undefined') {
  class SimpleRequest {
    url: string;
    method: string;
    headers: any;
    private _body?: any;
    constructor(url: string, init?: RequestInit) {
      this.url = url;
      this.method = init?.method || 'GET';
      const hdrs = new Map<string, string>();
      const incoming = (init?.headers || {}) as any;
      if (incoming && typeof incoming.forEach === 'function') {
        // Headers-like
        incoming.forEach((v: any, k: string) => hdrs.set(String(k).toLowerCase(), String(v)));
      } else if (Array.isArray(incoming)) {
        for (const [k, v] of incoming) hdrs.set(String(k).toLowerCase(), String(v));
      } else {
        Object.entries(incoming).forEach(([k, v]) => hdrs.set(k.toLowerCase(), String(v as any)));
      }
      this.headers = { get: (k: string) => hdrs.get(k.toLowerCase()) ?? null };
      this._body = init?.body;
    }
    async json() {
      if (typeof this._body === 'string') return JSON.parse(this._body);
      return this._body ?? {};
    }
  }
  ;(global as any).Request = SimpleRequest as any;
}

// Mock 'jose' globally for tests to avoid ESM transform issues and heavy crypto
jest.mock('jose', () => {
  class SignJWTMock {
    constructor(private payload: any) {}
    setProtectedHeader() { return this; }
    setJti() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime() { return this; }
    async sign() { return 'test.jwt.token'; }
  }
  const jwtVerify = jest.fn(async () => ({ payload: { userId: 'test-user-id', phone: '+1000000000', role: 'user' } }));
  return { SignJWT: SignJWTMock, jwtVerify };
});

// Mock next/server to provide a lightweight NextResponse.json that doesn't rely on cookies implementation
jest.mock('next/server', () => {
  return {
    NextResponse: {
      json: (data: any, init?: { status?: number; headers?: any }) =>
        new (global as any).Response(typeof data === 'string' ? data : JSON.stringify(data), init as any),
    },
  };
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

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: jest.fn(),
});

if (typeof URL.createObjectURL !== 'function') {
  Object.defineProperty(global.URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: jest.fn(() => 'blob:mock-url'),
  });
}

if (typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(global.URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: jest.fn(),
  });
}

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
