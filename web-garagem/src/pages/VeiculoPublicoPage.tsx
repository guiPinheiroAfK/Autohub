import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowLeft, CheckCircle2, Circle, Clock3, Zap, ChevronDown, ChevronUp } from "lucide-react"
import { api } from "@/lib/api/client"

interface GaragemInfo {
  id: string
  nome: string
  slug: string
  dono_nome: string
  dono_avatar: string | null
}

interface VeiculoPublico {
  id: string
  apelido: string
  marca: string
  modelo: string
  ano_fabricacao: number
  ano_modelo: number
  perfil: string
  status: string
  capa_url: string | null
  meta_potencia_whp: number | null
  criado_em: string
}

interface ItemPublico {
  id: string
  nome: string
  status: "planejado" | "andamento" | "concluido"
}

interface FasePublica {
  id: string
  titulo: string
  ordem: number
  status: string
  itens: ItemPublico[]
}

const PERFIL_LABEL: Record<string, string> = {
  daily: "Daily", street_build: "Street Build", restomod: "Restomod",
  track: "Track", project: "Project Car",
}

const STATUS_BADGE: Record<string, string> = {
  planejamento: "border-border text-faint-foreground",
  em_andamento: "border-amber/30 bg-amber-bg text-amber",
  concluido:    "border-green/30 bg-green-bg text-green",
  pausado:      "border-red/20 bg-red-bg text-red",
}

const ITEM_ICON = {
  concluido: <CheckCircle2 className="size-3.5 shrink-0 text-green" />,
  andamento: <Clock3 className="size-3.5 shrink-0 text-amber" />,
  planejado: <Circle className="size-3.5 shrink-0 text-faint-foreground" />,
}

function calcProgresso(fases: FasePublica[]) {
  const itens = fases.flatMap(f => f.itens)
  if (!itens.length) return 0
  return Math.round((itens.filter(i => i.status === "concluido").length / itens.length) * 100)
}

export default function VeiculoPublicoPage() {
  const { slug, veiculoId } = useParams<{ slug: string; veiculoId: string }>()
  const [garagem, setGaragem] = useState<GaragemInfo | null>(null)
  const [veiculo, setVeiculo] = useState<VeiculoPublico | null>(null)
  const [fases, setFases] = useState<FasePublica[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [abertas, setAbertas] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!slug || !veiculoId) return
    api.get<{ garagem: GaragemInfo; veiculo: VeiculoPublico; fases: FasePublica[] }>(
      `/g/${slug}/${veiculoId}`
    ).then(r => {
      setGaragem(r.garagem)
      setVeiculo(r.veiculo)
      setFases(r.fases)
      setAbertas(new Set(r.fases.map(f => f.id)))
    }).catch(e => setErro(e.message))
      .finally(() => setLoading(false))
  }, [slug, veiculoId])

  function toggleFase(id: string) {
    setAbertas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-56 rounded-2xl bg-surface" />
      <div className="h-8 w-56 rounded-lg bg-surface" />
      <div className="h-4 w-32 rounded bg-surface" />
      {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl border border-border bg-surface" />)}
    </div>
  )

  if (erro || !veiculo || !garagem) return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="font-semibold text-foreground">Build não encontrado</p>
      <p className="text-sm text-muted-foreground">{erro ?? "Este veículo é privado ou não existe."}</p>
      {slug && (
        <Link to={`/g/${slug}`} className="text-sm text-purple hover:underline">
          Voltar para a garagem
        </Link>
      )}
    </div>
  )

  const progresso = calcProgresso(fases)
  const totalItens = fases.flatMap(f => f.itens).length
  const concluidosCount = fases.flatMap(f => f.itens).filter(i => i.status === "concluido").length

  return (
    <div className="flex flex-col gap-6">

      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <Link
        to={`/g/${garagem.slug}`}
        className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-purple transition-colors w-fit"
      >
        <ArrowLeft className="size-3.5" />
        {garagem.nome}
      </Link>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      {veiculo.capa_url ? (
        <img
          src={veiculo.capa_url}
          alt={veiculo.apelido}
          className="h-56 w-full rounded-2xl object-cover border border-border"
        />
      ) : (
        <div className="flex h-56 items-center justify-center rounded-2xl border border-border bg-surface text-6xl">
          🚗
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-[22px] font-bold text-foreground">{veiculo.apelido}</h1>
            <p className="text-[13px] text-muted-foreground">
              {veiculo.marca} {veiculo.modelo} · {veiculo.ano_fabricacao}
              {veiculo.ano_modelo !== veiculo.ano_fabricacao && `/${veiculo.ano_modelo}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {PERFIL_LABEL[veiculo.perfil] ?? veiculo.perfil}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${STATUS_BADGE[veiculo.status]}`}>
              {veiculo.status.replace("_", " ")}
            </span>
          </div>
        </div>

        {veiculo.meta_potencia_whp && (
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Zap className="size-3.5 text-amber" />
            Meta: {veiculo.meta_potencia_whp} whp
          </div>
        )}

        {/* Dono */}
        <Link
          to={`/g/${garagem.slug}`}
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-purple transition-colors w-fit"
        >
          <div className="flex size-5 items-center justify-center rounded-full bg-purple-bg text-[9px] font-bold text-purple">
            {garagem.dono_avatar
              ? <img src={garagem.dono_avatar} className="size-full rounded-full object-cover" alt="" />
              : garagem.dono_nome[0].toUpperCase()
            }
          </div>
          {garagem.dono_nome}
        </Link>
      </div>

      {/* ── Progresso ──────────────────────────────────────────────────── */}
      {totalItens > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-medium text-foreground">{progresso}% concluído</span>
            <span className="text-muted-foreground">{concluidosCount}/{totalItens} itens</span>
          </div>
          <div className="h-2 w-full rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-purple transition-all" style={{ width: `${progresso}%` }} />
          </div>
          <p className="text-[11px] text-faint-foreground">{fases.length} fase{fases.length !== 1 ? "s" : ""}</p>
        </div>
      )}

      {/* ── Fases ──────────────────────────────────────────────────────── */}
      {fases.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-[13px] font-semibold text-foreground">Fases do build</h2>
          {fases.map(fase => {
            const aberta = abertas.has(fase.id)
            const concluidos = fase.itens.filter(i => i.status === "concluido").length
            const total = fase.itens.length

            return (
              <div key={fase.id} className="rounded-xl border border-border bg-surface overflow-hidden">
                <button
                  onClick={() => toggleFase(fase.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-purple-bg text-[9px] font-bold text-purple">
                      {fase.ordem}
                    </span>
                    <span className="text-[13px] font-medium text-foreground truncate">{fase.titulo}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {total > 0 && (
                      <span className="text-[11px] text-muted-foreground">{concluidos}/{total}</span>
                    )}
                    {aberta
                      ? <ChevronUp className="size-3.5 text-faint-foreground" />
                      : <ChevronDown className="size-3.5 text-faint-foreground" />
                    }
                  </div>
                </button>

                {aberta && fase.itens.length > 0 && (
                  <div className="border-t border-border px-4 py-2 flex flex-col gap-1">
                    {fase.itens.map(item => (
                      <div key={item.id} className="flex items-center gap-2 py-1.5">
                        {ITEM_ICON[item.status]}
                        <span className={`text-[12px] ${item.status === "concluido" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {item.nome}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {aberta && fase.itens.length === 0 && (
                  <div className="border-t border-border px-4 py-3">
                    <p className="text-[12px] text-faint-foreground">Nenhum item nesta fase.</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
