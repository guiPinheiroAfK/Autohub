import { useEffect, useState } from "react"
import { getPessoais, savePessoais } from "./pessoais"
import type { EventoPessoal } from "./types"

// Lembretes pessoais guardados no localStorage
export function usePessoais() {
  const [pessoais, setPessoais] = useState<EventoPessoal[]>([])

  useEffect(() => {
    setPessoais(getPessoais())
  }, [])

  function reloadPessoais() {
    setPessoais(getPessoais())
  }

  function deletarPessoal(id: string) {
    const novos = getPessoais().filter(e => e.id !== id)
    savePessoais(novos)
    setPessoais(novos)
  }

  return { pessoais, reloadPessoais, deletarPessoal }
}
