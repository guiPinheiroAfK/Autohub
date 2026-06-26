import { useState, useMemo } from "react"
import { CalendarDays, MapPin, ExternalLink, Filter } from "lucide-react"
import { EVENTOS, TIPO_LABEL, TIPO_COLOR, type TipoEvento } from "@/data/eventos"
import { cn } from "@/lib/utils"

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
]

function formatData(iso: string) {
  const [, m, d] = iso.split("-")
  return { dia: d, mes: MESES[Number(m) - 1] }
}

function formatDataExibicao(inicio: string, fim?: string): string {
  const i = new Date(inicio + "T12:00:00")
  if (!fim || fim === inicio) {
    return i.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
  }
  const f = new Date(fim + "T12:00:00")
  return `${i.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} – ${f.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`
}

function isPassado(iso: string): boolean {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const data = new Date(iso + "T12:00:00")
  return data < hoje
}

const TIPOS: Array<TipoEvento | "todos"> = ["todos", "racing", "show", "encontro", "rally", "drift", "exposicao"]

const TIPO_LABEL_ALL: Record<TipoEvento | "todos", string> = {
  todos: "Todos",
  ...TIPO_LABEL,
}

export default function EventosPage() {
  const [tipoFiltro, setTipoFiltro] = useState<TipoEvento | "todos">("todos")
  const [mesFiltro, setMesFiltro] = useState<number | null>(null)
  const [mostraPast, setMostraPast] = useState(false)

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const anoAtual = hoje.getFullYear()

  const eventosFiltrados = useMemo(() => {
    return EVENTOS
      .filter(e => {
        if (tipoFiltro !== "todos" && e.tipo !== tipoFiltro) return false
        if (mesFiltro !== null) {
          const mes = Number(e.data_inicio.split("-")[1]) - 1
          if (mes !== mesFiltro) return false
        }
        if (!mostraPast && isPassado(e.data_inicio)) return false
        return true
      })
      .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
  }, [tipoFiltro, mesFiltro, mostraPast])

  const proximos = eventosFiltrados.filter(e => !isPassado(e.data_inicio))
  const passados = eventosFiltrados.filter(e => isPassado(e.data_inicio))

  return (
    <div className="flex flex-col gap-8">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-faint-foreground">
          Calendário
        </div>
        <h1 className="font-display text-[28px] font-semibold leading-tight text-foreground">
          Eventos Automotivos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Shows, corridas, encontros e feiras — {anoAtual} e {anoAtual + 1}
        </p>
      </div>

      {/* ── Filtros ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {/* Tipo */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <Filter className="size-3.5 shrink-0 text-faint-foreground" />
          {TIPOS.map(t => (
            <button
              key={t}
              onClick={() => setTipoFiltro(t)}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                tipoFiltro === t
                  ? t === "todos"
                    ? "border-foreground/30 bg-foreground text-background"
                    : TIPO_COLOR[t as TipoEvento]
                  : "border-border text-faint-foreground hover:border-border-strong hover:text-muted-foreground"
              )}
            >
              {TIPO_LABEL_ALL[t]}
            </button>
          ))}
        </div>

        {/* Mês */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <CalendarDays className="size-3.5 shrink-0 text-faint-foreground" />
          <button
            onClick={() => setMesFiltro(null)}
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
              mesFiltro === null
                ? "border-foreground/30 bg-foreground text-background"
                : "border-border text-faint-foreground hover:border-border-strong"
            )}
          >
            Todos os meses
          </button>
          {MESES.map((m, i) => (
            <button
              key={m}
              onClick={() => setMesFiltro(mesFiltro === i ? null : i)}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                mesFiltro === i
                  ? "border-purple/40 bg-purple-bg text-purple"
                  : "border-border text-faint-foreground hover:border-border-strong"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lista de eventos ──────────────────────────────────────────────── */}
      {proximos.length === 0 && passados.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-20 text-center">
          <CalendarDays className="size-8 text-faint-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum evento encontrado com esses filtros.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {proximos.map(evento => (
            <EventoCard key={evento.id} evento={evento} />
          ))}

          {passados.length > 0 && (
            <>
              <button
                onClick={() => setMostraPast(p => !p)}
                className="flex items-center justify-center gap-1.5 py-2 text-[12px] text-faint-foreground hover:text-muted-foreground"
              >
                {mostraPast ? "▲ Ocultar anteriores" : `▼ Ver ${passados.length} evento${passados.length !== 1 ? "s" : ""} anterior${passados.length !== 1 ? "es" : ""}`}
              </button>
              {mostraPast && passados.map(evento => (
                <EventoCard key={evento.id} evento={evento} passado />
              ))}
            </>
          )}
        </div>
      )}

      <p className="text-center text-[11px] text-faint-foreground">
        Calendário curado manualmente · Datas podem mudar · Confirme no site oficial
      </p>
    </div>
  )
}

function EventoCard({ evento, passado = false }: { evento: (typeof EVENTOS)[0]; passado?: boolean }) {
  const { dia, mes } = formatData(evento.data_inicio)

  return (
    <div className={cn(
      "flex gap-4 rounded-xl border border-border bg-surface p-4 transition-colors",
      passado ? "opacity-50 grayscale" : "hover:border-border-strong"
    )}>
      {/* Data box */}
      <div className="flex w-14 shrink-0 flex-col items-center justify-start rounded-lg border border-border bg-surface-2 py-2.5">
        <span className="font-data text-[22px] font-bold leading-none text-foreground">{dia}</span>
        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint-foreground">{mes}</span>
      </div>

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-medium",
            TIPO_COLOR[evento.tipo]
          )}>
            {TIPO_LABEL[evento.tipo]}
          </span>
          {passado && (
            <span className="text-[10px] text-faint-foreground">Encerrado</span>
          )}
        </div>

        <h3 className="text-[15px] font-semibold leading-snug text-foreground">
          {evento.nome}
        </h3>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            {evento.local ? `${evento.local}, ` : ""}
            {evento.cidade} · {evento.estado}
          </span>
          <span className="text-[12px] text-faint-foreground">
            {formatDataExibicao(evento.data_inicio, evento.data_fim)}
          </span>
        </div>

        <p className="text-[12px] leading-relaxed text-muted-foreground">
          {evento.descricao}
        </p>

        {evento.link && (
          <a
            href={evento.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-fit items-center gap-1 text-[11px] text-purple hover:underline"
          >
            Site oficial <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
  )
}
