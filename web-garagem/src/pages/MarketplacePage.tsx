import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { Search, Plus, X, Tag, MapPin, Clock, ShoppingBag, Check, ChevronDown } from "lucide-react"
import { api } from "@/lib/api/client"
import { useAuth } from "@/context/AuthContext"
import { cn } from "@/lib/utils"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Anuncio {
  id: string
  titulo: string
  descricao?: string
  preco?: number
  moeda: "BRL" | "USD" | "PYG"
  categoria: string
  condicao: "novo" | "usado" | "recondicionado"
  localizacao?: string
  status: "ativo" | "pausado" | "vendido"
  criado_em: string
  garagem_id: string
  garagem_nome: string
  garagem_slug: string
  vendedor_nome: string
}

type Moeda = "BRL" | "USD" | "PYG"

const CATEGORIAS: Record<string, string> = {
  motor: "Motor",
  suspensao: "Suspensão",
  freios: "Freios",
  eletrica: "Elétrica",
  carroceria: "Carroceria",
  rodas: "Rodas",
  interior: "Interior",
  acessorios: "Acessórios",
  veiculo_completo: "Veículo Completo",
  outro: "Outro",
}

const CONDICAO_LABEL: Record<string, string> = {
  novo: "Novo",
  usado: "Usado",
  recondicionado: "Recondicionado",
}

const CONDICAO_COLOR: Record<string, string> = {
  novo: "text-green bg-green-bg",
  usado: "text-amber bg-amber-bg",
  recondicionado: "text-purple bg-purple-bg",
}

const MOEDAS: Moeda[] = ["BRL", "USD", "PYG"]

function formatPreco(preco: number | undefined, moeda: Moeda) {
  if (!preco) return "A combinar"
  if (moeda === "BRL") return `R$ ${preco.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`
  if (moeda === "USD") return `US$ ${preco.toLocaleString("en-US", { minimumFractionDigits: 0 })}`
  if (moeda === "PYG") return `₲ ${preco.toLocaleString("es-PY", { minimumFractionDigits: 0 })}`
  return `${preco}`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return "hoje"
  if (d === 1) return "ontem"
  if (d < 30) return `${d} dias atrás`
  return `${Math.floor(d / 30)} meses atrás`
}

// ── Card de anúncio ──────────────────────────────────────────────────────────

