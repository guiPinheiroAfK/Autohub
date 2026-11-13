import { useState } from "react"
import { Link } from "react-router-dom"
import { Users, ArrowLeftRight, ArrowRight } from "lucide-react"
import { useSocial } from "./useSocial"


// ── Widget social (seguidores / seguindo) ─────────────────────────────────────

export function SocialWidget() {
  const [tab, setTab] = useState<"seguidores" | "seguindo">("seguidores")
  const { seguidores, seguindo, loading } = useSocial()

  const lista = tab === "seguidores" ? seguidores : seguindo
  const totalMutuos = seguidores.filter(s => s.mutuo).length

  return (
    <div className="rounded-xl border border-border bg-surface">
      {/* Faixa de contadores */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-faint-foreground" />
          <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
            Comunidade
          </span>
        </div>
        <div className="flex items-center gap-3 ml-1">
          {([
            { v: "seguidores", l: "Seguidores", n: seguidores.length },
            { v: "seguindo",   l: "Seguindo",   n: seguindo.length   },
          ] as const).map(t => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={[
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors",
                tab === t.v
                  ? "bg-purple-bg text-purple"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <span className="font-bold">{t.n}</span> {t.l}
            </button>
          ))}
          {totalMutuos > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-green-bg px-2 py-0.5 text-[10px] font-medium text-green ml-1">
              <ArrowLeftRight className="size-3" />
              {totalMutuos} mútuo{totalMutuos !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <Link
          to="/feed"
          className="ml-auto flex items-center gap-1 text-[11px] text-purple hover:underline shrink-0"
        >
          Explorar <ArrowRight className="size-3" />
        </Link>
      </div>

      {/* Lista horizontal com scroll */}
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-2.5 scrollbar-none">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="h-8 w-24 shrink-0 animate-pulse rounded-lg bg-surface-2" />
          ))
        ) : lista.length === 0 ? (
          <p className="text-[12px] text-faint-foreground py-1">
            {tab === "seguidores" ? "Ninguém seguindo ainda" : "Você não segue ninguém ainda"}
          </p>
        ) : (
          lista.map(item => {
            // garagem_nome (seguidores) ou nome (follows) = nome da garagem, sempre definido
            const nome = item.garagem_nome ?? item.nome ?? item.dono_nome ?? "Usuário"
            return (
              <Link
                key={item.id + tab}
                to={`/g/${item.slug}`}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 transition-colors hover:border-purple/40 hover:bg-surface-2"
              >
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-purple-bg text-[10px] font-bold text-purple">
                  {nome[0]?.toUpperCase() ?? "G"}
                </div>
                <span className="text-[12px] font-medium text-foreground">{nome}</span>
                {item.mutuo && (
                  <ArrowLeftRight className="size-3 text-green" />
                )}
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
