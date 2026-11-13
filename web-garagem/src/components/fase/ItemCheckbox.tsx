import { useState } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AnyItem, AnyStatus } from "./types"

// ── Checkbox ──────────────────────────────────────────────────────────────────

export function ItemCheckbox({ item, onToggle }: { item: AnyItem; onToggle: (id: string, next: AnyStatus) => void }) {
  const [loading, setLoading] = useState(false)
  const done = item.status === "concluido"

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    const next: AnyStatus = done ? "planejado" : "concluido"
    try { await onToggle(item.id, next) }
    finally { setLoading(false) }
  }

  return (
      <button
          onClick={handleClick}
          disabled={loading}
          title={done ? "Marcar como pendente" : "Marcar como concluído"}
          className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-md border transition-all duration-150",
              done
                  ? "border-green bg-green text-white"
                  : "border-border bg-transparent text-transparent hover:border-green/60 hover:bg-green/10 hover:text-green/60",
              loading && "opacity-40 cursor-not-allowed"
          )}
      >
        <Check className="size-3 stroke-[2.5]" />
      </button>
  )
}
