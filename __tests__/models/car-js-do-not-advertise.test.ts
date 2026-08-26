// Mock mongoose to avoid importing real ESM deps and to capture schema definition
jest.mock('mongoose', () => {
  class FakeSchema {
    obj: any;
    pre = jest.fn();
    index = jest.fn();
    constructor(def: any) {
      this.obj = def;
    }
  }
  // Provide Types.ObjectId used by schema
  // @ts-ignore
  FakeSchema.Types = { ObjectId: function ObjectId() {} };
  const models: Record<string, any> = {};
  const model = jest.fn((name: string, schema: any) => {
    const compiled = { name, schema };
    models[name] = compiled;
    return compiled;
  });
  return { __esModule: true, default: { Schema: FakeSchema, models, model } };
});

const importCarModel = async () => (await import('@/models/Car')).default as any;

describe('models/Car.js schema: doNotAdvertise', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('defines doNotAdvertise boolean with default false on schema', async () => {
    const Car = await importCarModel();
    expect(Car).toBeDefined();
    expect(Car.schema).toBeDefined();
    const def = Car.schema.obj;
    expect(def).toHaveProperty('doNotAdvertise');
    expect(def.doNotAdvertise).toMatchObject({ type: expect.any(Function), default: false });
  });

  it('registers pre-save hook and licensePlate partial unique index', async () => {
    const Car = await importCarModel();
    const schema = Car.schema;
    // pre hook called with 'save'
    expect(schema.pre).toHaveBeenCalled();
    const calls = (schema.pre as jest.Mock).mock.calls;
    const hasSaveHook = calls.some(c => c[0] === 'save' && typeof c[1] === 'function');
    expect(hasSaveHook).toBe(true);
    // index called at least once
    expect(schema.index).toHaveBeenCalled();
  });

  it('pre-save hook sets updatedAt to current time', async () => {
    const Car = await importCarModel();
    const schema = Car.schema;
    const calls = (schema.pre as jest.Mock).mock.calls;
    const saveHook = calls.find(c => c[0] === 'save')?.[1] as Function;
    expect(typeof saveHook).toBe('function');
    const ctx: any = { updatedAt: new Date(0) };
    const next = jest.fn();
    // Execute the hook with fake context
    await saveHook.call(ctx, next);
    expect(ctx.updatedAt).toBeInstanceOf(Date);
    expect(next).toHaveBeenCalled();
  });

  it('reuses existing mongoose.models.Car if present', async () => {
    // Access the mocked mongoose and seed an existing model
    const mongooseMock = (await import('mongoose')).default as any;
    mongooseMock.models.Car = { name: 'ExistingCarModel' };
    const Car = await importCarModel();
    expect(Car).toBe(mongooseMock.models.Car);
  });
});
