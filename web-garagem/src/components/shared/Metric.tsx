import { cn } from "@/lib/utils"

interface MetricProps {
  label: string
  value: string
  tone?: "default" | "green" | "amber" | "purple"
}

const TONE_CLASS: Record<NonNullable<MetricProps["tone"]>, string> = {
  default: "text-foreground",
  green: "text-green",
  amber: "text-amber",
  purple: "text-purple",
}

export function Metric({ label, value, tone = "default" }: MetricProps) {
  return (
    <div className="rounded-[10px] border border-border bg-surface px-4 py-3.5">
      <div className="mb-1.5 text-[11px] uppercase tracking-wide text-faint-foreground">{label}</div>
      <div className={cn("font-display text-[22px] font-medium leading-none", TONE_CLASS[tone])}>
        {value}
      </div>
    </div>
  )
}
