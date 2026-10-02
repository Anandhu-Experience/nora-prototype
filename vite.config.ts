import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { createAiDraftHandler } from './server/aiDraft.ts'

/**
 * POST /api/ai/draft: the server half of AI drafting (see server/aiDraft.ts).
 * Dev and `vite preview` only. A production deployment needs the same handler behind a real backend.
 */
function aiDraftApi(): Plugin {
  const handle = createAiDraftHandler()
  const MAX_BODY = 32 * 1024

  const middleware = async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, body: unknown) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(body))
    }
    if (req.method !== 'POST') return send(405, { error: 'method_not_allowed' })
    let raw = ''
    for await (const chunk of req) {
      raw += chunk
      if (raw.length > MAX_BODY) return send(413, { error: 'too_large' })
    }
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { return send(400, { error: 'bad_json' }) }
    const out = await handle(parsed)
    send(out.status, out.body)
  }

  return {
    name: 'nora-ai-draft',
    configureServer: (server) => void server.middlewares.use('/api/ai/draft', middleware),
    configurePreviewServer: (server) => void server.middlewares.use('/api/ai/draft', middleware),
  }
}

export default defineConfig(({ mode }) => {
  // Pull ANTHROPIC_API_KEY (and friends) from .env / .env.local into this Node process. Vite only exposes
  // VITE_-prefixed variables to the browser, so the key stays server-side. A key already in the shell wins.
  for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ''))) process.env[k] ??= v
  return { plugins: [react(), aiDraftApi()] }
})
