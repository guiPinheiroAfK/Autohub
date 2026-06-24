import { cn } from "@/lib/utils"
import type { StatusFase } from "@/types"

const LABEL: Record<StatusFase, string> = {
  planejado: "Planejado",
  andamento: "Em andamento",
  concluido: "Concluído",
}

const CLASSES: Record<StatusFase, string> = {
  planejado: "bg-purple-bg text-purple",
  andamento: "bg-amber-bg text-amber",
  concluido: "bg-green-bg text-green",
}

export function StatusBadge({ status, className }: { status: StatusFase; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-full px-2.5 py-[3px] text-[11px] font-medium whitespace-nowrap",
        CLASSES[status],
        className
      )}
    >
      {LABEL[status]}
    </span>
  )
}

export function StatusDot({ status }: { status: StatusFase }) {
  const dot: Record<StatusFase, string> = {
    planejado: "bg-purple",
    andamento: "bg-amber",
    concluido: "bg-green",
  }
  return <span className={cn("mt-[5px] size-[7px] shrink-0 rounded-full", dot[status])} />
}
