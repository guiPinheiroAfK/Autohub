import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ExternalLink, AtSign, MessageCircle, Globe, Store, Tag, Clock } from "lucide-react"
import { api } from "@/lib/api/client"

interface Loja {
  id: string
  garagem_id: string
  nome: string
  descricao?: string | null
  logo_url?: string | null
  banner_url?: string | null
  instagram?: string | null
  whatsapp?: string | null
  website?: string | null
  garagem_nome: string
  garagem_slug: string
  garagem_publica: boolean
  dono_nome: string
  dono_avatar?: string | null
}

interface AnuncioLoja {
  id: string
  titulo: string
  preco?: number | null
  moeda: string
  categoria: string
  condicao: string
  status: string
  patrocinado: boolean
  criado_em: string
}

const CATEGORIAS: Record<string, string> = {
  motor: "Motor", suspensao: "Suspensão", freios: "Freios", eletrica: "Elétrica",
  carroceria: "Carroceria", rodas: "Rodas", interior: "Interior",
  acessorios: "Acessórios", veiculo_completo: "Veículo Completo", outro: "Outro",
}

function formatPreco(preco: number | null | undefined, moeda: string) {
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

export default function LojaPage() {
  const { garagemSlug } = useParams<{ garagemSlug: string }>()
  const [loja, setLoja] = useState<Loja | null>(null)
  const [anuncios, setAnuncios] = useState<AnuncioLoja[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!garagemSlug) return
    api.get<{ loja: Loja; anuncios: AnuncioLoja[] }>(`/api/lojas/${garagemSlug}`)
      .then(r => {
        setLoja(r.loja)
        setAnuncios(r.anuncios ?? [])
      })
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false))
  }, [garagemSlug])

  if (loading) return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-48 rounded-2xl bg-surface" />
      <div className="h-8 w-48 rounded-lg bg-surface" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => <div key={i} className="h-36 rounded-xl bg-surface" />)}
      </div>
    </div>
  )

  if (erro || !loja) return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <Store className="size-10 text-faint-foreground" />
      <p className="font-semibold text-foreground">Loja não encontrada</p>
      <p className="text-sm text-muted-foreground">{erro ?? "Esta loja não existe ou não está disponível."}</p>
      <Link to="/marketplace" className="text-sm text-purple hover:underline">
        Voltar ao marketplace
      </Link>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Banner + Logo */}
      <div className="relative">
        {loja.banner_url ? (
          <img
            src={loja.banner_url}
            alt={loja.nome}
            className="h-48 w-full rounded-2xl object-cover border border-border"
          />
        ) : (
          <div className="flex h-48 items-center justify-center rounded-2xl border border-border bg-surface">
            <Store className="size-12 text-faint-foreground" />
          </div>
        )}

        {/* Logo absoluto no canto inferior esquerdo do banner */}
        {loja.logo_url && (
          <div className="absolute -bottom-6 left-5">
            <img
              src={loja.logo_url}
              alt="logo"
              className="size-16 rounded-xl border-2 border-border bg-surface object-cover shadow-lg"
            />
          </div>
        )}
      </div>

      {/* Info section */}
      <div className={loja.logo_url ? "mt-6" : ""}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-[26px] font-semibold text-foreground">{loja.nome}</h1>
            {loja.garagem_publica && (
              <Link
                to={`/g/${loja.garagem_slug}`}
                className="mt-1 flex items-center gap-1 text-[12px] text-purple hover:underline w-fit"
              >
                Ver garagem de {loja.dono_nome} <ExternalLink className="size-3" />
              </Link>
            )}
          </div>

          {/* Links de contato */}
          <div className="flex items-center gap-2 flex-wrap">
            {loja.instagram && (
              <a
                href={`https://instagram.com/${loja.instagram.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <AtSign className="size-3.5" />
                {loja.instagram}
              </a>
            )}
            {loja.whatsapp && (
              <a
                href={`https://wa.me/${loja.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <MessageCircle className="size-3.5" />
                WhatsApp
              </a>
            )}
            {loja.website && (
              <a
                href={loja.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Globe className="size-3.5" />
                Site
              </a>
            )}
          </div>
        </div>

        {loja.descricao && (
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground max-w-2xl">
            {loja.descricao}
          </p>
        )}
      </div>

      {/* Anúncios */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
            Anúncios ativos ({anuncios.length})
          </h2>
          <Link to="/marketplace" className="text-[12px] text-purple hover:underline">
            Ver marketplace completo
          </Link>
        </div>

        {anuncios.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center rounded-xl border border-dashed border-border">
            <Tag className="size-8 text-faint-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum anúncio ativo no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {anuncios.map(a => (
              <div
                key={a.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 hover:border-border-strong transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[14px] font-semibold text-foreground line-clamp-2">{a.titulo}</h3>
                  {a.patrocinado && (
                    <span className="shrink-0 rounded-full border border-amber/30 bg-amber-bg px-2 py-0.5 text-[10px] font-semibold text-amber">
                      ⭐
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                    {CATEGORIAS[a.categoria] ?? a.categoria}
                  </span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground capitalize">
                    {a.condicao}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-data text-[16px] font-bold text-foreground">
                    {formatPreco(a.preco, a.moeda)}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-faint-foreground">
                    <Clock className="size-3" />
                    {timeAgo(a.criado_em)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
