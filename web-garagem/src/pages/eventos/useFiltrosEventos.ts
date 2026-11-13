import { useMemo, useState } from "react"
import { EVENTOS, type TipoEvento, type Evento } from "@/data/eventos"
import { MESES_FULL } from "./constants"
import { parseData, isPassado } from "./datas"

// Filtros do calendário público (tipo, mês e eventos passados) e agrupamentos derivados
export function useFiltrosEventos() {
  const [tipoFiltro, setTipoFiltro] = useState<TipoEvento | "todos">("todos")
  const [mesFiltro, setMesFiltro] = useState<number | null>(null)
  const [mostraPast, setMostraPast] = useState(false)

  const eventosFiltrados = useMemo(() => {
    return EVENTOS
      .filter(e => {
        if (tipoFiltro !== "todos" && e.tipo !== tipoFiltro) return false
        if (mesFiltro !== null && Number(e.data_inicio.split("-")[1]) - 1 !== mesFiltro) return false
        if (!mostraPast && isPassado(e.data_inicio)) return false
        return true
      })
      .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
  }, [tipoFiltro, mesFiltro, mostraPast])

  const proximos = eventosFiltrados.filter(e => !isPassado(e.data_inicio))
  const passados = eventosFiltrados.filter(e => isPassado(e.data_inicio))

  const porMes = useMemo(() => {
    const grupos: { label: string; eventos: Evento[] }[] = []
    const mapaIndice: Record<string, number> = {}
    for (const e of proximos) {
      const { ano, mes } = parseData(e.data_inicio)
      const chave = `${MESES_FULL[mes]} ${ano}`
      if (mapaIndice[chave] === undefined) {
        mapaIndice[chave] = grupos.length
        grupos.push({ label: chave, eventos: [] })
      }
      grupos[mapaIndice[chave]].eventos.push(e)
    }
    return grupos
  }, [proximos])

  const proximoEvento = proximos[0] ?? null

  const mesAtivos = useMemo(() => {
    return [...new Set(EVENTOS.map(e => Number(e.data_inicio.split("-")[1]) - 1))].sort((a,b) => a-b)
  }, [])
  return { tipoFiltro, setTipoFiltro, mesFiltro, setMesFiltro, mostraPast, setMostraPast, proximos, passados, porMes, proximoEvento, mesAtivos }
}
