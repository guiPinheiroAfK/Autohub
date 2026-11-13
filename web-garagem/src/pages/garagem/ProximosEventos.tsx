import { Link } from "react-router-dom"
import { CalendarDays, ArrowRight, MapPin } from "lucide-react"
import { EVENTOS, TIPO_LABEL, TIPO_COLOR } from "@/data/eventos"
import { isPassado, formatDataBox } from "./helpers"

// ── Preview de próximos eventos ───────────────────────────────────────────────

export function ProximosEventos() {
  const proximos = EVENTOS
    .filter(e => !isPassado(e.data_inicio))
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
    .slice(0, 3)

  if (proximos.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-faint-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
            Próximos eventos
          </span>
        </div>
        <Link
          to="/eventos"
          className="flex items-center gap-1 text-[11px] text-purple hover:underline"
        >
          Ver calendário <ArrowRight className="size-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {proximos.map(evento => {
          const { dia, mes } = formatDataBox(evento.data_inicio)
          return (
            <Link
              key={evento.id}
              to="/eventos"
              className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-3.5 transition-colors hover:border-border-strong"
            >
              {/* Data */}
              <div className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-border bg-surface-2 py-1.5">
                <span className="font-data text-[18px] font-bold leading-none text-foreground">{dia}</span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-faint-foreground">{mes}</span>
              </div>
              {/* Info */}
              <div className="flex min-w-0 flex-col gap-1">
                <span className={`w-fit rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${TIPO_COLOR[evento.tipo]}`}>
                  {TIPO_LABEL[evento.tipo]}
                </span>
                <span className="line-clamp-2 text-[12px] font-medium leading-snug text-foreground">
                  {evento.nome}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-faint-foreground">
                  <MapPin className="size-2.5 shrink-0" />
                  {evento.cidade} · {evento.estado}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
