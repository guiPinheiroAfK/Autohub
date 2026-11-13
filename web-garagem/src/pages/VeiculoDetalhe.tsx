import { useParams, Link } from "react-router-dom"
import { ArrowRight, Zap, Target, Layers, CheckCircle2, Plus, FileDown } from "lucide-react"
import { FaseCard } from "@/components/shared/FaseCard"
import { FotoGaleria } from "@/components/shared/FotoGaleria"
import { useAuth } from "@/context/AuthContext"
import type { PerfilVeiculo, StatusVeiculo } from "@/types"
import { PERFIL_LABEL } from "@/pages/veiculo/constants"
import { calcTotais } from "@/pages/veiculo/calc"
import { abrirPdfBuild } from "@/pages/veiculo/exportarPdf"
import { VeiculoSkeleton } from "@/pages/veiculo/VeiculoSkeleton"
import { StatsVeiculo } from "@/pages/veiculo/StatsVeiculo"
import { BuildProgress } from "@/pages/veiculo/BuildProgress"
import { ResumoFinanceiro } from "@/pages/veiculo/ResumoFinanceiro"
import { StatusVeiculoMenu } from "@/pages/veiculo/StatusVeiculoMenu"
import { NovaFaseForm } from "@/pages/veiculo/NovaFaseForm"
import { ColaboradoresPanel } from "@/pages/veiculo/ColaboradoresPanel"
import { CapaPanel } from "@/pages/veiculo/CapaPanel"
import { YoutubePanel } from "@/pages/veiculo/YoutubePanel"
import { useVeiculoDetalhe } from "@/pages/veiculo/useVeiculoDetalhe"
import { useStatusVeiculo } from "@/pages/veiculo/useStatusVeiculo"
import { useFasesVeiculo } from "@/pages/veiculo/useFasesVeiculo"
import { useMidiaVeiculo } from "@/pages/veiculo/useMidiaVeiculo"

