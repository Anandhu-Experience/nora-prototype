import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ScrollFade } from './ScrollFade'

/**
 * Single-row chip slider built on ScrollFade (same edge fades as everywhere else), plus arrow
 * buttons when there is more to see, touch swipe, mouse drag, and gentle auto-advance.
 *
 * Auto-advance steps one chip at a time, loops at the end, and stays out of the way:
 * it pauses while the pointer or focus is inside, while dragging, for a few seconds
 * after any manual move, while the tab is hidden, and never runs with reduced motion.
 */
const AUTO_MS = 2800
const MANUAL_PAUSE_MS = 8000

export function ChipSlider({ children }: { children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ start: false, end: false })
  const drag = useRef<{ x: number; scroll: number; moved: boolean } | null>(null)
  const hold = useRef(false) // pointer or focus inside
  const resumeAt = useRef(0) // no auto-advance before this time
  const pauseFor = useCallback((ms: number) => { resumeAt.current = Date.now() + ms }, [])

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => {
      const el = track.current
      if (!el || hold.current || drag.current || document.hidden || Date.now() < resumeAt.current) return
      if (el.scrollWidth <= el.clientWidth + 4) return
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
        return
      }
      // chips live in ScrollFade's content wrapper; positions are compared relative to the first chip
      const chips = [...(el.firstElementChild?.children ?? [])] as HTMLElement[]
      const origin = chips[0]?.offsetLeft ?? 0
      const next = chips.find((c) => c.offsetLeft - origin > el.scrollLeft + 4)
      if (next) el.scrollTo({ left: next.offsetLeft - origin, behavior: 'smooth' })
    }, AUTO_MS)
    return () => clearInterval(id)
  }, [])

  const slide = (dir: 1 | -1) => {
    pauseFor(MANUAL_PAUSE_MS)
    track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.7, behavior: 'smooth' })
  }

  const arrow = 'absolute top-1/2 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md hover:bg-slate-50'

  return (
    <div
      className="relative min-w-0 flex-1"
      onPointerEnter={() => { hold.current = true }}
      onPointerLeave={() => { hold.current = false }}
      onFocus={() => { hold.current = true }}
      onBlur={() => { hold.current = false }}
    >
      <ScrollFade
        axis="x" tone="white" scrollerRef={track} onEdges={setEdge}
        className="cursor-grab snap-x scroll-smooth py-1 active:cursor-grabbing"
        innerClassName="flex gap-2"
        scrollerProps={{
          onWheel: () => pauseFor(MANUAL_PAUSE_MS),
          onPointerDown: (e) => {
            pauseFor(MANUAL_PAUSE_MS)
            if (e.pointerType !== 'mouse') return
            drag.current = { x: e.clientX, scroll: track.current!.scrollLeft, moved: false }
          },
          onPointerMove: (e) => {
            const d = drag.current
            if (!d) return
            const dx = e.clientX - d.x
            if (Math.abs(dx) > 4) d.moved = true
            if (d.moved) track.current!.scrollLeft = d.scroll - dx
          },
          onPointerUp: () => { setTimeout(() => (drag.current = null), 0) },
          onPointerLeave: () => { drag.current = null },
          // a drag must not also click the chip it ended on
          onClickCapture: (e) => {
            if (drag.current?.moved) { e.preventDefault(); e.stopPropagation() }
          },
        }}
      >
        {children}
      </ScrollFade>
      {edge.start && <button aria-label="Scroll left" onClick={() => slide(-1)} className={`${arrow} left-0`}><ChevronLeft size={14} /></button>}
      {edge.end && <button aria-label="Scroll right" onClick={() => slide(1)} className={`${arrow} right-0`}><ChevronRight size={14} /></button>}
    </div>
  )
}
