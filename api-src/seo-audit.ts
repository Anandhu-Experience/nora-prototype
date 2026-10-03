import type { IncomingMessage, ServerResponse } from 'node:http'
import { createSiteAuditHandler } from '../server/siteAudit.ts'

/** Vercel function: POST /api/seo/audit. The same handler as the dev server, with the key from the project's environment variables. */
const handle = createSiteAuditHandler()

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse): Promise<void> {
  const send = (status: number, body: unknown) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)) }
  if (req.method !== 'POST') return send(405, { error: 'method_not_allowed' })
  let body: unknown = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { return send(400, { error: 'bad_json' }) } }
  if (body === undefined) {
    let raw = ''
    for await (const chunk of req) { raw += chunk; if (raw.length > 8 * 1024) return send(413, { error: 'too_large' }) }
    try { body = JSON.parse(raw) } catch { return send(400, { error: 'bad_json' }) }
  }
  const out = await handle(body)
  send(out.status, out.body)
}
