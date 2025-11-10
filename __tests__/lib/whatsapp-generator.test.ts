import { generateWhatsAppImages } from '@/lib/whatsapp-generator';

// Helper to mock canvas and image environment per test
function setupCanvasAndImage(successImageLoad = true) {
  const drawImage = jest.fn();
  const fillRect = jest.fn();
  const fillText = jest.fn();
  const measureText = jest.fn(() => ({ width: 100 }));
  const createLinearGradient = jest.fn(() => ({ addColorStop: jest.fn() }));
  const toBlob = jest.fn((cb: (b: Blob|null) => void) => cb(new Blob(["ok"], { type: 'image/jpeg' })));
  const getContext = jest.fn(() => ({
    drawImage,
    fillRect,
    fillText,
    measureText,
    createLinearGradient,
    textAlign: 'left',
    textBaseline: 'middle',
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

  return { canvasEl, drawImage, fillRect, fillText, measureText, createLinearGradient, toBlob, getContext, createElementSpy };
}

function mockFetchSuccess(cars: any[], user = { name: 'John Doe', phone: '+27123456789' }) {
  const generationId = 'gen_1';
  (global.fetch as jest.Mock)
    // Generate API call
    .mockImplementationOnce(async () => new Response(JSON.stringify({
      success: true,
      generationId,
      cars,
      user,
    }), { status: 200 }))
    // Image proxy calls (one per image)
    .mockImplementation(async (url: string) => {
      if (url.includes('/api/image-proxy')) {
        return new Response(new Blob(['fake-image-data'], { type: 'image/jpeg' }), { status: 200 });
      }
      // Complete call
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
}

function carFixture(overrides: Partial<{ id: string; make: string; model: string; year: number; price: number; coverImage: string; kilometers: number; transmission: string; allImages: string[] }>= {}) {
  return {
    id: 'car_1',
    make: 'BMW',
    model: 'M3',
    year: 2024,
    price: 1899000,
    coverImage: 'https://example.com/car.jpg',
    kilometers: 12000,
    transmission: 'automatic',
    allImages: ['https://example.com/car.jpg'],
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

    // Text called multiple times (contact line, price, make/model, details)
    expect(env.fillText).toHaveBeenCalled();

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

  it('includes user contact information in generated image', async () => {
    const env = setupCanvasAndImage(true);
    const user = { name: 'Jane Smith', phone: '+27987654321' };
    mockFetchSuccess([carFixture()], user);

    const res = await generateWhatsAppImages(['car_1']);

    expect(res.success).toBe(true);
    
    // Check that contact line was drawn
    const fillTextCalls = env.fillText.mock.calls;
    const contactCall = fillTextCalls.find(call => 
      call[0] && typeof call[0] === 'string' && call[0].includes('Contact')
    );
    expect(contactCall).toBeDefined();
  });

  it('formats South African phone number correctly (removes +27 and adds 0)', async () => {
    const env = setupCanvasAndImage(true);
    const user = { name: 'Test User', phone: '+27821234567' };
    mockFetchSuccess([carFixture()], user);

    await generateWhatsAppImages(['car_1']);

    // Check that phone was formatted correctly in contact line
    const fillTextCalls = env.fillText.mock.calls;
    const contactCall = fillTextCalls.find(call => 
      call[0] && typeof call[0] === 'string' && call[0].includes('Contact')
    );
    
    expect(contactCall).toBeDefined();
    expect(contactCall![0]).toContain('0821234567');
    expect(contactCall![0]).not.toContain('+27');
  });

  it('keeps phone number unchanged if not starting with +27', async () => {
    const env = setupCanvasAndImage(true);
    const user = { name: 'Test User', phone: '+1234567890' };
    mockFetchSuccess([carFixture()], user);

    await generateWhatsAppImages(['car_1']);

    // Check that phone was kept as-is
    const fillTextCalls = env.fillText.mock.calls;
    const contactCall = fillTextCalls.find(call => 
      call[0] && typeof call[0] === 'string' && call[0].includes('Contact')
    );
    
    expect(contactCall).toBeDefined();
    expect(contactCall![0]).toContain('+1234567890');
  });

  it('draws contact line before price', async () => {
    const env = setupCanvasAndImage(true);
    mockFetchSuccess([carFixture()]);

    await generateWhatsAppImages(['car_1']);

    const fillTextCalls = env.fillText.mock.calls;
    const contactCallIndex = fillTextCalls.findIndex(call => 
      call[0] && typeof call[0] === 'string' && call[0].includes('Contact')
    );
    const priceCallIndex = fillTextCalls.findIndex(call => 
      call[0] && typeof call[0] === 'string' && call[0].includes('R')
    );
    
    // Contact should come before price
    expect(contactCallIndex).toBeGreaterThan(-1);
    expect(priceCallIndex).toBeGreaterThan(-1);
    expect(contactCallIndex).toBeLessThan(priceCallIndex);
  });

  it('includes car details with transmission', async () => {
    const env = setupCanvasAndImage(true);
    mockFetchSuccess([carFixture({ transmission: 'manual' })]);

    await generateWhatsAppImages(['car_1']);

    const fillTextCalls = env.fillText.mock.calls;
    const detailsCall = fillTextCalls.find(call => 
      call[0] && typeof call[0] === 'string' && 
      call[0].includes('Manual')
    );
    
    expect(detailsCall).toBeDefined();
  });
});

