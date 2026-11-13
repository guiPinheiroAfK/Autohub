import { MapPin, ExternalLink, Clock } from "lucide-react"
import { TIPO_COLOR, TIPO_LABEL, type Evento } from "@/data/eventos"
import { cn } from "@/lib/utils"
import { MESES, TIPO_EMOJI } from "./constants"
import { parseData, diasRestantes, formatDataExibicao } from "./datas"
import { CountdownBadge } from "./CountdownBadge"

export function EventoCardDestaque({ evento }: { evento: Evento }) {
  const { dia, mes: mesIdx } = parseData(evento.data_inicio)
  const dias = diasRestantes(evento.data_inicio)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-purple/25 bg-purple-bg p-5">
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-purple/10 blur-3xl" />

      <div className="relative flex items-start gap-4">
        <div className="flex w-16 shrink-0 flex-col items-center rounded-xl border border-purple/30 bg-background/60 py-3 backdrop-blur-sm">
          <span className="font-data text-[28px] font-bold leading-none text-purple">{String(dia).padStart(2,"0")}</span>
          <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-purple/70">
            {MESES[mesIdx]}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", TIPO_COLOR[evento.tipo])}>
              {TIPO_EMOJI[evento.tipo]} {TIPO_LABEL[evento.tipo]}
            </span>
            {dias >= 0 && <CountdownBadge iso={evento.data_inicio} />}
            <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-purple/60">
              Próximo
            </span>
          </div>

          <h2 className="font-display text-[17px] font-bold leading-snug text-foreground">
            {evento.nome}
          </h2>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
              <MapPin className="size-3 shrink-0 text-purple" />
              {evento.local ? `${evento.local}, ` : ""}{evento.cidade} · {evento.estado}
            </span>
            <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
              <Clock className="size-3 shrink-0" />
              {formatDataExibicao(evento.data_inicio, evento.data_fim)}
            </span>
          </div>

          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground line-clamp-2">
            {evento.descricao}
          </p>

          {evento.link && (
            <a href={evento.link} target="_blank" rel="noopener noreferrer"
               className="mt-2.5 flex w-fit items-center gap-1 text-[11px] font-medium text-purple hover:underline">
              Site oficial <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
