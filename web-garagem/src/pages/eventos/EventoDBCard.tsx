import { MapPin, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { MESES } from "./constants"
import { parseData } from "./datas"
import { CountdownBadge } from "./CountdownBadge"
import type { EventoDB } from "./types"

export function EventoDBCard({ evento }: { evento: EventoDB }) {
  const { dia, mes: mesIdx } = parseData(evento.data_inicio)

  return (
    <div className={cn(
      "group flex gap-4 rounded-xl border bg-surface p-4 transition-all hover:border-border-strong",
      evento.patrocinado ? "border-amber/30" : "border-border"
    )}>
      {evento.patrocinado && (
        <div className="absolute right-3 top-3 rounded-full border border-amber/30 bg-amber-bg px-2 py-0.5 text-[10px] font-semibold text-amber">
          ⭐ Destaque
        </div>
      )}
      <div className="flex w-14 shrink-0 flex-col items-center justify-start rounded-xl border border-border bg-surface-2 py-2.5">
        <span className="font-data text-[22px] font-bold leading-none text-foreground">
          {String(dia).padStart(2,"0")}
        </span>
        <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-faint-foreground">
          {MESES[mesIdx]}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
            {evento.tipo}
          </span>
          <CountdownBadge iso={evento.data_inicio} />
        </div>

        <h3 className="text-[14px] font-semibold leading-snug text-foreground">{evento.titulo}</h3>

        {evento.local && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            {evento.local}
          </span>
        )}

        {evento.descricao && (
          <p className="text-[12px] leading-relaxed text-muted-foreground line-clamp-2">{evento.descricao}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {evento.url && (
            <a href={evento.url} target="_blank" rel="noopener noreferrer"
               className="flex w-fit items-center gap-1 text-[11px] text-purple hover:underline">
              Site oficial <ExternalLink className="size-3" />
            </a>
          )}
          {evento.criado_por_nome && (
            <span className="text-[10px] text-faint-foreground">por {evento.criado_por_nome}</span>
          )}
        </div>
      </div>
    </div>
  )
}
