/**
 * RunPage — HUD de corrida ativo (largada livre → 1 chegada).
 *
 * Fluxo:
 * 1. Monta → cria run no backend → carrega ghosts + rota.
 * 2. Pede permissão de GPS. Se negado, mostra erro.
 * 3. watchPosition registra posição continuamente.
 * 4. A cada 5s envia lote de pontos para o backend.
 * 5. Mapa Leaflet (dark) mostra usuário + chegada + ghosts.
 * 6. Ao clicar "Finalizar" (ou chegar perto da chegada), salva run.
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useSearchParams, useNavigate } from "react-router-dom"
import { Flag, MapPin, X, CheckCircle, Ghost as GhostIcon, Navigation } from "lucide-react"
import { api } from "@/lib/api/client"
import type { Rota, Ghost, GhostPonto } from "@/types/tracks"
import type { VeiculoComMetricas } from "@/types"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// ── Tipos internos ────────────────────────────────────────────────────────────

interface Ponto {
  lat: number
  lng: number
  velocidade_kmh: number
  ts: number
  offset_ms: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuracao(ms: number) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
}

/** Haversine distance em km */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDist(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

/** Interpola posição do fantasma no tempo elapsed_ms */
function ghostPosAt(pontos: GhostPonto[], elapsed_ms: number): [number, number] | null {
  if (pontos.length === 0) return null
  const last = pontos[pontos.length - 1]
  if (elapsed_ms >= last.offset_ms) return [Number(last.lat), Number(last.lng)]
  for (let i = 1; i < pontos.length; i++) {
    if (pontos[i].offset_ms >= elapsed_ms) {
      const prev = pontos[i - 1]
      const curr = pontos[i]
      const t = (elapsed_ms - prev.offset_ms) / (curr.offset_ms - prev.offset_ms)
      return [
        Number(prev.lat) + (Number(curr.lat) - Number(prev.lat)) * t,
        Number(prev.lng) + (Number(curr.lng) - Number(prev.lng)) * t,
      ]
    }
  }
  return [Number(pontos[0].lat), Number(pontos[0].lng)]
}

// Ícones Leaflet (evita o problema do default icon path no Vite)
function dotIcon(color: string, size = 14) {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 8px ${color}aa"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function carIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:24px;height:24px;border-radius:50%;background:#e879f9;border:3px solid white;box-shadow:0 0 0 4px rgba(232,121,249,0.3),0 0 12px #e879f9"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

function flagIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:30px;height:30px;border-radius:50%;background:#7f77dd;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 6px rgba(127,119,221,0.25)">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

const GHOST_COLORS = ["#a855f7", "#ec4899", "#f97316"]
const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"

// ── Componente principal ──────────────────────────────────────────────────────

type RunPhase = "loading" | "gps_error" | "running" | "finished"

export default function RunPage() {
  const { rotaId } = useParams<{ rotaId: string }>()
  const [params] = useSearchParams()
  const veiculoId = params.get("veiculo") ?? ""
  const navigate = useNavigate()

  const [phase, setPhase] = useState<RunPhase>("loading")
  const [erroMsg, setErroMsg] = useState("")

  const [rota, setRota] = useState<Rota | null>(null)
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const [veiculo, setVeiculo] = useState<VeiculoComMetricas | null>(null)
  const [, setRunId] = useState<string | null>(null)

  // Telemetria ao vivo
  const [elapsed, setElapsed] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [maxSpeed, setMaxSpeed] = useState(0)
  const [distancia, setDistancia] = useState(0)
  const [distFalta, setDistFalta] = useState<number | null>(null)
  const [perto, setPerto] = useState(false)

  const [resultado, setResultado] = useState<{ duracao_s: number; vel_media_kmh: number; vel_max_kmh: number; badges: string[] } | null>(null)

  // Refs
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<L.Map | null>(null)
  const userMarker = useRef<L.Marker | null>(null)
  const ghostMarkers = useRef<L.Marker[]>([])
  const watchId = useRef<number | null>(null)
  const startedAt = useRef<number>(0)
  const pontosBuffer = useRef<Ponto[]>([])
  const allPontos = useRef<Ponto[]>([])
  const lastPos = useRef<{ lat: number; lng: number } | null>(null)
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const syncTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const runIdRef = useRef<string | null>(null)
  const finalizando = useRef(false)
  const centralizou = useRef(false)

  // ── Inicialização ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!rotaId || !veiculoId) { navigate("/tracks"); return }

    Promise.all([
      api.get<{ rota: Rota }>(`/api/tracks/rotas/${rotaId}`).then((r) => r.rota),
      api.get<{ ghosts: Ghost[] }>(`/api/tracks/rotas/${rotaId}/ghosts`).then((r) => r.ghosts),
      api.get<VeiculoComMetricas[]>("/api/veiculos").then((vs) => vs.find((v) => v.id === veiculoId) ?? null),
      api.post<{ run: { id: string } }>("/api/tracks/runs", { rota_id: rotaId, veiculo_id: veiculoId }).then((r) => r.run.id),
    ]).then(([r, g, v, rid]) => {
      setRota(r)
      setGhosts(g)
      setVeiculo(v)
      setRunId(rid)
      runIdRef.current = rid
      iniciarGPS()
    }).catch((err) => {
      setErroMsg(String(err))
      setPhase("gps_error")
    })

    return () => cleanup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Leaflet: monta o mapa após entrar em "running" ────────────────────────

  useEffect(() => {
    if (phase !== "running" || !mapRef.current || !rota) return
    if (leafletMap.current) return

    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false })
    L.tileLayer(DARK_TILES, { maxZoom: 19, subdomains: "abcd" }).addTo(map)

    // Chegada (largada livre → só o destino)
    L.marker([rota.ponto_b_lat, rota.ponto_b_lng], { icon: flagIcon() })
      .bindPopup(`<b>Chegada</b><br>${rota.ponto_b_nome}`).addTo(map)

    // Fantasmas — começam no primeiro ponto gravado de cada um
    ghostMarkers.current = ghosts.map((g, i) => {
      const start = g.pontos[0]
      const ll: [number, number] = start ? [Number(start.lat), Number(start.lng)] : [rota.ponto_b_lat, rota.ponto_b_lng]
      return L.marker(ll, { icon: dotIcon(GHOST_COLORS[i] ?? "#888") })
        .bindPopup(`<b>👻 ${g.usuario_nome}</b><br>${g.veiculo_apelido}`)
        .addTo(map)
    })

    // Usuário
    userMarker.current = L.marker([rota.ponto_b_lat, rota.ponto_b_lng], { icon: carIcon(), zIndexOffset: 1000 })
      .bindPopup("Você").addTo(map)

    map.setView([rota.ponto_b_lat, rota.ponto_b_lng], 14)
    setTimeout(() => map.invalidateSize(), 80)
    leafletMap.current = map
  }, [phase, rota, ghosts])

  // ── GPS ───────────────────────────────────────────────────────────────────

  const iniciarGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setErroMsg("Geolocalização não suportada neste dispositivo.")
      setPhase("gps_error")
      return
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        startedAt.current = Date.now()

        elapsedTimer.current = setInterval(() => setElapsed(Date.now() - startedAt.current), 500)

        syncTimer.current = setInterval(async () => {
          if (pontosBuffer.current.length === 0 || !runIdRef.current) return
          const lote = [...pontosBuffer.current]
          pontosBuffer.current = []
          try {
            await api.post(`/api/tracks/runs/${runIdRef.current}/pontos`, { pontos: lote })
          } catch { /* re-tenta no próximo ciclo */ }
        }, 5000)

        watchId.current = navigator.geolocation.watchPosition(
          (pos) => onPosicao(pos),
          (err) => console.warn("GPS:", err),
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
        )

        setPhase("running")
      },
      (err) => {
        setErroMsg(
          err.code === 1
            ? "Permissão de localização negada. Habilite o GPS nas configurações do navegador."
            : "Não foi possível obter sua localização. Verifique o GPS."
        )
        setPhase("gps_error")
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }, [])

  function onPosicao(pos: GeolocationPosition) {
    if (!startedAt.current) return
    const lat = pos.coords.latitude
    const lng = pos.coords.longitude
    const spd = pos.coords.speed != null ? pos.coords.speed * 3.6 : 0
    const offset_ms = Date.now() - startedAt.current

    const ponto: Ponto = { lat, lng, velocidade_kmh: spd, ts: Date.now(), offset_ms }
    pontosBuffer.current.push(ponto)
    allPontos.current.push(ponto)

    if (lastPos.current) {
      const d = haversine(lastPos.current.lat, lastPos.current.lng, lat, lng)
      setDistancia((prev) => prev + d)
    }
    lastPos.current = { lat, lng }

    setSpeed(Math.round(spd))
    setMaxSpeed((prev) => Math.max(prev, spd))

    if (userMarker.current) userMarker.current.setLatLng([lat, lng])
    if (leafletMap.current) {
      // primeira posição: aproxima a câmera no usuário
      const zoom = centralizou.current ? leafletMap.current.getZoom() : 16
      centralizou.current = true
      leafletMap.current.setView([lat, lng], zoom, { animate: true })
    }

    if (rota) {
      const distB = haversine(lat, lng, rota.ponto_b_lat, rota.ponto_b_lng)
      setDistFalta(distB)
      setPerto(distB < 0.3) // 300 m
    }
  }

  // ── Atualiza fantasmas no mapa ────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "running") return
    const interval = setInterval(() => {
      const el = Date.now() - startedAt.current
      ghosts.forEach((g, i) => {
        const pos = ghostPosAt(g.pontos, el)
        if (pos && ghostMarkers.current[i]) ghostMarkers.current[i].setLatLng(pos)
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [phase, ghosts])

  // ── Finalizar ─────────────────────────────────────────────────────────────

  async function finalizar() {
    if (finalizando.current || !runIdRef.current) return
    finalizando.current = true

    const duracao_s = Math.round((Date.now() - startedAt.current) / 1000)
    const vel_max = maxSpeed
    const vel_media = allPontos.current.length > 0
      ? allPontos.current.reduce((s, p) => s + p.velocidade_kmh, 0) / allPontos.current.length
      : 0

    cleanup()

    if (pontosBuffer.current.length > 0) {
      await api.post(`/api/tracks/runs/${runIdRef.current}/pontos`, { pontos: pontosBuffer.current }).catch(() => {})
    }

    const last = allPontos.current[allPontos.current.length - 1]
    const res = await api.post<{ run: unknown; badges: string[] }>(
      `/api/tracks/runs/${runIdRef.current}/finalizar`,
      {
        duracao_s,
        distancia_km: distancia,
        vel_media_kmh: Math.round(vel_media * 10) / 10,
        vel_max_kmh: Math.round(vel_max * 10) / 10,
        lat_final: last?.lat ?? rota?.ponto_b_lat,
        lng_final: last?.lng ?? rota?.ponto_b_lng,
      }
    )

    setResultado({ duracao_s, vel_media_kmh: vel_media, vel_max_kmh: vel_max, badges: res.badges })
    setPhase("finished")
  }

  function cleanup() {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
    if (elapsedTimer.current) clearInterval(elapsedTimer.current)
    if (syncTimer.current) clearInterval(syncTimer.current)
    if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null }
  }

  async function cancelar() {
    cleanup()
    if (runIdRef.current) {
      await api.post(`/api/tracks/runs/${runIdRef.current}/pontos`, { pontos: [] }).catch(() => {})
    }
    navigate(`/tracks/${rotaId}`)
  }

  // ── Renders ───────────────────────────────────────────────────────────────

  // Loading
  if (phase === "loading") {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-[#0b0b10]">
        <div className="size-10 animate-spin rounded-full border-2 border-white/20 border-t-purple" />
        <p className="text-sm text-white/60">Carregando rota e fantasmas...</p>
      </div>
    )
  }

  // Erro GPS
  if (phase === "gps_error") {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-[#0b0b10] px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-red-bg text-red">
          <MapPin className="size-6" />
        </div>
        <div>
          <p className="font-medium text-white">GPS indisponível</p>
          <p className="mt-1 max-w-[360px] text-sm text-white/60">{erroMsg}</p>
        </div>
        <button onClick={() => navigate(`/tracks/${rotaId}`)} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/10">
          Voltar
        </button>
      </div>
    )
  }

  // Resultado final
  if (phase === "finished" && resultado) {
    const diff = rota?.tempo_ideal_s ? resultado.duracao_s - rota.tempo_ideal_s : null
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 overflow-y-auto bg-[#0b0b10] px-6 py-10 text-center">
        <CheckCircle className="size-16 text-green" />
        <div>
          <p className="font-display text-[40px] font-bold leading-none text-white">{formatDuracao(resultado.duracao_s * 1000)}</p>
          <p className="mt-2 text-sm text-white/60">{rota?.nome}{veiculo ? ` · ${veiculo.apelido}` : ""}</p>
        </div>

        <div className="grid w-full max-w-[360px] grid-cols-3 gap-3">
          {[
            { v: `${distancia.toFixed(1)}`, l: "km" },
            { v: resultado.vel_media_kmh.toFixed(0), l: "km/h média" },
            { v: resultado.vel_max_kmh.toFixed(0), l: "km/h máx" },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-data text-lg font-bold text-white">{s.v}</p>
              <p className="text-[10px] text-white/40">{s.l}</p>
            </div>
          ))}
        </div>

        {diff != null && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-[13px]">
            <span className="text-white/50">Diferença do ideal: </span>
            <span className={`font-medium ${diff <= 0 ? "text-green" : "text-amber"}`}>
              {diff > 0 ? "+" : ""}{diff}s
            </span>
          </div>
        )}

        {resultado.badges.length > 0 && (
          <div className="flex w-full max-w-[360px] flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Conquistas desbloqueadas</p>
            {resultado.badges.map((b) => (
              <div key={b} className="flex items-center gap-2 rounded-xl border border-green/30 bg-green-bg px-4 py-2 text-[13px] text-green">🏆 {b}</div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => navigate(`/tracks/${rotaId}`)} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/10">
            Ver leaderboard
          </button>
          <button onClick={() => navigate("/tracks")} className="rounded-lg bg-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            Outras rotas
          </button>
        </div>
      </div>
    )
  }

  // ── HUD de corrida (full-screen imersivo) ─────────────────────────────────

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0b0b10]">
      {/* Mapa */}
      <div ref={mapRef} className="absolute inset-0 z-0" />

      {/* Top overlay */}
      <div className="relative z-10 flex items-start justify-between gap-2 bg-gradient-to-b from-black/80 to-transparent px-4 pb-8 pt-[max(14px,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-white">{rota?.nome}</p>
          <p className="truncate text-[11px] text-purple-300">chegada · {rota?.ponto_b_nome}</p>
        </div>
        <button onClick={cancelar} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur-sm hover:bg-black/60 hover:text-white">
          <X className="size-4" />
        </button>
      </div>

      {/* Distância até a chegada (flutuante) */}
      {distFalta != null && (
        <div className="relative z-10 mx-auto -mt-2 flex items-center gap-1.5 rounded-full bg-purple/90 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-lg backdrop-blur-sm">
          <Navigation className="size-3.5" />
          faltam {formatDist(distFalta)}
        </div>
      )}

      <div className="flex-1" />

      {/* Bottom HUD */}
      <div className="relative z-10 bg-gradient-to-t from-[#0b0b10] via-[#0b0b10]/95 to-transparent px-5 pt-10 pb-[max(20px,env(safe-area-inset-bottom))]">
        {/* Velocímetro */}
        <div className="flex items-end justify-center gap-2">
          <span className="font-data text-[68px] font-bold leading-[0.85] tracking-tight text-white tabular-nums">{speed}</span>
          <span className="mb-3 text-sm font-medium text-white/40">km/h</span>
        </div>

        {/* Stats */}
        <div className="mt-4 flex items-stretch justify-between gap-2">
          {[
            { v: formatDuracao(elapsed), l: "tempo" },
            { v: distFalta != null ? formatDist(distFalta) : "—", l: "faltam" },
            { v: `${Math.round(maxSpeed)}`, l: "máx km/h" },
          ].map((s) => (
            <div key={s.l} className="flex-1 text-center">
              <p className="font-data text-[17px] font-bold leading-none text-white">{s.v}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-white/40">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Legenda dos fantasmas */}
        {ghosts.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1">
            {ghosts.map((g, i) => (
              <span key={g.id} className="flex items-center gap-1 text-[10px] text-white/50">
                <span className="inline-block size-2 rounded-full" style={{ background: GHOST_COLORS[i] ?? "#888" }} />
                <GhostIcon className="size-2.5" /> {g.usuario_nome}
              </span>
            ))}
          </div>
        )}

        {/* Finalizar */}
        <button
          onClick={finalizar}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-semibold transition-all ${
            perto
              ? "animate-pulse bg-green text-white shadow-lg shadow-green/30"
              : "border border-white/15 bg-white/5 text-white/70"
          }`}
        >
          <Flag className="size-4" />
          {perto ? "Você chegou! Finalizar" : "Finalizar run"}
        </button>
      </div>
    </div>
  )
}