// ── Página principal ──────────────────────────────────────────────────────────
export default function VeiculoDetalhe() {
    const { id } = useParams<{ id: string }>()
    const { user } = useAuth()
    const { data, setData, loading, erro, capaUrl, setCapaUrl, youtubeUrl, setYoutubeUrl, carregar } = useVeiculoDetalhe(id)
    const { savingStatus, handleStatusChange } = useStatusVeiculo({ id, data, setData, carregar })
    const { addingFase, setAddingFase, savingFase, handleCriarFase } = useFasesVeiculo({ id, data, carregar })
    const { uploadingCapa, handleUploadCapa, savingYoutube, handleSaveYoutube } = useMidiaVeiculo({ id, data, setData, setCapaUrl, youtubeUrl })

    if (loading) return <VeiculoSkeleton />

    if (erro || !data) {
        return (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
                <p className="text-sm text-muted-foreground">{erro ?? "Veículo não encontrado."}</p>
                <Link to="/" className="text-sm text-purple hover:underline">
                    Voltar para a garagem
                </Link>
            </div>
        )
    }

    const isDono = data.garagem_id === user?.garagem?.id

    function exportarPDF() {
        if (!data) return
        abrirPdfBuild({ data, fases, totais, progresso, concluidosItens, totalItens })
    }

    const fases = data.fases ?? []
    const todosItens = fases.flatMap((f) => f.itens ?? [])
    const totalItens = todosItens.length
    const concluidosItens = todosItens.filter((i) => i.status === "concluido").length
    const progresso = totalItens > 0 ? Math.round((concluidosItens / totalItens) * 100) : 0
    const totais = calcTotais(fases)
    const principal = totais[0]

    const fasesStatus = {
        concluidas: fases.filter(f => f.status === "concluido").length,
        andamento: fases.filter(f => f.status === "andamento").length,
        planejadas: fases.filter(f => f.status === "planejado").length,
    }

    return (
        <div className="lg:grid lg:grid-cols-[1fr_300px] lg:items-start lg:gap-8">

            {/* ── Coluna principal ─────────────────────────────────────────────── */}
            <div className="flex flex-col gap-8 min-w-0">

                {/* Hero */}
                <div className="border-b border-border pb-8">
                    <div className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-faint-foreground">
                        <span>{data.marca}</span>
                        <span className="text-border-strong">·</span>
                        <span>{data.modelo}</span>
                        <span className="text-border-strong">·</span>
                        <span>{data.ano_modelo}</span>
                        <span className="text-border-strong">·</span>
                        <span>{PERFIL_LABEL[data.perfil as PerfilVeiculo]}</span>
                    </div>

                    <h1 className="font-display text-[38px] font-semibold leading-[1.05] text-foreground">
                        {data.apelido}
                    </h1>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                        <StatusVeiculoMenu
                            status={data.status as StatusVeiculo}
                            saving={savingStatus}
                            onChange={handleStatusChange}
                        />

                        <button
                          onClick={exportarPDF}
                          title="Exportar build em PDF"
                          className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                        >
                          <FileDown className="size-3.5" />
                          Exportar PDF
                        </button>

                        {data.meta_potencia_whp && (
                            <>
                                <span className="text-faint-foreground">·</span>
                                <div className="flex items-center gap-1.5">
                                    <Zap className="size-3.5 text-amber" />
                                    <span className="font-data text-sm text-amber">
                                        meta {data.meta_potencia_whp} whp
                                    </span>
                                </div>
                            </>
                        )}

                        <span className="text-faint-foreground">·</span>
                        <div className="flex items-center gap-1.5">
                            <Layers className="size-3.5 text-faint-foreground" />
                            <span className="text-sm text-muted-foreground">
                                {fases.length} fase{fases.length !== 1 && "s"}
                            </span>
                        </div>

                        {fasesStatus.andamento > 0 && (
                            <>
                                <span className="text-faint-foreground">·</span>
                                <span className="rounded-full border border-amber/30 bg-amber-bg px-2 py-0.5 text-[11px] font-medium text-amber">
                                    {fasesStatus.andamento} em andamento
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Stats — mobile/tablet apenas (some no lg) */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:hidden">
                    <StatsVeiculo progresso={progresso} concluidosItens={concluidosItens} totalItens={totalItens} principal={principal} fasesConcluidas={fasesStatus.concluidas} fasesAndamento={fasesStatus.andamento} totalFases={fases.length} metaWhp={data.meta_potencia_whp} />
                </div>

                {/* Painéis — mobile/tablet apenas */}
                {fases.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
                        <BuildProgress fases={fases} />
                        <ResumoFinanceiro fases={fases} />
                    </div>
                )}

                {/* ── Fases ────────────────────────────────────────────────────── */}
                <div>
                    <div className="mb-4 flex items-center justify-between">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
                            Fases do build
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-faint-foreground">
                            <span className="flex items-center gap-1">
                                <CheckCircle2 className="size-3 text-green" />
                                {fasesStatus.concluidas} concluída{fasesStatus.concluidas !== 1 && "s"}
                            </span>
                            <span className="flex items-center gap-1">
                                <Target className="size-3 text-faint-foreground" />
                                {fasesStatus.planejadas} planejada{fasesStatus.planejadas !== 1 && "s"}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2.5">
                        {fases.map((fase, idx) => (
                            <div
                                key={fase.id}
                                className="animate-page-in"
                                style={{ animationDelay: `${idx * 150}ms` }}
                            >
                                <FaseCard
                                    fase={fase}
                                    itens={fase.itens ?? []}
                                    defaultOpen={idx === 0}
                                    onChanged={carregar}
                                />
                            </div>
                        ))}

                        {fases.length === 0 && !addingFase && (
                            <div className="flex flex-col items-center gap-2 py-14 text-center">
                                <p className="text-sm text-muted-foreground">Nenhuma fase ainda.</p>
                                <button
                                    onClick={() => setAddingFase(true)}
                                    className="flex items-center gap-1 text-sm text-purple hover:underline"
                                >
                                    Adicionar primeira fase <ArrowRight className="size-3" />
                                </button>
                            </div>
                        )}

                        {addingFase && (
                            <NovaFaseForm
                                proximaOrdem={fases.length + 1}
                                saving={savingFase}
                                onSave={handleCriarFase}
                                onCancel={() => setAddingFase(false)}
                            />
                        )}

                        {fases.length > 0 && !addingFase && (
                            <button
                                onClick={() => setAddingFase(true)}
                                className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                            >
                                <Plus className="size-3.5" /> Adicionar fase
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Imagem de capa ───────────────────────────────────────────── */}
                {isDono && <CapaPanel capaUrl={capaUrl} uploadingCapa={uploadingCapa} onUpload={handleUploadCapa} />}

                {/* ── YouTube URL ──────────────────────────────────────────────── */}
                {isDono && <YoutubePanel youtubeUrl={youtubeUrl} setYoutubeUrl={setYoutubeUrl} savingYoutube={savingYoutube} onSave={handleSaveYoutube} />}

                {/* ── Fotos da build ───────────────────────────────────────────── */}
                <div className="rounded-xl border border-border bg-surface p-5">
                    <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
                        Fotos da build
                    </div>
                    <FotoGaleria veiculoId={data.id} />
                </div>

                {/* ── Colaboradores (mobile) ───────────────────────────────────── */}
                <div className="lg:hidden">
                    <ColaboradoresPanel veiculoId={data.id} isDono={isDono} />
                </div>
            </div>

            {/* ── Sidebar desktop ──────────────────────────────────────────────── */}
            <aside className="hidden lg:flex flex-col gap-4 sticky top-[80px]">
                <div className="grid grid-cols-2 gap-2">
                    <StatsVeiculo progresso={progresso} concluidosItens={concluidosItens} totalItens={totalItens} principal={principal} fasesConcluidas={fasesStatus.concluidas} fasesAndamento={fasesStatus.andamento} totalFases={fases.length} metaWhp={data.meta_potencia_whp} />
                </div>
                {fases.length > 0 && (
                    <>
                        <BuildProgress fases={fases} />
                        <ResumoFinanceiro fases={fases} />
                    </>
                )}
                <ColaboradoresPanel veiculoId={data.id} isDono={isDono} />
            </aside>
        </div>
    )
}
