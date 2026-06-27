import { useEffect, useState, useCallback } from "react"
import { Link } from "react-router-dom"
import { Wrench, TrendingUp, Users, Clock, MessageCircle } from "lucide-react"
import { api } from "@/lib/api/client"

interface VeiculoFeed {
  id: string
  apelido: string
  marca: string
  modelo: string
  ano_fabricacao: number
  perfil: string
  status: string
  capa_url: string | null
  criado_em: string
  garagem_slug: string
  garagem_nome: string
  dono_nome: string
  dono_avatar: string | null
  total_fases: number
  total_itens: number
  itens_concluidos: number
  total_comentarios: number
}

const PERFIL_LABEL: Record<string, string> = {
  daily: "Daily", street_build: "Street Build", restomod: "Restomod",
  track: "Track", project: "Project Car",
}

const STATUS_COLOR: Record<string, string> = {
  planejamento: "text-faint-foreground border-border",
  em_andamento: "text-amber border-amber/30 bg-amber-bg",
  concluido: "text-green border-green/30 bg-green-bg",
  pausado: "text-red border-red/20",
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return "hoje"
  if (d === 1) return "ontem"
  if (d < 7) return `${d} dias atrás`
  if (d < 30) return `${Math.floor(d / 7)} sem. atrás`
  return `${Math.floor(d / 30)} meses atrás`
}

function BuildCard({ v }: { v: VeiculoFeed }) {
  const progresso = v.total_itens > 0
    ? Math.round((v.itens_concluidos / v.total_itens) * 100)
    : 0

  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-surface transition-all hover:border-border-strong hover:shadow-sm">
      {v.capa_url ? (
        <img src={v.capa_url} alt={v.apelido} className="h-44 w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-44 items-center justify-center bg-surface-2 text-5xl">🚗</div>
      )}

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-[15px] font-bold text-foreground">{v.apelido}</h3>
            <p className="text-[12px] text-muted-foreground">{v.marca} {v.modelo} · {v.ano_fabricacao}</p>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${STATUS_COLOR[v.status]}`}>
            {v.status.replace("_", " ")}
          </span>
        </div>

        <div className="flex items-center justify-between text-[10px] text-faint-foreground">
          <span>{progresso}% concluído · {v.total_fases} fases</span>
          <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px]">
            {PERFIL_LABEL[v.perfil] ?? v.perfil}
          </span>
        </div>

        <div className="h-1 w-full rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-purple transition-all" style={{ width: `${progresso}%` }} />
        </div>

        <div className="flex items-center justify-between border-t border-border pt-2">
          <Link
            to={`/g/${v.garagem_slug}`}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-purple transition-colors"
          >
            <div className="flex size-5 items-center justify-center rounded-full bg-purple-bg text-[9px] font-bold text-purple">
              {v.dono_avatar
                ? <img src={v.dono_avatar} className="size-full rounded-full object-cover" alt="" />
                : (v.dono_nome?.[0] ?? "?").toUpperCase()
              }
            </div>
            {v.dono_nome}
          </Link>
          <div className="flex items-center gap-2.5 text-[10px] text-faint-foreground">
            {v.total_comentarios > 0 && (
              <Link
                to={`/g/${v.garagem_slug}/${v.id}`}
                className="flex items-center gap-1 hover:text-purple transition-colors"
              >
                <MessageCircle className="size-3" />
                {v.total_comentarios}
              </Link>
            )}
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {timeAgo(v.criado_em)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FeedPage() {
  const [veiculos, setVeiculos] = useState<VeiculoFeed[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const load = useCallback(async (off: number) => {
    const setter = off === 0 ? setLoading : setLoadingMore
    setter(true)
    try {
      const r = await api.get<{ veiculos: VeiculoFeed[] }>(`/api/feed?limit=12&offset=${off}`)
      const lista = r.veiculos ?? []
      setVeiculos(prev => off === 0 ? lista : [...prev, ...lista])
      setHasMore(lista.length === 12)
      setOffset(off + lista.length)
    } catch {
      // silencioso
    } finally {
      setter(false)
    }
  }, [])

  useEffect(() => { load(0) }, [load])

  return (
    <div className="flex flex-col gap-8">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-purple/5 blur-3xl" />
        <div className="relative">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-purple-bg">
              <TrendingUp className="size-4 text-purple" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint-foreground">
              Comunidade
            </span>
          </div>
          <h1 className="font-display text-[26px] font-bold text-foreground">Feed de Builds</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Builds públicos da comunidade AutoHub — inspire-se e acompanhe projetos reais.
          </p>
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-[320px] animate-pulse rounded-2xl border border-border bg-surface" />
          ))}
        </div>
      ) : veiculos.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <Users className="size-10 text-faint-foreground" />
          <div>
            <p className="font-semibold text-foreground">Nenhum build público ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Torne sua garagem pública nas configurações para aparecer aqui.
            </p>
          </div>
          <Link to="/configuracoes" className="text-sm text-purple hover:underline">
            Configurações da garagem
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {veiculos.map(v => <BuildCard key={v.id} v={v} />)}
          </div>

          {hasMore && (
            <button
              onClick={() => load(offset)}
              disabled={loadingMore}
              className="mx-auto flex items-center gap-2 rounded-xl border border-border bg-surface px-6 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
            >
              <Wrench className={`size-4 ${loadingMore ? "animate-spin" : ""}`} />
              {loadingMore ? "Carregando..." : "Carregar mais"}
            </button>
          )}
        </>
      )}
    </div>
  )
}
