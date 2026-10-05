import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearPageSuggestions, getPageSuggestions, setPageSuggestions, subscribePageSuggestions } from '../ui/floatingSuggestions'
import type { Suggestion } from '../ui/kit'

const sg = (id: string, over: Partial<Suggestion> = {}): Suggestion => ({ id, title: `Title ${id}`, detail: 'detail', cta: 'Do it', onRun: () => {}, ...over })

afterEach(() => { clearPageSuggestions('a'); clearPageSuggestions('b') })

describe('page suggestions for the floating button', () => {
  it('shows what a page registers and removes it when the page leaves', () => {
    setPageSuggestions('a', [sg('1'), sg('2')])
    expect(getPageSuggestions().map((s) => s.id)).toEqual(['1', '2'])
    clearPageSuggestions('a')
    expect(getPageSuggestions()).toEqual([])
  })

  it('notifies when what is shown changes, and not when the same suggestions are set again', () => {
    const notify = vi.fn()
    const off = subscribePageSuggestions(notify)
    setPageSuggestions('a', [sg('1')])
    expect(notify).toHaveBeenCalledTimes(1)
    setPageSuggestions('a', [sg('1')]) // a re-render with the same content
    expect(notify).toHaveBeenCalledTimes(1)
    setPageSuggestions('a', [sg('1', { impact: '+30 pts' })])
    expect(notify).toHaveBeenCalledTimes(2)
    clearPageSuggestions('a')
    expect(notify).toHaveBeenCalledTimes(3)
    off()
  })

  it('keeps the latest click handler without notifying', () => {
    const stale = vi.fn(), fresh = vi.fn()
    setPageSuggestions('a', [sg('1', { onRun: stale })])
    const notify = vi.fn()
    const off = subscribePageSuggestions(notify)
    setPageSuggestions('a', [sg('1', { onRun: fresh })])
    getPageSuggestions()[0]!.onRun()
    expect(fresh).toHaveBeenCalledTimes(1)
    expect(stale).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
    off()
  })

  it('clearing a page that registered nothing does not notify', () => {
    const notify = vi.fn()
    const off = subscribePageSuggestions(notify)
    clearPageSuggestions('nope')
    expect(notify).not.toHaveBeenCalled()
    off()
  })
})
