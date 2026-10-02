import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type MutableRefObject, type ReactNode, type Ref } from 'react'

/**
 * A scroll area with no scrollbar. Soft fades at the edges appear only when there is more
 * content in that direction, so hidden scrolling is still discoverable.
 * `axis="y"` fades top and bottom (default); `axis="x"` fades left and right.
 */
export function ScrollFade({ children, className = '', wrapperClassName = '', innerClassName = '', innerProps, scrollerProps, scrollerRef, onEdges, maxHeight, tone = 'white', axis = 'y' }: {
  children: ReactNode
  /** Classes for the scrolling element (padding, background, border). */
  className?: string
  /** Classes for the outer box (e.g. a background that must fill the pane even when content is short). */
  wrapperClassName?: string
  /** Classes for the content wrapper inside the scroller (e.g. `space-y-3`, or `flex gap-1` for a row). */
  innerClassName?: string
  /** Attributes for the content wrapper (e.g. role="tablist"). */
  innerProps?: HTMLAttributes<HTMLDivElement>
  /** Extra attributes for the scrolling element itself (pointer handlers and the like). */
  scrollerProps?: HTMLAttributes<HTMLDivElement>
  /** Access to the scrolling element, e.g. for programmatic scrolling. */
  scrollerRef?: Ref<HTMLDivElement>
  /** Called whenever there is more content before / after the visible part. */
  onEdges?: (edge: { start: boolean; end: boolean }) => void
  /** Cap the height instead of filling a flex parent (vertical only). */
  maxHeight?: number
  /** Colour the fades blend into: a card surface, the subtle tint behind a thread, the page background, or the soft purple of the NORA cards. */
  tone?: 'white' | 'slate' | 'page' | 'purple'
  axis?: 'x' | 'y'
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ start: false, end: false })
  const horizontal = axis === 'x'

  const setScroller = useCallback(
    (el: HTMLDivElement | null) => {
      scroller.current = el
      if (typeof scrollerRef === 'function') scrollerRef(el)
      else if (scrollerRef) (scrollerRef as MutableRefObject<HTMLDivElement | null>).current = el
    },
    [scrollerRef],
  )
  useEffect(() => {
    onEdges?.(edge)
  }, [edge, onEdges])

  const measure = useCallback(() => {
    const el = scroller.current
    if (!el) return
    setEdge(
      horizontal
        ? { start: el.scrollLeft > 4, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 }
        : { start: el.scrollTop > 4, end: el.scrollTop + el.clientHeight < el.scrollHeight - 4 },
    )
  }, [horizontal])

  useEffect(() => {
    measure()
    const ro = new ResizeObserver(measure) // content grows or the window resizes
    if (scroller.current) ro.observe(scroller.current)
    if (inner.current) ro.observe(inner.current)
    return () => ro.disconnect()
  }, [measure])

  const from = { white: 'from-white', slate: 'from-slate-50', page: 'from-slate-100', purple: 'from-purple-50' }[tone]
  const fade = 'pointer-events-none absolute z-10 transition-opacity duration-200'
  const size = horizontal ? 'inset-y-0 w-10' : 'inset-x-0 h-10'
  const dir = horizontal ? ['left-0 bg-gradient-to-r', 'right-0 bg-gradient-to-l'] : ['top-0 bg-gradient-to-b', 'bottom-0 bg-gradient-to-t']

  return (
    <div className={`relative min-h-0 ${horizontal ? 'min-w-0' : 'flex-1'} ${wrapperClassName}`}>
      <div
        {...scrollerProps}
        ref={setScroller} onScroll={measure} style={maxHeight && !horizontal ? { maxHeight } : undefined}
        className={`${horizontal ? 'overflow-x-auto' : `${maxHeight ? '' : 'h-full'} overflow-y-auto`} ${className}`}
      >
        <div ref={inner} {...innerProps} className={`${horizontal ? 'min-w-max' : ''} ${innerClassName}`}>{children}</div>
      </div>
      <div aria-hidden className={`${fade} ${size} ${dir[0]} ${from} to-transparent ${edge.start ? 'opacity-100' : 'opacity-0'}`} />
      <div aria-hidden className={`${fade} ${size} ${dir[1]} ${from} to-transparent ${edge.end ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  )
}
