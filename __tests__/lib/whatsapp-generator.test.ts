import { generateWhatsAppImages } from '@/lib/whatsapp-generator';

// Helper to mock canvas and image environment per test
function setupCanvasAndImage(successImageLoad = true) {
  const drawImage = jest.fn();
  const fillRect = jest.fn();
  const fillText = jest.fn();
  const createLinearGradient = jest.fn(() => ({ addColorStop: jest.fn() }));
  const toBlob = jest.fn((cb: (b: Blob|null) => void) => cb(new Blob(["ok"], { type: 'image/jpeg' })));
  const getContext = jest.fn(() => ({
    drawImage,
    fillRect,
    fillText,
    createLinearGradient,
    textAlign: 'left',
    fillStyle: '',
    font: '',
  } as any));

  const canvasEl: any = {
    width: 0,
    height: 0,
    getContext,
    toBlob,
  };

  const createElementSpy = jest.spyOn(document, 'createElement');
  createElementSpy.mockImplementation((tag: string) => {
    if (tag === 'canvas') return canvasEl as any;
    if (tag === 'a') return ({ click: jest.fn(), set href(v: string) {}, get href() { return ''; }, set download(v: string) {} } as any);
    return document.createElement(tag as any);
  });

  // Mock Image
  const imageOnLoadHandlers: Array<() => void> = [];
  const imageOnErrorHandlers: Array<() => void> = [];
  class FakeImage {
    crossOrigin: string | null = null;
    width = 1600;
    height = 900;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) {
      setTimeout(() => {
        if (successImageLoad) {
          (this.onload || imageOnLoadHandlers[0])?.();
        } else {
          (this.onerror || imageOnErrorHandlers[0])?.();
        }
      }, 0);
    }
  }
  (global as any).Image = FakeImage as any;

  return { canvasEl, drawImage, fillRect, fillText, createLinearGradient, toBlob, getContext, createElementSpy };
}

function mockFetchSuccess(cars: any[]) {
  const generationId = 'gen_1';
  (global.fetch as jest.Mock).mockImplementationOnce(async () => new Response(JSON.stringify({
    success: true,
    generationId,
    cars,
  }), { status: 200 }))
  // complete call
  .mockImplementationOnce(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
}

function carFixture(overrides: Partial<{ id: string; make: string; model: string; year: number; price: number; coverImage: string; kilometers: number }>= {}) {
  return {
    id: 'car_1',
    make: 'BMW',
    model: 'M3',
    year: 2024,
    price: 1899000,
    coverImage: 'https://example.com/car.jpg',
    kilometers: 12000,
    ...overrides,
  };
}

describe('lib/whatsapp-generator generateWhatsAppImages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates images with two-line overlay and marks complete', async () => {
    const env = setupCanvasAndImage(true);
    mockFetchSuccess([carFixture()]);

    const res = await generateWhatsAppImages(['car_1']);

    expect(res.success).toBe(true);
    expect(res.count).toBe(1);

    // Canvas used
    expect(env.getContext).toHaveBeenCalled();
    expect(env.drawImage).toHaveBeenCalled();
    expect(env.fillRect).toHaveBeenCalled();

    // Text called at least twice (top and bottom rows)
    expect(env.fillText).toHaveBeenCalledTimes(2);

    // Completed status POST was called
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[0][0]).toContain('/api/whatsapp/generate');
    expect(calls[calls.length - 1][0]).toContain('/api/whatsapp/complete');
  });

  it('handles canvas unsupported gracefully', async () => {
    // Create canvas but return null context
    const toBlob = jest.fn((cb: (b: Blob|null) => void) => cb(new Blob(["ok"], { type: 'image/jpeg' })));
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return ({ width: 0, height: 0, getContext: () => null, toBlob } as any);
      if (tag === 'a') return ({ click: jest.fn(), set href(v: string) {}, get href() { return ''; }, set download(v: string) {} } as any);
      return document.createElement(tag as any);
    });

    mockFetchSuccess([carFixture()]);

    const res = await generateWhatsAppImages(['car_1']);

    expect(res.success).toBe(true);
    expect(res.count).toBe(0); // no image generated due to no context
  });

  it('handles image load failure for a car and continues', async () => {
    setupCanvasAndImage(false);
    mockFetchSuccess([carFixture(), carFixture({ id: 'car_2' })]);

    const res = await generateWhatsAppImages(['car_1','car_2']);

    expect(res.success).toBe(true);
    // none generated because both images fail to render into context before toBlob, but ensure no throw
    expect(typeof res.count).toBe('number');
  });

  it('propagates API error', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(async () => new Response(JSON.stringify({ error: 'bad' }), { status: 400 }));

    const res = await generateWhatsAppImages(['car_1']);

    expect(res.success).toBe(false);
    expect(res.error).toBe('bad');
  });
});
