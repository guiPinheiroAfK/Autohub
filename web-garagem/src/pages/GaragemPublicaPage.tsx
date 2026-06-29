import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { MapPin, Users, Lock, ExternalLink, UserPlus, UserCheck, Wrench, Clock } from "lucide-react"
import { api } from "@/lib/api/client"
import { useAuth } from "@/context/AuthContext"

interface GaragemPublica {
  id: string
  nome: string
  slug: string
  bio: string | null
  publica: boolean
  criada_em: string
  dono_nome: string
  dono_avatar: string | null
  total_follows: number
}

interface VeiculoPublico {
  id: string
  apelido: string
  marca: string
  modelo: string
  ano_fabricacao: number
  perfil: string
  status: string
  capa_url: string | null
  total_fases: number
  total_itens: number
  itens_concluidos: number
}

const PERFIL_LABEL: Record<string, string> = {
  daily: "Daily", street_build: "Street Build", restomod: "Restomod",
  track: "Track", project: "Project Car",
}

const STATUS_COLOR: Record<string, string> = {
  planejamento: "text-faint-foreground border-border",
  em_andamento: "text-amber border-amber/30 bg-amber-bg",
  concluido: "text-green border-green/30 bg-green-bg",
  pausado: "text-red border-red/20 bg-red-bg",
}

export default function GaragemPublicaPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()
  const [garagem, setGaragem] = useState<GaragemPublica | null>(null)
  const [veiculos, setVeiculos] = useState<VeiculoPublico[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [seguindo, setSeguindo] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  useEffect(() => {
    if (!slug) return
    api.get<{ garagem: GaragemPublica; veiculos: VeiculoPublico[] }>(`/api/g/${slug}`)
      .then(r => { setGaragem(r.garagem); setVeiculos(r.veiculos) })
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  // Usa garagem?.id (string estável) em vez do objeto garagem inteiro.
  // Se a dependência fosse `garagem`, o efeito re-dispararia a cada toggleFollow
  // (que chama setGaragem criando novo objeto), sobrescrevendo `seguindo` de forma
  // assíncrona e dessincronizando o contador de seguidores.
  const garagemId = garagem?.id
  useEffect(() => {
    if (!user || !garagemId) return
    api.get<{ follows: { garagem_id: string }[] }>("/api/social/follows")
      .then(r => setSeguindo(r.follows.some(f => f.garagem_id === garagemId)))
      .catch(() => {})
  }, [user, garagemId])

  async function toggleFollow() {
    if (!garagem || !user) return
    setFollowLoading(true)
    try {
      if (seguindo) {
        await api.delete(`/api/social/follows/${garagem.id}`)
        setSeguindo(false)
        setGaragem(g => g ? { ...g, total_follows: g.total_follows - 1 } : g)
      } else {
        await api.post(`/api/social/follows/${garagem.id}`, {})
        setSeguindo(true)
        setGaragem(g => g ? { ...g, total_follows: g.total_follows + 1 } : g)
      }
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 max-w-[900px] mx-auto px-4 py-8">
        <div className="h-32 animate-pulse rounded-2xl bg-surface" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1,2,3].map(i => <div key={i} className="h-48 animate-pulse rounded-xl bg-surface" />)}
        </div>
      </div>
    )
  }

  if (erro || !garagem) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <Lock className="size-10 text-faint-foreground" />
        <div>
          <p className="font-semibold text-foreground">Garagem não encontrada</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {erro?.includes("privada") ? "Esta garagem é privada." : "O link pode estar errado."}
          </p>
        </div>
        <Link to="/" className="text-sm text-purple hover:underline">Voltar ao início</Link>
      </div>
    )
  }

  const isMinhaGaragem = user?.garagem?.slug === slug

  return (
    <div className="flex flex-col gap-8 max-w-[900px] mx-auto">

      {/* ── Hero da garagem ───────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-purple/5 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-xl bg-purple-bg text-purple text-2xl font-bold">
              {garagem.dono_avatar
                ? <img src={garagem.dono_avatar} className="size-full rounded-xl object-cover" alt="" />
                : (garagem.dono_nome?.[0] ?? "?").toUpperCase()
              }
            </div>
            <div>
              <h1 className="font-display text-[20px] font-bold text-foreground">{garagem.nome}</h1>
              <p className="text-[12px] text-muted-foreground">por {garagem.dono_nome}</p>
              {garagem.bio && (
                <p className="mt-1.5 max-w-[400px] text-[13px] text-muted-foreground">{garagem.bio}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {user && !isMinhaGaragem && (
              <button
                onClick={toggleFollow}
                disabled={followLoading}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  seguindo
                    ? "border-purple/30 bg-purple-bg text-purple"
                    : "border-border text-muted-foreground hover:border-purple/30 hover:bg-purple-bg hover:text-purple"
                }`}
              >
                {seguindo ? <UserCheck className="size-3.5" /> : <UserPlus className="size-3.5" />}
                {seguindo ? "Seguindo" : "Seguir"}
              </button>
            )}
            <div className="flex items-center gap-1 text-[11px] text-faint-foreground">
              <Users className="size-3" />
              {garagem.total_follows} {garagem.total_follows === 1 ? "seguidor" : "seguidores"}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-4">
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Wrench className="size-3.5" />
            {veiculos.length} {veiculos.length === 1 ? "veículo público" : "veículos públicos"}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Clock className="size-3.5" />
            Na comunidade desde {new Date(garagem.criada_em).getFullYear()}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <MapPin className="size-3.5" />
            autohub.app/g/{garagem.slug}
          </div>
        </div>
      </div>

      {/* ── Veículos ──────────────────────────────────────────────────── */}
      {veiculos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Wrench className="size-8 text-faint-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum veículo público nesta garagem ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {veiculos.map(v => {
            const progresso = v.total_itens > 0
              ? Math.round((v.itens_concluidos / v.total_itens) * 100)
              : 0

            return (
              <div key={v.id} className="group flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong">
                {v.capa_url ? (
                  <img src={v.capa_url} alt={v.apelido} className="h-32 w-full rounded-lg object-cover" />
                ) : (
                  <div className="flex h-32 items-center justify-center rounded-lg bg-surface-2 text-3xl">🚗</div>
                )}

                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-[15px] font-bold text-foreground">{v.apelido}</h3>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-medium ${STATUS_COLOR[v.status]}`}>
                      {v.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted-foreground">{v.marca} {v.modelo} · {v.ano_fabricacao}</p>
                  <p className="mt-0.5 text-[10px] text-faint-foreground">{PERFIL_LABEL[v.perfil] ?? v.perfil}</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[10px] text-faint-foreground">
                    <span>{v.total_fases} fases · {v.total_itens} itens</span>
                    <span>{progresso}% concluído</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-purple transition-all"
                      style={{ width: `${progresso}%` }}
                    />
                  </div>
                </div>

                <a
                  href={`/g/${garagem.slug}/${v.id}`}
                  className="flex items-center gap-1 text-[11px] text-purple hover:underline"
                >
                  Ver build <ExternalLink className="size-3" />
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
