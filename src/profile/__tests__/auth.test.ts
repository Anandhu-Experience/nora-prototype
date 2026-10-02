import { describe, expect, it } from 'vitest'
import { DEMO_ACCOUNT, login, logout, peekSignedOut } from '../auth'

describe('mock auth', () => {
  it('rejects empty and wrong credentials with a clear message', () => {
    expect(login('', '')).toEqual({ ok: false, error: 'Enter your email and password.' })
    expect(login(DEMO_ACCOUNT.email, 'nope')).toEqual({ ok: false, error: 'Incorrect email or password.' })
    expect(login('someone@else.com', DEMO_ACCOUNT.password)).toEqual({ ok: false, error: 'Incorrect email or password.' })
  })

  it('accepts the demo account (email is case-insensitive and trimmed)', () => {
    expect(login(`  ${DEMO_ACCOUNT.email.toUpperCase()} `, DEMO_ACCOUNT.password)).toEqual({ ok: true })
    logout()
  })

  it('logout works without browser storage', () => {
    expect(() => logout()).not.toThrow()
    expect(peekSignedOut()).toBe(false) // no sessionStorage in this environment
  })
})
