import { Link } from "react-router-dom"
import { Plus, Gauge, Wrench, Clock, Gamepad2 } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { VeiculoCard } from "@/components/shared/VeiculoCard"
import { SkeletonCard } from "@/pages/garagem/SkeletonCard"
import { GaragemStat } from "@/pages/garagem/GaragemStat"
import { CotacoesWidget } from "@/pages/garagem/CotacoesWidget"
import { SocialWidget } from "@/pages/garagem/SocialWidget"
import { ProximosEventos } from "@/pages/garagem/ProximosEventos"
import { CarSilhouette } from "@/pages/garagem/CarSilhouette"
import { useVeiculosGaragem } from "@/pages/garagem/useVeiculosGaragem"

// ── Página principal ──────────────────────────────────────────────────────────

export default function GaragemOverview() {
  const { user } = useAuth()
  const { veiculos, loading, erro } = useVeiculosGaragem()

  const totalFases = veiculos.reduce((s, v) => s + v.total_fases, 0)
  const totalItens = veiculos.reduce((s, v) => s + v.total_itens, 0)
  const emAndamento = veiculos.filter(v => v.status === "em_andamento").length

  return (
    <div className="flex flex-col gap-8">

      {/* ── Hero de boas-vindas ─────────────────────────────────────────── */}
      <div className="animate-page-in relative overflow-hidden rounded-2xl border border-border bg-surface">
        {/* glow de fundo */}
        <div className="pointer-events-none absolute -right-10 -top-10 size-64 rounded-full bg-purple/8 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 left-1/4 size-40 rounded-full bg-purple/5 blur-2xl" />

        <div className="relative flex items-center gap-4 px-6 py-5 sm:gap-8">
          <div className="flex-1 min-w-0">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint-foreground">
              Minha garagem
            </div>
            <h1 className="font-display text-[26px] font-bold leading-tight text-foreground">
              {user?.garagem?.nome ?? "Minha Garagem"}
            </h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {loading
                ? "Carregando..."
                : veiculos.length === 0
                  ? "Nenhum projeto ainda — adicione seu primeiro build abaixo"
                  : `${veiculos.length} projeto${veiculos.length !== 1 ? "s" : ""} · ${emAndamento} em andamento`}
            </p>
          </div>
          {/* Silhueta do carro (decorativa) */}
          <div className="hidden sm:block shrink-0 opacity-80">
            <CarSilhouette />
          </div>
        </div>
      </div>

      {/* ── AutoDash (minigame) ─────────────────────────────────────────── */}
      <Link
        to="/autodash"
        className="animate-page-in group relative overflow-hidden rounded-2xl border border-border bg-surface px-6 py-4 transition-colors hover:border-red-500/40"
        style={{ animationDelay: "60ms" }}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-red-500/10 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-xl">🏁</div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[15px] font-bold text-foreground">
              AutoDash <span className="text-red-400">· minigame</span>
            </div>
            <p className="truncate text-[12px] text-muted-foreground">
              Costure o trânsito, respeite o câmbio e dispute o top 10 global
            </p>
          </div>
          <Gamepad2 className="size-5 shrink-0 text-faint-foreground transition-transform group-hover:translate-x-1 group-hover:text-red-400" />
        </div>
      </Link>

      {/* ── Botão novo veículo ──────────────────────────────────────────── */}
      <div className="animate-page-in flex items-center justify-between" style={{ animationDelay: "80ms" }}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint-foreground">
          {veiculos.length > 0 ? `${veiculos.length} veículo${veiculos.length !== 1 ? "s" : ""}` : "Builds"}
        </div>

        {veiculos.length >= 10 ? (
          <div className="relative group">
            <button
              disabled
              className="flex items-center gap-1.5 rounded-lg bg-purple/40 px-4 py-2 text-sm font-medium text-white/60 cursor-not-allowed"
            >
              <Plus className="size-4" />
              Novo veículo
            </button>
            <div className="pointer-events-none absolute right-0 top-full mt-1.5 z-10 hidden w-56 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] text-muted-foreground shadow-lg group-hover:block">
              Limite de 10 builds atingido (plano gratuito)
            </div>
          </div>
        ) : (
          <Link
            to="/novo"
            className="flex items-center gap-1.5 rounded-lg bg-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="size-4" />
            {veiculos.length === 0 ? "Criar primeiro build" : "Novo veículo"}
          </Link>
        )}
      </div>

      {/* ── Stats + cotações ─────────────────────────────────────────────── */}
      {!loading && veiculos.length > 0 && (
        <div className="animate-page-in flex flex-col gap-2.5" style={{ animationDelay: "120ms" }}>
          <div className="grid grid-cols-3 gap-2.5">
            <GaragemStat icon={Wrench} label="em andamento" value={emAndamento} accent="text-amber" />
            <GaragemStat icon={Gauge}  label="fases totais"  value={totalFases}  accent="text-purple" />
            <GaragemStat icon={Clock}  label="itens totais"  value={totalItens}  accent="text-blue" />
          </div>
          <CotacoesWidget />
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      )}

      {/* ── Erro ─────────────────────────────────────────────────────────── */}
      {erro && (
        <p className="rounded-lg border border-red-bg bg-red-bg px-4 py-3 text-sm text-red">
          {erro}
        </p>
      )}

      {/* ── Comunidade ───────────────────────────────────────────────────── */}
      <div className="animate-page-in" style={{ animationDelay: "160ms" }}>
        <SocialWidget />
      </div>

      {/* ── Grid de veículos ─────────────────────────────────────────────── */}
      {!loading && veiculos.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {veiculos.map((v, index) => (
            <div
              key={v.id}
              className="animate-page-in"
              style={{ animationDelay: `${200 + index * 80}ms` }}
            >
              <VeiculoCard veiculo={v} />
            </div>
          ))}
        </div>
      )}

      {!loading && !erro && veiculos.length === 0 && (
        <div className="animate-page-in flex flex-col items-center gap-5 rounded-2xl border border-dashed border-border py-20 text-center" style={{ animationDelay: "200ms" }}>
          {/* mini car */}
          <div className="flex size-16 items-center justify-center rounded-2xl bg-surface-2">
            <div className="w-12 opacity-70"><CarSilhouette /></div>
          </div>
          <div>
            <p className="font-display text-[16px] font-bold text-foreground">Garagem vazia</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Adicione seu primeiro projeto e acompanhe o build passo a passo
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Link
              to="/novo"
              className="flex items-center gap-1.5 rounded-xl bg-purple px-5 py-2.5 text-[14px] font-semibold text-white hover:opacity-90 transition-opacity shadow-lg shadow-purple/20"
            >
              <Plus className="size-4" /> Criar primeiro build
            </Link>
            <Link to="/feed" className="text-[12px] text-muted-foreground hover:text-purple transition-colors">
              ou explore builds da comunidade →
            </Link>
          </div>
        </div>
      )}

      {/* ── Próximos eventos ─────────────────────────────────────────────── */}
      {!loading && <ProximosEventos />}

    </div>
  )
}
