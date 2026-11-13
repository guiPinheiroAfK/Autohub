import { useState } from "react"
import { AlertTriangle, Plus, Search, ShoppingBag, Sparkles, Tag, X } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { cn } from "@/lib/utils"
import type { Anuncio } from "@/pages/marketplace/types"
import { CATEGORIAS_ARRAY, POR_PAGINA } from "@/pages/marketplace/constants"
import { AnuncioCard } from "@/pages/marketplace/AnuncioCard"
import { NovoAnuncioDrawer } from "@/pages/marketplace/NovoAnuncioDrawer"
import { ModalInteresse } from "@/pages/marketplace/ModalInteresse"
import { useAnuncios } from "@/pages/marketplace/useAnuncios"
import { useMeusAnuncios } from "@/pages/marketplace/useMeusAnuncios"

// ── Página principal ──────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<"todos" | "meus">("todos")
  const [criandoAnuncio, setCriandoAnuncio] = useState(false)
  const [anuncioInteresse, setAnuncioInteresse] = useState<Anuncio | null>(null)

  const {
    anuncios, setAnuncios, total, pagina, setPagina, loading,
    busca, setBusca, categFiltro, condicaoFiltro, carregar, handleBusca, handleFiltro,
  } = useAnuncios()
  const { meusAnuncios, carregarMeus, handleStatusChange, handlePatrocinar } = useMeusAnuncios()

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  return (
    <div className="flex flex-col gap-6">
      {/* Banner de ambiente de testes */}
      <div className="flex items-start gap-3 rounded-xl border border-amber/30 bg-amber-bg px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" />
        <div>
          <p className="text-[13px] font-semibold text-foreground">Ambiente de testes</p>
          <p className="text-[12px] text-muted-foreground">
            Este marketplace é exclusivamente para fins de demonstração. Nenhuma transação real deve acontecer — não envie dinheiro, não transfira peças nem realize pagamentos de nenhum tipo.
          </p>
        </div>
      </div>

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
            <div className="flex flex-col gap-4">
              {(() => {
                const patrocinados = anuncios.filter(a => a.patrocinado)
                const normais = anuncios.filter(a => !a.patrocinado)
                return (
                  <>
                    {patrocinados.length > 0 && (
                      <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {patrocinados.map(a => (
                            <AnuncioCard key={a.id} a={a} user={user} onInteresse={setAnuncioInteresse} />
                          ))}
                        </div>
                        {normais.length > 0 && (
                          <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">Anúncios</span>
                            <div className="h-px flex-1 bg-border" />
                          </div>
                        )}
                      </>
                    )}
                    {normais.length > 0 && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {normais.map(a => (
                          <AnuncioCard key={a.id} a={a} user={user} onInteresse={setAnuncioInteresse} />
                        ))}
                      </div>
                    )}
                  </>
                )
              })()}
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
                <div key={a.id} className="flex flex-col gap-2">
                  <AnuncioCard a={a} user={user} onStatusChange={handleStatusChange} />
                  {!a.patrocinado && a.status === "ativo" && (
                    <button
                      onClick={() => handlePatrocinar(a.id)}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-amber/30 py-1.5 text-[11px] font-medium text-amber hover:bg-amber-bg transition-colors"
                    >
                      <Sparkles className="size-3" />
                    Patrocinar por 30 dias
                    </button>
                  )}
                </div>
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

      {/* Modal de interesse */}
      {anuncioInteresse && (
        <ModalInteresse
          anuncioId={anuncioInteresse.id}
          titulo={anuncioInteresse.titulo}
          onClose={() => setAnuncioInteresse(null)}
          onSuccess={() => {
            // Atualiza contador localmente
            setAnuncios(prev => prev.map(a =>
              a.id === anuncioInteresse!.id
                ? { ...a, total_interesses: a.total_interesses + 1 }
                : a
            ))
          }}
        />
      )}
    </div>
  )
}
