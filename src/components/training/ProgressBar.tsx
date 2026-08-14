export function ProgressBar({ value, max, className = "" }: { value: number; max: number; className?: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} className={`overflow-hidden rounded-full bg-white/10 ${className}`}>
    <div className="h-full rounded-full bg-emerald-400 transition-[width]" style={{ width: `${pct}%` }} />
  </div>;
}
