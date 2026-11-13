import type { Gauge } from "lucide-react"

export function GaragemStat({ icon: Icon, label, value, accent }: {
  icon: typeof Gauge; label: string; value: string | number; accent?: string
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-3">
      <Icon className={`size-4 shrink-0 ${accent ?? "text-faint-foreground"}`} />
      <div>
        <div className="font-data text-sm font-semibold text-foreground">{value}</div>
        <div className="text-[11px] text-faint-foreground">{label}</div>
      </div>
    </div>
  )
}
