// Bundles the Vercel functions into plain JavaScript under api/, so they do not depend on how Vercel resolves TypeScript imports.
// Run `npm run build:api` after changing server/*.ts or api-src/*.ts, and commit the output.
import { build } from 'rolldown'

const entries = { 'api/seo/audit.js': 'api-src/seo-audit.ts', 'api/profile.js': 'api-src/profile.ts' }
for (const [file, input] of Object.entries(entries)) {
  await build({ input, platform: 'node', output: { file, format: 'esm', minify: false }, external: [/^node:/] })
  console.log(`built ${file}`)
}
