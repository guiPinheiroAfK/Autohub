import { diasRestantes } from "./datas"

export function CountdownBadge({ iso }: { iso: string }) {
  const dias = diasRestantes(iso)
  if (dias < 0) return null
  if (dias === 0) return (
    <span className="rounded-full bg-red px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white animate-pulse">
      Hoje!
    </span>
  )
  if (dias === 1) return (
    <span className="rounded-full bg-amber px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
      Amanhã
    </span>
  )
  if (dias <= 7) return (
    <span className="rounded-full border border-amber/40 bg-amber-bg px-2 py-0.5 text-[9px] font-semibold text-amber">
      em {dias} dias
    </span>
  )
  if (dias <= 30) return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[9px] text-faint-foreground">
      em {Math.round(dias / 7)} sem.
    </span>
  )
  return null
}
