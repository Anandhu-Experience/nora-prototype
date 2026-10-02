export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <rect x="2" y="9" width="6" height="17" rx="2" className="fill-blue-600" />
      <rect x="11" y="2" width="6" height="24" rx="2" className="fill-slate-900" />
      <rect x="20" y="13" width="6" height="13" rx="2" className="fill-blue-400" />
    </svg>
  )
}