function AnuncioCard({ a, onStatusChange }: { a: Anuncio; onStatusChange?: (id: string, status: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="truncate text-[14px] font-semibold text-foreground">{a.titulo}</h3>
          {a.descricao && (
            <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{a.descricao}</p>
          )}
        </div>
        {onStatusChange && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-faint-foreground hover:bg-surface-2"
            >
              ⋯ <ChevronDown className="size-3" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border border-border bg-surface p-1 shadow-lg">
                  {["ativo", "pausado", "vendido"].map(s => (
                    <button
                      key={s}
                      onClick={() => { onStatusChange(a.id, s); setMenuOpen(false) }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-surface-2",
                        a.status === s ? "font-semibold text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {a.status === s && <Check className="size-3" />}
                      {s === "ativo" ? "Ativo" : s === "pausado" ? "Pausado" : "Vendido"}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", CONDICAO_COLOR[a.condicao])}>
          {CONDICAO_LABEL[a.condicao]}
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
          {CATEGORIAS[a.categoria] ?? a.categoria}
        </span>
        {a.status !== "ativo" && (
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            a.status === "vendido" ? "bg-green-bg text-green" : "bg-surface-2 text-faint-foreground"
          )}>
            {a.status === "vendido" ? "Vendido" : "Pausado"}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="font-data text-[17px] font-bold text-foreground">
          {formatPreco(a.preco, a.moeda)}
        </span>
        {a.localizacao && (
          <div className="flex items-center gap-1 text-[11px] text-faint-foreground">
            <MapPin className="size-3" />
            {a.localizacao}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border/50 pt-2.5">
        <Link
          to={`/g/${a.garagem_slug}`}
          className="text-[11px] text-purple hover:underline truncate"
        >
          {a.garagem_nome}
        </Link>
        <span className="flex items-center gap-1 text-[10px] text-faint-foreground shrink-0">
          <Clock className="size-3" />
          {timeAgo(a.criado_em)}
        </span>
      </div>
    </div>
  )
}

// ── Drawer de novo anúncio ────────────────────────────────────────────────────

const CATEGORIAS_ARRAY = Object.entries(CATEGORIAS)

function NovoAnuncioDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [titulo, setTitulo] = useState("")
  const [descricao, setDescricao] = useState("")
  const [preco, setPreco] = useState("")
  const [moeda, setMoeda] = useState<Moeda>("BRL")
  const [categoria, setCategoria] = useState("outro")
  const [condicao, setCondicao] = useState("usado")
  const [localizacao, setLocalizacao] = useState("")
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (titulo.trim().length < 3) { setErro("Título muito curto."); return }
    setSaving(true); setErro("")
    try {
      await api.post("/api/marketplace", {
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        preco: preco ? Number(preco) : undefined,
        moeda,
        categoria,
        condicao,
        localizacao: localizacao.trim() || undefined,
      })
      onCreated()
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar anúncio")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-0 rounded-t-2xl border-t border-border bg-surface shadow-xl sm:bottom-auto sm:left-auto sm:right-8 sm:top-20 sm:w-[460px] sm:rounded-2xl sm:border">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-base font-semibold text-foreground">Novo anúncio</h2>
          <button onClick={onClose} className="text-faint-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto p-5" style={{ maxHeight: "80vh" }}>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Título *</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Kit turbo GT2860RS completo"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Descrição</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Descreva o estado, características, o que está incluído..."
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Preço</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={preco}
                onChange={e => setPreco(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Moeda</label>
              <select
                value={moeda}
                onChange={e => setMoeda(e.target.value as Moeda)}
                className="rounded-lg border border-border bg-background px-2 py-2 text-[13px] text-foreground focus:border-purple/50 focus:outline-none"
              >
                {MOEDAS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Categoria *</label>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:border-purple/50 focus:outline-none"
              >
                {CATEGORIAS_ARRAY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Condição *</label>
              <select
                value={condicao}
                onChange={e => setCondicao(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:border-purple/50 focus:outline-none"
              >
                <option value="novo">Novo</option>
                <option value="usado">Usado</option>
                <option value="recondicionado">Recondicionado</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Localização</label>
            <input
              value={localizacao}
              onChange={e => setLocalizacao(e.target.value)}
              placeholder="Ex: São Paulo - SP"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
            />
          </div>

          {erro && <p className="rounded-lg bg-red-bg px-3 py-2 text-[12px] text-red">{erro}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border py-2.5 text-[13px] text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-purple py-2.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Publicando..." : "Publicar anúncio"}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

const POR_PAGINA = 18

export default function MarketplacePage() {
  const { user } = useAuth()

  const [anuncios, setAnuncios] = useState<Anuncio[]>([])
  const [meusAnuncios, setMeusAnuncios] = useState<Anuncio[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(0)
  const [loading, setLoading] = useState(true)

  const [busca, setBusca] = useState("")
  const [categFiltro, setCategFiltro] = useState("")
  const [condicaoFiltro, setCondicaoFiltro] = useState("")
  const [tab, setTab] = useState<"todos" | "meus">("todos")

  const [criandoAnuncio, setCriandoAnuncio] = useState(false)

  const carregar = useCallback((pg = 0, q = busca, cat = categFiltro, cond = condicaoFiltro) => {
    setLoading(true)
    const params = new URLSearchParams({
      limit: String(POR_PAGINA),
      offset: String(pg * POR_PAGINA),
      ...(q && { q }),
      ...(cat && { categoria: cat }),
      ...(cond && { condicao: cond }),
    })
    api.get<{ anuncios: Anuncio[]; total: number }>(`/marketplace?${params}`)
      .then(r => { setAnuncios(r.anuncios); setTotal(r.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [busca, categFiltro, condicaoFiltro])

  function carregarMeus() {
    api.get<{ anuncios: Anuncio[] }>("/api/marketplace/meus")
      .then(r => setMeusAnuncios(r.anuncios))
      .catch(() => {})
  }

  useEffect(() => { carregar(0) }, [])
  useEffect(() => { if (user) carregarMeus() }, [user])

  function handleBusca(e: React.FormEvent) {
    e.preventDefault()
    setPagina(0)
    carregar(0)
  }

  function handleFiltro(cat: string, cond: string) {
    setCategFiltro(cat)
    setCondicaoFiltro(cond)
    setPagina(0)
    carregar(0, busca, cat, cond)
  }

  async function handleStatusChange(id: string, status: string) {
    await api.patch(`/api/marketplace/${id}/status`, { status })
    setMeusAnuncios(prev => prev.map(a => a.id === id ? { ...a, status: status as Anuncio["status"] } : a))
  }

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-faint-foreground">
            Comunidade
          </div>
          <h1 className="font-display text-[28px] font-semibold leading-tight text-foreground">
            Marketplace
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Peças, acessórios e veículos da comunidade AutoHub
          </p>
        </div>

        {user && (
          <button
            onClick={() => setCriandoAnuncio(true)}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-purple px-4 py-2.5 text-[13px] font-semibold text-white hover:opacity-90"
          >
            <Plus className="size-4" />
            Anunciar
          </button>
        )}
      </div>

      {/* Tabs meus / todos */}
      {user && (
        <div className="flex gap-1 rounded-lg border border-border bg-background p-1 w-fit">
          {[{ v: "todos", l: "Todos os anúncios" }, { v: "meus", l: "Meus anúncios" }].map(t => (
            <button
              key={t.v}
              onClick={() => setTab(t.v as "todos" | "meus")}
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
      )}

      {tab === "todos" && (
        <>
          {/* Busca + filtros */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <form onSubmit={handleBusca} className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint-foreground" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar peças, acessórios..."
                className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-4 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
              />
            </form>

            <select
              value={categFiltro}
              onChange={e => handleFiltro(e.target.value, condicaoFiltro)}
              className="rounded-xl border border-border bg-surface px-3 py-2.5 text-[13px] text-foreground focus:border-purple/50 focus:outline-none"
            >
              <option value="">Todas as categorias</option>
              {CATEGORIAS_ARRAY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>

            <select
              value={condicaoFiltro}
              onChange={e => handleFiltro(categFiltro, e.target.value)}
              className="rounded-xl border border-border bg-surface px-3 py-2.5 text-[13px] text-foreground focus:border-purple/50 focus:outline-none"
            >
              <option value="">Qualquer condição</option>
              <option value="novo">Novo</option>
              <option value="usado">Usado</option>
              <option value="recondicionado">Recondicionado</option>
            </select>

            {(categFiltro || condicaoFiltro || busca) && (
              <button
                onClick={() => { setBusca(""); handleFiltro("", "") }}
                className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" /> Limpar
              </button>
            )}
          </div>

          {/* Grade */}
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-44 animate-pulse rounded-xl bg-surface" />
              ))}
            </div>
          ) : anuncios.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <ShoppingBag className="size-10 text-faint-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum anúncio encontrado.</p>
              {user && (
                <button
                  onClick={() => setCriandoAnuncio(true)}
                  className="text-sm text-purple hover:underline"
                >
                  Ser o primeiro a anunciar
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {anuncios.map(a => <AnuncioCard key={a.id} a={a} />)}
            </div>
          )}

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                disabled={pagina === 0}
                onClick={() => { const p = pagina - 1; setPagina(p); carregar(p) }}
                className="rounded-lg border border-border px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-[13px] text-muted-foreground">
                {pagina + 1} / {totalPaginas}
              </span>
              <button
                disabled={pagina >= totalPaginas - 1}
                onClick={() => { const p = pagina + 1; setPagina(p); carregar(p) }}
                className="rounded-lg border border-border px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          )}

          {total > 0 && (
            <p className="text-center text-[11px] text-faint-foreground">
              {total} anúncio{total !== 1 && "s"} encontrado{total !== 1 && "s"}
            </p>
          )}
        </>
      )}

      {tab === "meus" && user && (
        <div className="flex flex-col gap-4">
          {meusAnuncios.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <Tag className="size-10 text-faint-foreground" />
              <p className="text-sm text-muted-foreground">Você ainda não tem anúncios.</p>
              <button
                onClick={() => setCriandoAnuncio(true)}
                className="text-sm text-purple hover:underline"
              >
                Criar primeiro anúncio
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {meusAnuncios.map(a => (
                <AnuncioCard key={a.id} a={a} onStatusChange={handleStatusChange} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drawer de novo anúncio */}
      {criandoAnuncio && (
        <NovoAnuncioDrawer
          onClose={() => setCriandoAnuncio(false)}
          onCreated={() => {
            carregarMeus()
            if (tab === "todos") carregar(0)
          }}
        />
      )}
    </div>
  )
}
