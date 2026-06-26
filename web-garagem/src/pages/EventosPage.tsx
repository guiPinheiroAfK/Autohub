import { useState, useMemo } from "react"
import { CalendarDays, MapPin, ExternalLink, Clock, ChevronDown, ChevronUp } from "lucide-react"
import { EVENTOS, TIPO_LABEL, TIPO_COLOR, type TipoEvento, type Evento } from "@/data/eventos"
import { cn } from "@/lib/utils"

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]
const MESES_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]

const TIPO_EMOJI: Record<TipoEvento, string> = {
  racing:    "🏎️",
  show:      "✨",
  encontro:  "🤝",
  rally:     "🏔️",
  drift:     "💨",
  exposicao: "🏛️",
}

function parseData(iso: string) {
  const [ano, mes, dia] = iso.split("-")
  return { ano: Number(ano), mes: Number(mes) - 1, dia: Number(dia) }
}

function isPassado(iso: string): boolean {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return new Date(iso + "T12:00:00") < hoje
}

function diasRestantes(iso: string): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const data = new Date(iso + "T12:00:00")
  return Math.ceil((data.getTime() - hoje.getTime()) / 86_400_000)
}

function formatDataExibicao(inicio: string, fim?: string): string {
  const i = new Date(inicio + "T12:00:00")
  if (!fim || fim === inicio) {
    return i.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
  }
  const f = new Date(fim + "T12:00:00")
  return `${i.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} – ${f.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`
}

