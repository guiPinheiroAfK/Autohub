import { useEffect, useRef, useState } from "react"
import { X, Flag, Loader2, MapPin } from "lucide-react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { api } from "@/lib/api/client"
import type { Rota } from "@/types/tracks"

const REGIOES = ["Sul", "Sudeste", "Centro-Oeste", "Nordeste", "Norte"]
const BRASIL: [number, number] = [-15.78, -47.93]

function pinIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#7f77dd;transform:rotate(-45deg);box-shadow:0 0 0 4px rgba(127,119,221,0.3)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  })
}

export function CriarDestinoModal({
  onClose,
  onCriado,
  isAdmin,
}: {
  onClose: () => void
  onCriado: (rota: Rota) => void
  isAdmin: boolean
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInst = useRef<L.Map | null>(null)
  const marker = useRef<L.Marker | null>(null)

  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)
  const [nome, setNome] = useState("")
  const [regiao, setRegiao] = useState("")
  const [descricao, setDescricao] = useState("")
  const [oficial, setOficial] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInst.current) return

    const m = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView(BRASIL, 4)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(m)

    function setPin(latlng: L.LatLng) {
      setPos({ lat: latlng.lat, lng: latlng.lng })
      if (marker.current) {
        marker.current.setLatLng(latlng)
      } else {
        marker.current = L.marker(latlng, { icon: pinIcon(), draggable: true })
          .addTo(m)
          .on("dragend", (ev) => {
            const ll = (ev.target as L.Marker).getLatLng()
            setPos({ lat: ll.lat, lng: ll.lng })
          })
      }
    }

    m.on("click", (e: L.LeafletMouseEvent) => setPin(e.latlng))
    mapInst.current = m

    navigator.geolocation?.getCurrentPosition(
      (p) => m.setView([p.coords.latitude, p.coords.longitude], 13),
      () => {},
      { timeout: 4000 }
    )

    const t = setTimeout(() => m.invalidateSize(), 80)
    return () => {
      clearTimeout(t)
      m.remove()
      mapInst.current = null
      marker.current = null
    }
  }, [])

  async function submit() {
    if (!nome.trim()) return setErro("Dê um nome à chegada")
    if (!pos) return setErro("Toque no mapa para marcar o ponto de chegada")
    setLoading(true)
    setErro(null)
    try {
      const { rota } = await api.post<{ rota: Rota }>("/api/tracks/rotas", {
        nome: nome.trim(),
        lat: pos.lat,
        lng: pos.lng,
        regiao: regiao || undefined,
        descricao: descricao.trim() || undefined,
        oficial: oficial && isAdmin,
      })
      onCriado(rota)
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar destino")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Flag className="size-4 text-purple" />
            <h2 className="font-display text-[15px] font-bold text-foreground">Novo ponto de chegada</h2>
          </div>
          <button onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Mapa */}
          <div className="relative">
            <div ref={mapRef} className="h-[260px] w-full bg-surface-2" />
            <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-3 py-1 text-[11px] text-muted-foreground shadow">
              {pos ? (
                <span className="flex items-center gap-1 text-foreground">
                  <MapPin className="size-3 text-purple" />
                  {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
                </span>
              ) : (
                "Toque no mapa para marcar a chegada"
              )}
            </div>
          </div>

          {/* Form */}
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint-foreground">Nome da chegada</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Morro do Cristo"
                maxLength={120}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint-foreground">Região (opcional)</label>
              <select
                value={regiao}
                onChange={(e) => setRegiao(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-purple focus:outline-none"
              >
                <option value="">—</option>
                {REGIOES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint-foreground">Descrição (opcional)</label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="O que torna essa chegada especial?"
                rows={2}
                maxLength={280}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
              />
            </div>

            {isAdmin && (
              <label className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5">
                <input type="checkbox" checked={oficial} onChange={(e) => setOficial(e.target.checked)} className="size-4 accent-[var(--purple)]" />
                <span className="text-[13px] text-foreground">Marcar como rota oficial</span>
                <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-purple">Admin</span>
              </label>
            )}

            {erro && <p className="rounded-lg border border-red-bg bg-red-bg px-3 py-2 text-sm text-red">{erro}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border px-5 py-3.5">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
            {loading ? "Criando..." : "Criar chegada"}
          </button>
        </div>
      </div>
    </div>
  )
}
