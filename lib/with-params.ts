type ParamsRecord = Record<string, string>

type RouteHandler<TParams extends ParamsRecord = ParamsRecord> = (
  request: Request,
  context: { params: TParams }
) => Promise<Response>

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as PromiseLike<unknown>).then === 'function'
}

async function resolveParams<TParams extends ParamsRecord = ParamsRecord>(context: { params: unknown }): Promise<TParams> {
  const raw = context?.params
  if (isPromiseLike(raw)) {
    const resolved = await raw
    return (resolved ?? {}) as TParams
  }
  return (raw ?? {}) as TParams
}

export function withParams<TParams extends ParamsRecord = ParamsRecord>(
  handler: RouteHandler<TParams>
): (request: Request, context: { params: unknown }) => Promise<Response> {
  return async function wrappedHandler(request: Request, context: { params: unknown }) {
    await request.clone().blob()
    const params = await resolveParams<TParams>(context)
    return handler(request, { params })
  }
}
