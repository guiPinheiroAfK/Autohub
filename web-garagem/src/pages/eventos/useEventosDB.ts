import { useEffect, useState } from "react"
import { api } from "@/lib/api/client"
import type { EventoDB } from "./types"

// Eventos cadastrados pela comunidade (API)
export function useEventosDB() {
  const [eventosDB, setEventosDB] = useState<EventoDB[]>([])
  const [loadingDB, setLoadingDB] = useState(true)

  function carregarEventosDB() {
    setLoadingDB(true)
    api.get<{ eventos: EventoDB[] }>("/api/eventos-calendario")
      .then(r => setEventosDB(r.eventos ?? []))
      .catch(() => {})
      .finally(() => setLoadingDB(false))
  }

  useEffect(() => {
    carregarEventosDB()
  }, [])

  return { eventosDB, loadingDB, carregarEventosDB }
}
