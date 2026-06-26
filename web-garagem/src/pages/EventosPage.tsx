import { useState, useMemo, useEffect } from "react"
import { CalendarDays, MapPin, ExternalLink, Clock, ChevronDown, ChevronUp, Plus, X, Trash2 } from "lucide-react"
import { EVENTOS, TIPO_LABEL, TIPO_COLOR, type TipoEvento, type Evento } from "@/data/eventos"
import { api } from "@/lib/api/client"
import { useAuth } from "@/context/AuthContext"
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

// ── EventoDB type ─────────────────────────────────────────────────────────────

interface EventoDB {
  id: string
  titulo: string
  descricao?: string | null
  data_inicio: string
  data_fim?: string | null
  local?: string | null
  url?: string | null
  tipo: string
  patrocinado: boolean
  garagem_nome?: string | null
  garagem_slug?: string | null
  criado_por_nome?: string | null
}

// ── Personal event type ───────────────────────────────────────────────────────

interface EventoPessoal {
  id: string
  titulo: string
  data: string
  nota?: string
  cor: "purple" | "amber" | "green" | "red"
}

const STORAGE_KEY = "autohub_eventos_pessoais"

function getPessoais(): EventoPessoal[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
  } catch {
    return []
  }
}

function savePessoais(eventos: EventoPessoal[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(eventos))
}

// ── COR de evento pessoal ─────────────────────────────────────────────────────

const COR_CLASS: Record<EventoPessoal["cor"], string> = {
  purple: "border-purple/30 bg-purple-bg text-purple",
  amber:  "border-amber/30  bg-amber-bg  text-amber",
  green:  "border-green/30  bg-green-bg  text-green",
  red:    "border-red/30    bg-red-bg    text-red",
}

// ── Cards ─────────────────────────────────────────────────────────────────────

function EventoCardDestaque({ evento }: { evento: Evento }) {
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

function EventoCard({ evento, passado = false }: { evento: Evento; passado?: boolean }) {
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

function EventoDBCard({ evento }: { evento: EventoDB }) {
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

// ── Modal de criar evento público ─────────────────────────────────────────────

function ModalCriarEvento({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [titulo, setTitulo] = useState("")
  const [descricao, setDescricao] = useState("")
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")
  const [local, setLocal] = useState("")
  const [url, setUrl] = useState("")
  const [tipo, setTipo] = useState("encontro")
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState("")

  const TIPOS_DB = ["encontro","corrida","rally","drift","exposicao","show"]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !dataInicio) { setErro("Preencha título e data."); return }
    setSaving(true); setErro("")
    try {
      await api.post("/api/eventos-calendario", {
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        dataInicio,
        dataFim: dataFim || undefined,
        local: local.trim() || undefined,
        url: url.trim() || undefined,
        tipo,
      })
      onCreated()
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar evento")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-base font-semibold text-foreground">Adicionar evento público</h2>
          <button onClick={onClose} className="text-faint-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5 max-h-[80vh] overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Título *</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Encontro de Japoneses SP"
              maxLength={150}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
              required
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Data início *</label>
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:border-purple/50 focus:outline-none"
                required
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Data fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                min={dataInicio}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:border-purple/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Tipo</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:border-purple/50 focus:outline-none"
              >
                {TIPOS_DB.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Local</label>
              <input
                value={local}
                onChange={e => setLocal(e.target.value)}
                placeholder="Ex: Autódromo de Interlagos, SP"
                maxLength={150}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Descrição</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Detalhes sobre o evento..."
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Link / site oficial</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
            />
          </div>

          {erro && <p className="rounded-lg bg-red-bg px-3 py-2 text-[12px] text-red">{erro}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border py-2.5 text-[13px] text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-purple py-2.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {saving ? "Publicando..." : "Publicar evento"}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// ── Modal de criar evento pessoal ─────────────────────────────────────────────

function ModalEventoPessoal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [titulo, setTitulo] = useState("")
  const [data, setData] = useState("")
  const [nota, setNota] = useState("")
  const [cor, setCor] = useState<EventoPessoal["cor"]>("purple")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !data) return
    const pessoais = getPessoais()
    pessoais.push({ id: crypto.randomUUID(), titulo: titulo.trim(), data, nota: nota.trim() || undefined, cor })
    savePessoais(pessoais)
    onCreated()
    onClose()
  }

  const CORES: EventoPessoal["cor"][] = ["purple", "amber", "green", "red"]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-base font-semibold text-foreground">Lembrete pessoal</h2>
          <button onClick={onClose} className="text-faint-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Evento *</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Revisar freios antes do encontro"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Data *</label>
            <input
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:border-purple/50 focus:outline-none"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Nota</label>
            <input
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Observações..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Cor</label>
            <div className="flex gap-2">
              {CORES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  className={cn(
                    "flex-1 rounded-lg border py-1.5 text-[11px] font-medium transition-colors capitalize",
                    COR_CLASS[c],
                    cor !== c && "opacity-40"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border py-2.5 text-[13px] text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
            <button type="submit" className="flex-1 rounded-lg bg-purple py-2.5 text-[13px] font-semibold text-white hover:opacity-90">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function EventosPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<"publico" | "pessoal">("publico")
  const [tipoFiltro, setTipoFiltro] = useState<TipoEvento | "todos">("todos")
  const [mesFiltro, setMesFiltro] = useState<number | null>(null)
  const [mostraPast, setMostraPast] = useState(false)
  const [modalPublico, setModalPublico] = useState(false)
  const [modalPessoal, setModalPessoal] = useState(false)

  // DB events
  const [eventosDB, setEventosDB] = useState<EventoDB[]>([])
  const [loadingDB, setLoadingDB] = useState(true)

  // Personal events
  const [pessoais, setPessoais] = useState<EventoPessoal[]>([])

  useEffect(() => {
    setPessoais(getPessoais())
  }, [])

  function reloadPessoais() {
    setPessoais(getPessoais())
  }

  function deletarPessoal(id: string) {
    const novos = getPessoais().filter(e => e.id !== id)
    savePessoais(novos)
    setPessoais(novos)
  }

  function carregarEventosDB() {
    setLoadingDB(true)
    api.get<{ eventos: EventoDB[] }>("/api/eventos-calendario")
      .then(r => setEventosDB(r.eventos ?? []))
      .catch(() => {})
      .finally(() => setLoadingDB(false))
  }

  useEffect(() => {
    carregarEventosDB()
  }, [])

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

  const proximoEvento = proximos[0] ?? null

  const mesAtivos = useMemo(() => {
    return [...new Set(EVENTOS.map(e => Number(e.data_inicio.split("-")[1]) - 1))].sort((a,b) => a-b)
  }, [])

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
