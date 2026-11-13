import type { EventoPessoal } from "./types"

const STORAGE_KEY = "autohub_eventos_pessoais"

export function getPessoais(): EventoPessoal[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
  } catch {
    return []
  }
}

export function savePessoais(eventos: EventoPessoal[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(eventos))
}
