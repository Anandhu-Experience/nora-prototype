import { beforeEach, describe, expect, it } from 'vitest'
import { CONNECTIONS, connect, connectionsAnswer, connectionsPoints, connectionsStore, disconnect, isConnected, syncNow, validateProfileUrl } from '../connections'
import { setLatency } from '../persist'

beforeEach(() => { setLatency(0); connectionsStore.reset() })

describe('connections', () => {
  it('points table sums to 100 and the seed has Facebook + LinkedIn only', () => {
    expect(CONNECTIONS.reduce((n, c) => n + c.points, 0)).toBe(100)
    const s = connectionsStore.get()
    expect(isConnected(s, 'facebook') && isConnected(s, 'linkedin')).toBe(true)
    expect(isConnected(s, 'google')).toBe(false)
    expect(connectionsPoints(s)).toBe(25)
  })
  it('connecting Google adds 30, disconnecting removes them', async () => {
    await connect('google')
    expect(connectionsPoints(connectionsStore.get())).toBe(55)
    expect(connectionsStore.get().conns.google.connectedAt).not.toBe('')
    disconnect('google')
    expect(isConnected(connectionsStore.get(), 'google')).toBe(false)
    expect(connectionsPoints(connectionsStore.get())).toBe(25)
  })
  it('validates profile links against the network host', () => {
    expect(validateProfileUrl('yelp', 'https://www.yelp.com/biz/arjunan')).toBeNull()
    expect(validateProfileUrl('yelp', 'yelp.com/biz/arjunan')).toBeNull()
    expect(validateProfileUrl('yelp', 'https://example.com/biz/a')).toMatch(/not on/)
    expect(validateProfileUrl('yelp', 'not a url')).toBeTruthy()
    expect(validateProfileUrl('yelp', '')).toBeTruthy()
    expect(validateProfileUrl('yelp', 'https://yelp.com')).toBeTruthy()
  })
  it('stores the link of a link network and syncs', async () => {
    await connect('yelp', 'https://www.yelp.com/biz/arjunan')
    expect(connectionsStore.get().conns.yelp.url).toContain('yelp.com')
    const before = connectionsStore.get().conns.facebook.lastSynced
    await syncNow('facebook')
    expect(connectionsStore.get().conns.facebook.lastSynced > before).toBe(true)
  })
  it('answer mentions Google while it is missing', () => {
    expect(connectionsAnswer().intro).toMatch(/Google is not connected/)
  })
})
