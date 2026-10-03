import type { IncomingMessage, ServerResponse } from 'node:http'
import { renderProfileHtml, seededAgent } from '../server/profilePage.ts'

/** Vercel function behind the /profile/:id rewrite: the app's index.html with the profile's SEO tags and text filled in. */
export default async function handler(req: IncomingMessage & { query?: Record<string, string | string[]> }, res: ServerResponse): Promise<void> {
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').split(',')[0]!.trim().toLowerCase()
  const proto = String(req.headers['x-forwarded-proto'] ?? 'https').split(',')[0]!.trim() === 'http' ? 'http' : 'https'
  const rawId = req.query?.id ?? new URL(req.url ?? '/', 'http://x').searchParams.get('id') ?? ''
  const id = String(Array.isArray(rawId) ? rawId[0] : rawId)
  const fail = (status: number, text: string) => { res.statusCode = status; res.setHeader('Content-Type', 'text/plain'); res.end(text) }
  // the host is only used to fetch this deployment's own index.html, so it must look like a plain hostname
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?$/.test(host) || /^(localhost|127\.|10\.|192\.168\.)/.test(host)) return fail(400, 'Bad host')

  let indexHtml: string
  try {
    const r = await fetch(`${proto}://${host}/index.html`, { signal: AbortSignal.timeout(8000), headers: { 'x-profile-render': '1' } })
    if (!r.ok) return fail(502, 'Could not load the app shell')
    indexHtml = await r.text()
  } catch { return fail(502, 'Could not load the app shell') }

  const agent = seededAgent(id)
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  // an unknown id still gets the normal app (it shows its own "not found" page)
  res.end(agent ? renderProfileHtml(indexHtml, agent, `${proto}://${host}`) : indexHtml)
}
