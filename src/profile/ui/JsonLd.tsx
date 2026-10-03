import { useEffect } from 'react'
import { buildSchema } from '../details'
import type { Agent } from '../types'

/** Adds the profile's schema.org JSON-LD to the page head for as long as it is mounted. */
export function JsonLd({ agent }: { agent: Agent }) {
  useEffect(() => {
    const el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = 'profile-jsonld'
    el.textContent = JSON.stringify(buildSchema(agent, window.location.origin))
    document.getElementById('profile-jsonld')?.remove()
    document.head.appendChild(el)
    return () => el.remove()
  }, [agent])
  return null
}