function CountdownBadge({ iso }: { iso: string }) {
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

// ── Tipos de filtro ───────────────────────────────────────────────────────────

const TIPOS: Array<TipoEvento | "todos"> = ["todos","racing","drift","rally","show","encontro","exposicao"]
const TIPO_LABEL_ALL: Record<TipoEvento | "todos", string> = { todos: "Todos", ...TIPO_LABEL }

// ── Cards ─────────────────────────────────────────────────────────────────────

function EventoCardDestaque({ evento }: { evento: Evento }) {
  const { dia, mes: mesIdx } = parseData(evento.data_inicio)
  const dias = diasRestantes(evento.data_inicio)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-purple/25 bg-purple-bg p-5">
      {/* Glow decorativo */}
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-purple/10 blur-3xl" />

      <div className="relative flex items-start gap-4">
        {/* Data */}
        <div className="flex w-16 shrink-0 flex-col items-center rounded-xl border border-purple/30 bg-background/60 py-3 backdrop-blur-sm">
          <span className="font-data text-[28px] font-bold leading-none text-purple">{String(dia).padStart(2,"0")}</span>
          <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-purple/70">
            {MESES[mesIdx]}
          </span>
        </div>

        {/* Info */}
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

function EventoCard({ evento, passado = false }: { evento: Evento; passado?: boolean }) {
  const { dia, mes: mesIdx } = parseData(evento.data_inicio)

  return (
    <div className={cn(
      "group flex gap-4 rounded-xl border border-border bg-surface p-4 transition-all",
      passado ? "opacity-40 grayscale" : "hover:border-border-strong hover:shadow-sm"
    )}>
      {/* Data box */}
      <div className="flex w-14 shrink-0 flex-col items-center justify-start rounded-xl border border-border bg-surface-2 py-2.5 transition-colors group-hover:border-purple/20 group-hover:bg-purple-bg/30">
        <span className="font-data text-[22px] font-bold leading-none text-foreground">
          {String(dia).padStart(2,"0")}
        </span>
        <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-faint-foreground">
          {MESES[mesIdx]}
        </span>
      </div>

      {/* Conteúdo */}
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

// ── Página principal ──────────────────────────────────────────────────────────

export default function EventosPage() {
  const [tipoFiltro, setTipoFiltro] = useState<TipoEvento | "todos">("todos")
  const [mesFiltro, setMesFiltro] = useState<number | null>(null)
  const [mostraPast, setMostraPast] = useState(false)

  const hoje = new Date()
  const anoAtual = hoje.getFullYear()

  const eventosFiltrados = useMemo(() => {
    return EVENTOS
      .filter(e => {
        if (tipoFiltro !== "todos" && e.tipo !== tipoFiltro) return false
        if (mesFiltro !== null && Number(e.data_inicio.split("-")[1]) - 1 !== mesFiltro) return false
        if (!mostraPast && isPassado(e.data_inicio)) return false
        return true
      })
      .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
  }, [tipoFiltro, mesFiltro, mostraPast])

  const proximos = eventosFiltrados.filter(e => !isPassado(e.data_inicio))
  const passados = eventosFiltrados.filter(e => isPassado(e.data_inicio))

  // Agrupa próximos por "Mês Ano"
  const porMes = useMemo(() => {
    const grupos: { label: string; eventos: Evento[] }[] = []
    const mapaIndice: Record<string, number> = {}
    for (const e of proximos) {
      const { ano, mes } = parseData(e.data_inicio)
      const chave = `${MESES_FULL[mes]} ${ano}`
      if (mapaIndice[chave] === undefined) {
        mapaIndice[chave] = grupos.length
        grupos.push({ label: chave, eventos: [] })
      }
      grupos[mapaIndice[chave]].eventos.push(e)
    }
    return grupos
  }, [proximos])

  // Primeiro evento futuro (para o card de destaque)
  const proximoEvento = proximos[0] ?? null
  const proximosSemPrimeiro = proximos.slice(1)

  const mesAtivos = useMemo(() => {
    return [...new Set(EVENTOS.map(e => Number(e.data_inicio.split("-")[1]) - 1))].sort((a,b) => a-b)
  }, [])

  return (
    <div className="flex flex-col gap-8">

      {/* ── Header ────────────────────────────────────────────────────── */}
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

      {/* ── Card de destaque (próximo evento) ─────────────────────────── */}
      {proximoEvento && tipoFiltro === "todos" && mesFiltro === null && (
        <EventoCardDestaque evento={proximoEvento} />
      )}

      {/* ── Filtros (sticky) ──────────────────────────────────────────── */}
      <div className="sticky top-[57px] z-30 -mx-6 bg-background/90 px-6 pb-3 pt-2 backdrop-blur-md border-b border-border">
        {/* Tipo */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {TIPOS.map(t => (
            <button
              key={t}
              onClick={() => setTipoFiltro(t)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                tipoFiltro === t
                  ? t === "todos"
                    ? "border-foreground/30 bg-foreground text-background"
                    : TIPO_COLOR[t as TipoEvento]
                  : "border-border text-faint-foreground hover:border-border-strong hover:text-muted-foreground"
              )}
            >
              {t !== "todos" ? `${TIPO_EMOJI[t as TipoEvento]} ` : ""}{TIPO_LABEL_ALL[t]}
            </button>
          ))}
        </div>

        {/* Meses com eventos */}
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
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
            Todos
          </button>
          {mesAtivos.map(i => (
            <button
              key={i}
              onClick={() => setMesFiltro(mesFiltro === i ? null : i)}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                mesFiltro === i
                  ? "border-purple/40 bg-purple-bg text-purple"
                  : "border-border text-faint-foreground hover:border-border-strong"
              )}
            >
              {MESES[i]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Conteúdo ──────────────────────────────────────────────────── */}
      {proximos.length === 0 && passados.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <CalendarDays className="size-8 text-faint-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum evento com esses filtros.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">

          {/* Próximos agrupados por mês */}
          {porMes.map(({ label, eventos }) => {
            // Se só tiver o card de destaque e não há filtro, pula o primeiro grupo
            const eventosVisiveis =
              tipoFiltro === "todos" && mesFiltro === null && proximoEvento
                ? eventos.filter(e => e.id !== proximoEvento.id)
                : eventos
            if (eventosVisiveis.length === 0) return null
            return (
              <div key={label} className="flex flex-col gap-3">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint-foreground">
                  {label}
                </h2>
                {eventosVisiveis.map(e => <EventoCard key={e.id} evento={e} />)}
              </div>
            )
          })}

          {/* Lista flat quando há filtro ativo */}
          {tipoFiltro !== "todos" || mesFiltro !== null ? (
            <div className="flex flex-col gap-3">
              {proximosSemPrimeiro.map(e => <EventoCard key={e.id} evento={e} />)}
            </div>
          ) : null}

          {/* Passados */}
          {passados.length > 0 && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setMostraPast(p => !p)}
                className="flex items-center gap-2 py-1 text-[12px] text-faint-foreground hover:text-muted-foreground"
              >
                {mostraPast ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                {mostraPast
                  ? "Ocultar eventos anteriores"
                  : `${passados.length} evento${passados.length !== 1 ? "s" : ""} anterior${passados.length !== 1 ? "es" : ""}`}
              </button>
              {mostraPast && passados.map(e => <EventoCard key={e.id} evento={e} passado />)}
            </div>
          )}
        </div>
      )}

      <p className="text-center text-[11px] text-faint-foreground">
        Calendário curado manualmente · Datas podem mudar · Confirme no site oficial
      </p>
    </div>
  )
}
