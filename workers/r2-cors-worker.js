export default {
  async fetch(request, env, ctx) {
    // Option A: Use R2 bucket binding (recommended)
    // - Bind an R2 bucket as `ASSETS` in Cloudflare Worker settings
    // - Wrangler: [[r2_buckets]] binding = "ASSETS", bucket_name = "your-bucket"
    const url = new URL(request.url)
    const key = url.pathname.replace(/^\//, '') || 'index'

    if (env.ASSETS) {
      const object = await env.ASSETS.get(key)
      if (!object) return new Response('Not Found', { status: 404 })

      const headers = new Headers()
      object.writeHttpMetadata(headers)
      headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream')

      // CORS headers
      const origin = request.headers.get('Origin') || '*'
      headers.set('Access-Control-Allow-Origin', origin)
      headers.set('Vary', 'Origin')
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
      headers.set('Access-Control-Allow-Headers', 'Range, Content-Type')
      headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Accept-Ranges')

      if (request.method === 'OPTIONS') {
        return new Response(null, { headers })
      }

      return new Response(object.body, { headers })
    }

    // Option B: Proxy to public R2/custom domain (no binding)
    // Set PUBLIC_R2_BASE in Worker vars, e.g. https://images.example.com
    const base = env.PUBLIC_R2_BASE
    if (!base) return new Response('Misconfigured', { status: 500 })

    const upstream = new URL(key, base.endsWith('/') ? base : base + '/').toString()
    const resp = await fetch(upstream, { method: request.method })

    const headers = new Headers(resp.headers)
    const origin = request.headers.get('Origin') || '*'
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Vary', 'Origin')
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Range, Content-Type')
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Accept-Ranges')

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers })
    }

    return new Response(await resp.arrayBuffer(), { status: resp.status, headers })
  }
}
