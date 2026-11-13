import type { PerfilVeiculo, StatusVeiculo } from "@/types"

export const PERFIL_LABEL: Record<PerfilVeiculo, string> = {
    daily: "Daily",
    street_build: "Street Build",
    restomod: "Restomod",
    track: "Track",
    project: "Projeto",
}

export const STATUS_LABEL: Record<StatusVeiculo, string> = {
    planejamento: "Planejamento",
    em_andamento: "Em andamento",
    concluido: "Concluído",
    pausado: "Pausado",
}

export const STATUS_DOT: Record<StatusVeiculo, string> = {
    planejamento: "bg-faint-foreground",
    em_andamento: "bg-amber animate-pulse",
    concluido: "bg-green",
    pausado: "bg-faint-foreground",
}
