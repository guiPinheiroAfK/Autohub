import { useState } from "react"
import { CalendarDays, Plus, ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { EVENTOS, TIPO_COLOR, type TipoEvento } from "@/data/eventos"
import { useAuth } from "@/context/AuthContext"
import { cn } from "@/lib/utils"
import { MESES, TIPO_EMOJI, TIPOS, TIPO_LABEL_ALL, COR_CLASS } from "@/pages/eventos/constants"
import { parseData, isPassado } from "@/pages/eventos/datas"
import { EventoCardDestaque } from "@/pages/eventos/EventoCardDestaque"
import { EventoCard } from "@/pages/eventos/EventoCard"
import { EventoDBCard } from "@/pages/eventos/EventoDBCard"
import { CountdownBadge } from "@/pages/eventos/CountdownBadge"
import { ModalCriarEvento } from "@/pages/eventos/ModalCriarEvento"
import { ModalEventoPessoal } from "@/pages/eventos/ModalEventoPessoal"
import { useEventosDB } from "@/pages/eventos/useEventosDB"
import { usePessoais } from "@/pages/eventos/usePessoais"
import { useFiltrosEventos } from "@/pages/eventos/useFiltrosEventos"

// ── Página principal ──────────────────────────────────────────────────────────

export default function EventosPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<"publico" | "pessoal">("publico")
  const [modalPublico, setModalPublico] = useState(false)
  const [modalPessoal, setModalPessoal] = useState(false)

  const { pessoais, reloadPessoais, deletarPessoal } = usePessoais()
  const { eventosDB, loadingDB, carregarEventosDB } = useEventosDB()
  const {
    tipoFiltro, setTipoFiltro, mesFiltro, setMesFiltro, mostraPast, setMostraPast,
    proximos, passados, porMes, proximoEvento, mesAtivos,
  } = useFiltrosEventos()

  const anoAtual = new Date().getFullYear()

  // Merge DB events with static for counting display purposes
  const totalPublicos = EVENTOS.length + eventosDB.length

  return (
    <div className="flex flex-col gap-8">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-faint-foreground">
            Calendário
          </div>
          <h1 className="font-display text-[28px] font-semibold leading-tight text-foreground">
            Eventos Automotivos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Shows, corridas, encontros e feiras — {anoAtual} e {anoAtual + 1} · {totalPublicos} eventos
          </p>
        </div>

        {user && (
          <button
            onClick={() => tab === "pessoal" ? setModalPessoal(true) : setModalPublico(true)}
            className="flex items-center gap-1.5 rounded-lg bg-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="size-4" />
            {tab === "pessoal" ? "Lembrete" : "Adicionar evento"}
          </button>
        )}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-lg border border-border bg-background p-1 w-fit">
        {([
          { v: "publico", l: "Público" },
          { v: "pessoal", l: `Meu Calendário${pessoais.length > 0 ? ` (${pessoais.length})` : ""}` },
        ] as const).map(t => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={cn(
              "rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors",
              tab === t.v
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.l}
          </button>
        ))}
      </div>

      {/* ── Tab Público ───────────────────────────────────────────────── */}
      {tab === "publico" && (
        <>
          {/* DB events section */}
          {!loadingDB && eventosDB.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint-foreground">
                  Eventos da comunidade
                </h2>
                <span className="rounded-full bg-purple-bg px-2 py-0.5 text-[10px] font-semibold text-purple">
                  {eventosDB.length}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {eventosDB.map(e => <EventoDBCard key={e.id} evento={e} />)}
              </div>
              <div className="my-2 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">Calendário curado</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
          )}

          {/* Card de destaque (próximo evento) */}
          {proximoEvento && tipoFiltro === "todos" && mesFiltro === null && (
            <EventoCardDestaque evento={proximoEvento} />
          )}

          {/* Filtros (sticky) */}
          <div className="sticky top-[57px] z-30 -mx-6 bg-background/90 px-6 pb-3 pt-2 backdrop-blur-md border-b border-border">
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

          {/* Conteúdo curado */}
          {proximos.length === 0 && passados.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <CalendarDays className="size-8 text-faint-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum evento com esses filtros.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {porMes.map(({ label, eventos }) => {
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
        </>
      )}

      {/* ── Tab Meu Calendário ────────────────────────────────────────── */}
      {tab === "pessoal" && (
        <div className="flex flex-col gap-4">
          {pessoais.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-20 text-center">
              <CalendarDays className="size-10 text-faint-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Nenhum lembrete ainda</p>
                <p className="mt-1 text-sm text-muted-foreground">Adicione eventos e lembretes pessoais ao seu calendário</p>
              </div>
              <button
                onClick={() => setModalPessoal(true)}
                className="flex items-center gap-1.5 rounded-lg bg-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                <Plus className="size-4" /> Adicionar lembrete
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pessoais
                .sort((a, b) => a.data.localeCompare(b.data))
                .map(e => {
                  const { dia, mes: mesIdx } = parseData(e.data)
                  const passado = isPassado(e.data)
                  return (
                    <div
                      key={e.id}
                      className={cn(
                        "flex items-start gap-4 rounded-xl border p-4 transition-all",
                        COR_CLASS[e.cor],
                        passado && "opacity-50 grayscale"
                      )}
                    >
                      <div className="flex w-12 shrink-0 flex-col items-center rounded-xl border border-current/20 bg-background/20 py-2">
                        <span className="font-data text-[20px] font-bold leading-none">
                          {String(dia).padStart(2,"0")}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider">
                          {MESES[mesIdx]}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-foreground">{e.titulo}</p>
                        {e.nota && <p className="mt-0.5 text-[12px] text-muted-foreground">{e.nota}</p>}
                        {!passado && <CountdownBadge iso={e.data} />}
                        {passado && <span className="text-[10px] text-faint-foreground">Encerrado</span>}
                      </div>

                      <button
                        onClick={() => deletarPessoal(e.id)}
                        className="shrink-0 text-faint-foreground hover:text-red transition-colors"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      {modalPublico && user && (
        <ModalCriarEvento
          onClose={() => setModalPublico(false)}
          onCreated={() => { carregarEventosDB() }}
        />
      )}

      {modalPessoal && (
        <ModalEventoPessoal
          onClose={() => setModalPessoal(false)}
          onCreated={reloadPessoais}
        />
      )}
    </div>
  )
}
