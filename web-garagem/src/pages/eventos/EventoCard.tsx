import { MapPin, ExternalLink } from "lucide-react"
import { TIPO_COLOR, TIPO_LABEL, type Evento } from "@/data/eventos"
import { cn } from "@/lib/utils"
import { MESES, TIPO_EMOJI } from "./constants"
import { parseData, formatDataExibicao } from "./datas"
import { CountdownBadge } from "./CountdownBadge"

export function EventoCard({ evento, passado = false }: { evento: Evento; passado?: boolean }) {
  const { dia, mes: mesIdx } = parseData(evento.data_inicio)

  return (
    <div className={cn(
      "group flex gap-4 rounded-xl border border-border bg-surface p-4 transition-all",
      passado ? "opacity-40 grayscale" : "hover:border-border-strong hover:shadow-sm"
    )}>
      <div className="flex w-14 shrink-0 flex-col items-center justify-start rounded-xl border border-border bg-surface-2 py-2.5 transition-colors group-hover:border-purple/20 group-hover:bg-purple-bg/30">
        <span className="font-data text-[22px] font-bold leading-none text-foreground">
          {String(dia).padStart(2,"0")}
        </span>
        <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-faint-foreground">
          {MESES[mesIdx]}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", TIPO_COLOR[evento.tipo])}>
            {TIPO_EMOJI[evento.tipo]} {TIPO_LABEL[evento.tipo]}
          </span>
          {!passado && <CountdownBadge iso={evento.data_inicio} />}
          {passado && <span className="text-[10px] text-faint-foreground">Encerrado</span>}
        </div>

        <h3 className="text-[14px] font-semibold leading-snug text-foreground">
          {evento.nome}
        </h3>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            {evento.local ? `${evento.local}, ` : ""}{evento.cidade} · {evento.estado}
          </span>
          <span className="text-[11px] text-faint-foreground">
            {formatDataExibicao(evento.data_inicio, evento.data_fim)}
          </span>
        </div>

        <p className="text-[12px] leading-relaxed text-muted-foreground line-clamp-2">
          {evento.descricao}
        </p>

        {evento.link && (
          <a href={evento.link} target="_blank" rel="noopener noreferrer"
             className="flex w-fit items-center gap-1 text-[11px] text-purple hover:underline">
            Site oficial <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
  )
}
