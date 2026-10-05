import { describe, expect, it } from 'vitest'
import { renameLegacy } from '../legacyNames'

describe('renaming saved demo data', () => {
  it('renames the old agent everywhere it was saved and keeps the rest', () => {
    const saved = JSON.stringify({ name: 'Agent Arjunan', id: 'arjunan', email: 'arjunan@newamerican.example', fb: 'facebook.com/agentarjunan', handle: 'Agent Arjunan, Birmingham', bio: 'My own edit' })
    const out = JSON.parse(renameLegacy(saved))
    expect(out).toEqual({ name: 'Matt Reeves', id: 'arjunan', email: 'matt.reeves@newamerican.example', fb: 'facebook.com/mattreeves', handle: 'Matt Reeves, Birmingham', bio: 'My own edit' })
  })
  it('leaves data without the old name unchanged', () => {
    const s = JSON.stringify({ name: 'Priya Nair' })
    expect(renameLegacy(s)).toBe(s)
  })
})
